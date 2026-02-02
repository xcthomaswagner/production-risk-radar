import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

import {
  calculateRiskScore,
  calculatePredictedFailureDate,
  calculateLineThroughput,
  calculateEnergyDeviation,
  calculateLineRiskScore,
  calculateFactoryRiskScore,
} from "./scoring";

const CSV_PATH = path.join(process.cwd(), "data", "production_risk_radar_demo_data.csv");

interface CsvRow {
  Timestamp: string;
  Factory: string;
  Line: string;
  Machine: string;
  Temperature_C: string;
  Vibration_mm_s: string;
  Power_kW: string;
  CycleTime_s: string;
  Status: string;
  RiskScore: string;
  PredictedFailureDate: string;
  LineThroughputForecast_units_per_day: string;
  EnergyDeviation_kW: string;
}

export function seedDatabase(db: Database.Database, csvPath?: string): void {
  const filePath = csvPath || CSV_PATH;
  const csvContent = fs.readFileSync(filePath, "utf-8");
  const records: CsvRow[] = parse(csvContent, { columns: true, skip_empty_lines: true });

  // Clear existing data (order matters for FK constraints)
  db.exec("DELETE FROM telemetry");
  db.exec("DELETE FROM anomaly_log");
  db.exec("DELETE FROM machines");
  db.exec("DELETE FROM lines");
  db.exec("DELETE FROM factory");

  // Insert factory
  db.prepare("INSERT INTO factory (factory_id, name, overall_risk_score) VALUES (?, ?, ?)").run(
    "demo-factory", "Demo Factory", 0
  );

  // Collect unique lines and machines
  const lineIds = [...new Set(records.map(r => r.Line))].sort();
  const machineIds = [...new Set(records.map(r => r.Machine))].sort();

  // Insert lines
  const insertLine = db.prepare(
    "INSERT INTO lines (line_id, name, line_capacity, risk_score, throughput_forecast, oee) VALUES (?, ?, ?, ?, ?, ?)"
  );
  for (const lineId of lineIds) {
    insertLine.run(lineId, lineId, 480, 0, 480, 0.85);
  }

  // Insert machines (initial values will be updated after telemetry)
  const insertMachine = db.prepare(
    `INSERT INTO machines (machine_id, line, name, status, temperature_c, vibration_mm_s, power_kw, cycle_time_s, risk_score, predicted_failure_date, energy_deviation_kw)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const machineId of machineIds) {
    const line = machineId.split("-")[0]; // "L1-M1" -> "L1"
    insertMachine.run(machineId, line, machineId, "Running", 0, 0, 0, 0, 0, "", 0);
  }

  // Insert all telemetry rows
  const insertTelemetry = db.prepare(
    `INSERT INTO telemetry (machine_id, timestamp, temperature_c, vibration_mm_s, power_kw, cycle_time_s, risk_score, predicted_failure_date, throughput_forecast, energy_deviation_kw, is_injected)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
  );

  const insertMany = db.transaction((rows: CsvRow[]) => {
    for (const row of rows) {
      insertTelemetry.run(
        row.Machine,
        row.Timestamp,
        parseFloat(row.Temperature_C),
        parseFloat(row.Vibration_mm_s),
        parseFloat(row.Power_kW),
        parseFloat(row.CycleTime_s),
        parseFloat(row.RiskScore),
        row.PredictedFailureDate,
        parseFloat(row.LineThroughputForecast_units_per_day),
        parseFloat(row.EnergyDeviation_kW)
      );
    }
  });
  insertMany(records);

  // Update each machine with its last telemetry reading
  const updateMachine = db.prepare(
    `UPDATE machines SET
       temperature_c = ?, vibration_mm_s = ?, power_kw = ?, cycle_time_s = ?,
       risk_score = ?, predicted_failure_date = ?, energy_deviation_kw = ?, status = ?
     WHERE machine_id = ?`
  );

  for (const machineId of machineIds) {
    const lastReading = db.prepare(
      "SELECT * FROM telemetry WHERE machine_id = ? ORDER BY timestamp DESC LIMIT 1"
    ).get(machineId) as { temperature_c: number; vibration_mm_s: number; power_kw: number; cycle_time_s: number } | undefined;

    if (lastReading) {
      // Recalculate using our scoring engine
      const riskScore = calculateRiskScore({
        temperature_c: lastReading.temperature_c,
        vibration_mm_s: lastReading.vibration_mm_s,
        power_kw: lastReading.power_kw,
        cycle_time_s: lastReading.cycle_time_s,
      });
      const predictedFailureDate = calculatePredictedFailureDate(riskScore);
      const energyDeviation = calculateEnergyDeviation(lastReading.power_kw);

      updateMachine.run(
        lastReading.temperature_c,
        lastReading.vibration_mm_s,
        lastReading.power_kw,
        lastReading.cycle_time_s,
        riskScore,
        predictedFailureDate,
        energyDeviation,
        "Running",
        machineId
      );
    }
  }

  // Update line aggregates
  const updateLine = db.prepare(
    "UPDATE lines SET risk_score = ?, throughput_forecast = ? WHERE line_id = ?"
  );

  for (const lineId of lineIds) {
    const machines = db.prepare(
      "SELECT risk_score FROM machines WHERE line = ?"
    ).all(lineId) as { risk_score: number }[];

    const risks = machines.map(m => m.risk_score);
    const lineRiskScore = calculateLineRiskScore(risks);
    const throughput = calculateLineThroughput(risks);
    updateLine.run(lineRiskScore, throughput, lineId);
  }

  // Update factory aggregate
  const allLineRisks = lineIds.map(id => {
    const line = db.prepare("SELECT risk_score FROM lines WHERE line_id = ?").get(id) as { risk_score: number };
    return line.risk_score;
  });
  const factoryRisk = calculateFactoryRiskScore(allLineRisks);
  db.prepare("UPDATE factory SET overall_risk_score = ? WHERE factory_id = ?").run(factoryRisk, "demo-factory");

  // Log the seed action
  db.prepare("INSERT INTO anomaly_log (action, machine_id, details) VALUES (?, ?, ?)").run(
    "seed", null, `Seeded from CSV with ${records.length} telemetry rows`
  );
}
