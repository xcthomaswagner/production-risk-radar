import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

import {
  getAdtClient,
  executeAdxCommand,
  queryTwins,
} from "./azure";
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

interface SeedResult {
  twins_created: number;
  relationships_created: number;
  telemetry_rows: number;
}

/**
 * Delete all existing twins from ADT (machines first, then lines, then factory).
 * Relationships must be deleted before twins.
 */
async function deleteAllTwins(): Promise<void> {
  const client = getAdtClient();

  // Get all twins
  const allTwins = await queryTwins<{ $dtId: string }>(
    "SELECT T.$dtId FROM DIGITALTWINS T"
  );

  // Delete relationships first, then twins
  for (const twin of allTwins) {
    // Delete outgoing relationships
    const outgoing = client.listRelationships(twin.$dtId);
    for await (const rel of outgoing) {
      await client.deleteRelationship(twin.$dtId, rel.$relationshipId);
    }
    // Delete incoming relationships
    const incoming = client.listIncomingRelationships(twin.$dtId);
    for await (const rel of incoming) {
      await client.deleteRelationship(
        rel.sourceId as string,
        rel.relationshipId as string
      );
    }
  }

  // Now delete all twins
  for (const twin of allTwins) {
    await client.deleteDigitalTwin(twin.$dtId);
  }
}

/**
 * Seed Azure Digital Twins and Azure Data Explorer with demo data from CSV.
 */
