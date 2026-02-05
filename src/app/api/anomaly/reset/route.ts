import { NextResponse } from "next/server";

import { getTwin, patchTwin, queryTwins, queryAdx, executeAdxCommand } from "@/lib/azure";
import { FACTORY_ID, VALID_LINE_IDS } from "@/lib/constants";
import {
  calculateRiskScore,
  calculatePredictedFailureDate,
  calculateEnergyDeviation,
  calculateLineRiskScore,
  calculateLineThroughput,
  calculateFactoryRiskScore,
} from "@/lib/scoring";
import { resetSchema, parseJsonBody } from "@/lib/validation";

interface TelemetryRow {
  machine_id: string;
  temperature_c: number;
  vibration_mm_s: number;
  power_kw: number;
  cycle_time_s: number;
}

export async function POST(request: Request) {
  // Step 1: Parse and validate input
  const parsed = await parseJsonBody(request, resetSchema);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const machineId = parsed.data.machine_id;

  // If machineId provided, validate the lineId derived from it
  if (machineId) {
    const lineId = machineId.split("-")[0];
    if (!VALID_LINE_IDS.includes(lineId as typeof VALID_LINE_IDS[number])) {
      return NextResponse.json({ error: "Invalid line ID derived from machine_id" }, { status: 400 });
    }
  }

  try {
    // Step 2: Get machine(s) to reset
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

    // Step 3: For each machine, find last non-injected telemetry and restore
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

    // Step 4: Delete injected telemetry from ADX
    if (machineId) {
      await executeAdxCommand(
        `.delete table Telemetry records <| Telemetry | where machine_id == "${machineId}" and is_injected == true`
      );
    } else {
      await executeAdxCommand(
        ".delete table Telemetry records <| Telemetry | where is_injected == true"
      );
    }

    // Step 5: Recalculate all line aggregates
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

    // Step 6: Recalculate factory aggregate
    const updatedLines = await queryTwins<Record<string, unknown>>(
      "SELECT * FROM DIGITALTWINS T WHERE IS_OF_MODEL('dtmi:com:productionriskradar:Line;1')"
    );
    const factoryRisk = calculateFactoryRiskScore(updatedLines.map((l) => l.riskScore as number));

    await patchTwin(FACTORY_ID, [
      { op: "replace", path: "/overallRiskScore", value: factoryRisk },
    ]);

    // Return updated state in snake_case
    const factory = await getTwin(FACTORY_ID);
    return NextResponse.json({
      factory: {
        factory_id: FACTORY_ID,
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
  } catch (err) {
    console.error("Reset error:", err);
    return NextResponse.json(
      { error: "Internal server error during reset" },
      { status: 500 }
    );
  }
}
