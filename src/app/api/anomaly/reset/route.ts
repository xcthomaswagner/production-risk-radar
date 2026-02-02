import { NextResponse } from "next/server";

import { getTwin, patchTwin, queryTwins, queryAdx, executeAdxCommand } from "@/lib/azure";
import {
  calculateRiskScore,
  calculatePredictedFailureDate,
  calculateEnergyDeviation,
  calculateLineRiskScore,
  calculateLineThroughput,
  calculateFactoryRiskScore,
} from "@/lib/scoring";

interface TelemetryRow {
  machine_id: string;
  temperature_c: number;
  vibration_mm_s: number;
  power_kw: number;
  cycle_time_s: number;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const machineId = body.machine_id;

  // Step 1: Get machine(s) to reset
  let machineTwins: Record<string, unknown>[];

  if (machineId) {
    const twin = await getTwin(machineId);
    if (!twin) {
      return NextResponse.json({ error: "Machine not found" }, { status: 404 });
    }
    machineTwins = [twin];
  } else {
    machineTwins = await queryTwins<Record<string, unknown>>(
      "SELECT * FROM DIGITALTWINS T WHERE IS_OF_MODEL('dtmi:com:productionriskradar:Machine;1')"
    );
  }

  // Step 2: For each machine, find last non-injected telemetry and restore
  for (const machine of machineTwins) {
    const mId = machine.$dtId as string;

    const lastReadings = await queryAdx<TelemetryRow>(
      `Telemetry | where machine_id == "${mId}" and is_injected == false | top 1 by timestamp desc`
    );

    if (lastReadings.length > 0) {
      const reading = lastReadings[0];
      const riskScore = calculateRiskScore({
        temperature_c: reading.temperature_c,
        vibration_mm_s: reading.vibration_mm_s,
        power_kw: reading.power_kw,
        cycle_time_s: reading.cycle_time_s,
      });
      const predictedFailureDate = calculatePredictedFailureDate(riskScore);
      const energyDeviation = calculateEnergyDeviation(reading.power_kw);

      await patchTwin(mId, [
        { op: "replace", path: "/temperature", value: reading.temperature_c },
        { op: "replace", path: "/vibration", value: reading.vibration_mm_s },
        { op: "replace", path: "/power", value: reading.power_kw },
        { op: "replace", path: "/cycleTime", value: reading.cycle_time_s },
        { op: "replace", path: "/riskScore", value: riskScore },
        { op: "replace", path: "/predictedFailureDate", value: predictedFailureDate },
        { op: "replace", path: "/energyDeviation", value: energyDeviation },
        { op: "replace", path: "/status", value: "Running" },
      ]);
    }
  }

  // Step 3: Delete injected telemetry from ADX
  if (machineId) {
    await executeAdxCommand(
      `.delete table Telemetry records <| Telemetry | where machine_id == "${machineId}" and is_injected == true`
    );
  } else {
    await executeAdxCommand(
      ".delete table Telemetry records <| Telemetry | where is_injected == true"
    );
  }

  // Step 4: Recalculate all line aggregates
  const allLines = await queryTwins<Record<string, unknown>>(
    "SELECT * FROM DIGITALTWINS T WHERE IS_OF_MODEL('dtmi:com:productionriskradar:Line;1')"
  );

  for (const line of allLines) {
    const lineId = line.$dtId as string;
    const lineMachines = await queryTwins<Record<string, unknown>>(
      `SELECT * FROM DIGITALTWINS T WHERE IS_OF_MODEL('dtmi:com:productionriskradar:Machine;1') AND STARTSWITH(T.$dtId, '${lineId}-')`
    );
    const risks = lineMachines.map((m) => m.riskScore as number);

    await patchTwin(lineId, [
      { op: "replace", path: "/riskScore", value: calculateLineRiskScore(risks) },
      { op: "replace", path: "/throughputForecast", value: calculateLineThroughput(risks) },
      { op: "replace", path: "/currentThroughput", value: calculateLineThroughput(risks) },
    ]);
  }

  // Step 5: Recalculate factory aggregate
  const updatedLines = await queryTwins<Record<string, unknown>>(
    "SELECT * FROM DIGITALTWINS T WHERE IS_OF_MODEL('dtmi:com:productionriskradar:Line;1')"
  );
  const factoryRisk = calculateFactoryRiskScore(updatedLines.map((l) => l.riskScore as number));

  await patchTwin("demo-factory", [
    { op: "replace", path: "/overallRiskScore", value: factoryRisk },
  ]);

  // Return updated state in snake_case
  const factory = await getTwin("demo-factory");
  return NextResponse.json({
    factory: {
      factory_id: "demo-factory",
      name: factory?.name || "Demo Factory",
      overall_risk_score: factory?.overallRiskScore,
    },
    lines: updatedLines
      .sort((a, b) => String(a.$dtId).localeCompare(String(b.$dtId)))
      .map((l) => ({
        line_id: l.$dtId,
        name: l.name,
        line_capacity: l.lineCapacity,
        risk_score: l.riskScore,
        throughput_forecast: l.throughputForecast,
        oee: l.oee,
      })),
    message: "Reset complete",
  });
}