export async function seedAzure(csvPath?: string): Promise<SeedResult> {
  const filePath = csvPath || CSV_PATH;
  const csvContent = fs.readFileSync(filePath, "utf-8");
  const records: CsvRow[] = parse(csvContent, { columns: true, skip_empty_lines: true });

  const client = getAdtClient();

  // Step 1: Delete existing twins
  await deleteAllTwins();

  // Step 2: Collect unique lines and machines
  const lineIds = [...new Set(records.map((r) => r.Line))].sort();
  const machineIds = [...new Set(records.map((r) => r.Machine))].sort();

  // Step 3: Compute last reading per machine via scoring engine
  const lastReadings = new Map<
    string,
    { temperature_c: number; vibration_mm_s: number; power_kw: number; cycle_time_s: number }
  >();
  for (const row of records) {
    // Last row per machine wins (CSV is sorted by timestamp)
    lastReadings.set(row.Machine, {
      temperature_c: parseFloat(row.Temperature_C),
      vibration_mm_s: parseFloat(row.Vibration_mm_s),
      power_kw: parseFloat(row.Power_kW),
      cycle_time_s: parseFloat(row.CycleTime_s),
    });
  }

  // Compute machine scores
  const machineScores = new Map<
    string,
    {
      riskScore: number;
      predictedFailureDate: string;
      energyDeviation: number;
      reading: { temperature_c: number; vibration_mm_s: number; power_kw: number; cycle_time_s: number };
    }
  >();
  for (const [machineId, reading] of lastReadings) {
    const riskScore = calculateRiskScore(reading);
    machineScores.set(machineId, {
      riskScore,
      predictedFailureDate: calculatePredictedFailureDate(riskScore),
      energyDeviation: calculateEnergyDeviation(reading.power_kw),
      reading,
    });
  }

  // Compute line scores
  const lineScores = new Map<string, { riskScore: number; throughput: number }>();
  for (const lineId of lineIds) {
    const lineMachineRisks = machineIds
      .filter((m) => m.startsWith(lineId + "-"))
      .map((m) => machineScores.get(m)!.riskScore);
    lineScores.set(lineId, {
      riskScore: calculateLineRiskScore(lineMachineRisks),
      throughput: calculateLineThroughput(lineMachineRisks),
    });
  }

  // Compute factory score
  const factoryRisk = calculateFactoryRiskScore(
    lineIds.map((id) => lineScores.get(id)!.riskScore)
  );

  let twinsCreated = 0;
  let relationshipsCreated = 0;

  // Step 4: Create factory twin
  await client.upsertDigitalTwin("demo-factory", JSON.stringify({
    $dtId: "demo-factory",
    $metadata: { $model: "dtmi:com:productionriskradar:Factory;1" },
    name: "Demo Factory",
    location: "Manufacturing Summit",
    overallRiskScore: factoryRisk,
  }));
  twinsCreated++;

  // Step 5: Create line twins
  for (const lineId of lineIds) {
    const scores = lineScores.get(lineId)!;
    await client.upsertDigitalTwin(lineId, JSON.stringify({
      $dtId: lineId,
      $metadata: { $model: "dtmi:com:productionriskradar:Line;1" },
      name: lineId,
      lineCapacity: 480,
      oee: 0.85,
      currentThroughput: scores.throughput,
      riskScore: scores.riskScore,
      throughputForecast: scores.throughput,
    }));
    twinsCreated++;
  }

  // Step 6: Create machine twins
  for (const machineId of machineIds) {
    const scores = machineScores.get(machineId)!;
    await client.upsertDigitalTwin(machineId, JSON.stringify({
      $dtId: machineId,
      $metadata: { $model: "dtmi:com:productionriskradar:Machine;1" },
      name: machineId,
      machineType: "General",
      status: "Running",
      temperature: scores.reading.temperature_c,
      vibration: scores.reading.vibration_mm_s,
      power: scores.reading.power_kw,
      cycleTime: scores.reading.cycle_time_s,
      riskScore: scores.riskScore,
      predictedFailureDate: scores.predictedFailureDate,
      energyDeviation: scores.energyDeviation,
    }));
    twinsCreated++;
  }

  // Step 7: Create relationships
  // Factory -> Line (hasLines)
  for (const lineId of lineIds) {
    await client.upsertRelationship("demo-factory", `demo-factory-hasLines-${lineId}`, {
      $relationshipId: `demo-factory-hasLines-${lineId}`,
      $sourceId: "demo-factory",
      $targetId: lineId,
      $relationshipName: "hasLines",
    });
    relationshipsCreated++;
  }

  // Line -> Machine (hasMachines) + Machine -> Line (partOf)
  for (const machineId of machineIds) {
    const lineId = machineId.split("-")[0];

    await client.upsertRelationship(lineId, `${lineId}-hasMachines-${machineId}`, {
      $relationshipId: `${lineId}-hasMachines-${machineId}`,
      $sourceId: lineId,
      $targetId: machineId,
      $relationshipName: "hasMachines",
    });
    relationshipsCreated++;

    await client.upsertRelationship(machineId, `${machineId}-partOf-${lineId}`, {
      $relationshipId: `${machineId}-partOf-${lineId}`,
      $sourceId: machineId,
      $targetId: lineId,
      $relationshipName: "partOf",
    });
    relationshipsCreated++;
  }

  // Step 8: Clear ADX Telemetry table and bulk load
  await executeAdxCommand(".clear table Telemetry data");

  // Batch ingest via .ingest inline (batches of 50 rows)
  const BATCH_SIZE = 50;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const lines = batch.map((row) => {
      const riskScore = calculateRiskScore({
        temperature_c: parseFloat(row.Temperature_C),
        vibration_mm_s: parseFloat(row.Vibration_mm_s),
        power_kw: parseFloat(row.Power_kW),
        cycle_time_s: parseFloat(row.CycleTime_s),
      });
      const predictedFailureDate = calculatePredictedFailureDate(riskScore);
      const energyDeviation = calculateEnergyDeviation(parseFloat(row.Power_kW));
      const throughput = parseFloat(row.LineThroughputForecast_units_per_day);

      return [
        row.Machine,
        row.Timestamp,
        parseFloat(row.Temperature_C),
        parseFloat(row.Vibration_mm_s),
        parseFloat(row.Power_kW),
        parseFloat(row.CycleTime_s),
        riskScore,
        predictedFailureDate,
        throughput,
        energyDeviation,
        false, // is_injected
      ].join(",");
    });

    const ingestCommand = `.ingest inline into table Telemetry <|\n${lines.join("\n")}`;
    await executeAdxCommand(ingestCommand);
  }

  return {
    twins_created: twinsCreated,
    relationships_created: relationshipsCreated,
    telemetry_rows: records.length,
  };
}
