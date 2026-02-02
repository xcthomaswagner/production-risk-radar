import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import {
  calculateRiskScore,
  calculatePredictedFailureDate,
  calculateLineThroughput,
  calculateEnergyDeviation,
  calculateLineRiskScore,
  calculateFactoryRiskScore,
} from "@/lib/scoring";

export async function POST(request: Request) {
  const body = await request.json();
  const { machine_id, temperature_c, vibration_mm_s, power_kw, cycle_time_s } = body;

  if (!machine_id) {
    return NextResponse.json({ error: "machine_id is required" }, { status: 400 });
  }

  const db = getDb();

  const machine = db.prepare("SELECT * FROM machines WHERE machine_id = ?").get(machine_id) as
    { machine_id: string; line: string; temperature_c: number; vibration_mm_s: number; power_kw: number; cycle_time_s: number } | undefined;
  if (!machine) {
    return NextResponse.json({ error: "Machine not found" }, { status: 404 });
  }

  // Apply overrides
  const newTemp = temperature_c ?? machine.temperature_c;
  const newVib = vibration_mm_s ?? machine.vibration_mm_s;
  const newPower = power_kw ?? machine.power_kw;
  const newCycle = cycle_time_s ?? machine.cycle_time_s;

  // Recalculate
  const riskScore = calculateRiskScore({
    temperature_c: newTemp,
    vibration_mm_s: newVib,
    power_kw: newPower,
    cycle_time_s: newCycle,
  });
  const predictedFailureDate = calculatePredictedFailureDate(riskScore);
  const energyDeviation = calculateEnergyDeviation(newPower);
  const status = riskScore > 0.7 ? "Warning" : "Running";

  // Transaction for atomic update
  const inject = db.transaction(() => {
    // Update machine
    db.prepare(
      `UPDATE machines SET
        temperature_c = ?, vibration_mm_s = ?, power_kw = ?, cycle_time_s = ?,
        risk_score = ?, predicted_failure_date = ?, energy_deviation_kw = ?, status = ?
      WHERE machine_id = ?`
    ).run(newTemp, newVib, newPower, newCycle, riskScore, predictedFailureDate, energyDeviation, status, machine_id);

    // Insert telemetry
    const timestamp = new Date().toISOString();
    db.prepare(
      `INSERT INTO telemetry (machine_id, timestamp, temperature_c, vibration_mm_s, power_kw, cycle_time_s, risk_score, predicted_failure_date, throughput_forecast, energy_deviation_kw, is_injected)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
    ).run(machine_id, timestamp, newTemp, newVib, newPower, newCycle, riskScore, predictedFailureDate, 0, energyDeviation);

    // Recalculate line
    const lineMachines = db.prepare(
      "SELECT risk_score FROM machines WHERE line = ?"
    ).all(machine.line) as { risk_score: number }[];
    const lineRisks = lineMachines.map(m => m.risk_score);
    const lineRiskScore = calculateLineRiskScore(lineRisks);
    const throughput = calculateLineThroughput(lineRisks);
    db.prepare("UPDATE lines SET risk_score = ?, throughput_forecast = ? WHERE line_id = ?")
      .run(lineRiskScore, throughput, machine.line);

    // Update telemetry throughput
    db.prepare("UPDATE telemetry SET throughput_forecast = ? WHERE machine_id = ? AND timestamp = ?")
      .run(throughput, machine_id, timestamp);

    // Recalculate factory
    const allLines = db.prepare("SELECT risk_score FROM lines").all() as { risk_score: number }[];
    const factoryRisk = calculateFactoryRiskScore(allLines.map(l => l.risk_score));
    db.prepare("UPDATE factory SET overall_risk_score = ? WHERE factory_id = 'demo-factory'")
      .run(factoryRisk);

    // Log
    db.prepare("INSERT INTO anomaly_log (action, machine_id, details) VALUES (?, ?, ?)")
      .run("inject", machine_id, JSON.stringify({ temperature_c: newTemp, vibration_mm_s: newVib, power_kw: newPower, cycle_time_s: newCycle, risk_score: riskScore }));
  });

  inject();

  // Return updated state
  const updated = db.prepare("SELECT * FROM machines WHERE machine_id = ?").get(machine_id);
  const line = db.prepare("SELECT * FROM lines WHERE line_id = ?").get(machine.line);
  const factory = db.prepare("SELECT * FROM factory WHERE factory_id = 'demo-factory'").get();

  return NextResponse.json({ machine: updated, line, factory });
}
