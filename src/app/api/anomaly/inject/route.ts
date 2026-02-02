import { NextResponse } from "next/server";

import { getTwin, patchTwin, queryTwins, executeAdxCommand } from "@/lib/azure";
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

  // Step 1: Get current machine twin
  const machine = await getTwin(machine_id);
  if (!machine) {
    return NextResponse.json({ error: "Machine not found" }, { status: 404 });
  }

  // Step 2: Apply overrides (use incoming values or keep existing)
  const newTemp = temperature_c ?? machine.temperature;
  const newVib = vibration_mm_s ?? machine.vibration;
  const newPower = power_kw ?? machine.power;
  const newCycle = cycle_time_s ?? machine.cycleTime;

  // Step 3: Recalculate via scoring engine
  const riskScore = calculateRiskScore({
    temperature_c: newTemp as number,
    vibration_mm_s: newVib as number,
    power_kw: newPower as number,
    cycle_time_s: newCycle as number,
  });
  const predictedFailureDate = calculatePredictedFailureDate(riskScore);
  const energyDeviation = calculateEnergyDeviation(newPower as number);
  const status = riskScore > 0.7 ? "Warning" : "Running";

  // Step 4: Patch machine twin in ADT
  await patchTwin(machine_id, [
    { op: "replace", path: "/temperature", value: newTemp },
    { op: "replace", path: "/vibration", value: newVib },
    { op: "replace", path: "/power", value: newPower },
    { op: "replace", path: "/cycleTime", value: newCycle },
    { op: "replace", path: "/riskScore", value: riskScore },
    { op: "replace", path: "/predictedFailureDate", value: predictedFailureDate },
    { op: "replace", path: "/energyDeviation", value: energyDeviation },
    { op: "replace", path: "/status", value: status },
  ]);

  // Step 5: Insert telemetry row to ADX via .set-or-append (immediately queryable)
  const timestamp = new Date().toISOString();
  const lineId = String(machine_id).split("-")[0];

  // Retry once on ADX insert failure
  let adxWarning: string | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await executeAdxCommand(
        `.set-or-append Telemetry <| print machine_id="${machine_id}", timestamp=datetime("${timestamp}"), temperature_c=${newTemp}, vibration_mm_s=${newVib}, power_kw=${newPower}, cycle_time_s=${newCycle}, risk_score=${riskScore}, predicted_failure_date=datetime("${predictedFailureDate}"), throughput_forecast=0.0, energy_deviation_kw=${energyDeviation}, is_injected=true`
      );
      adxWarning = undefined;
      break;
    } catch {
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } else {
        adxWarning = "ADX telemetry insert failed after retry. Twin was updated successfully.";
      }
    }
  }

  // Step 6: Recalculate line aggregates
  const lineMachines = await queryTwins<Record<string, unknown>>(
    `SELECT * FROM DIGITALTWINS T WHERE IS_OF_MODEL('dtmi:com:productionriskradar:Machine;1') AND STARTSWITH(T.$dtId, '${lineId}-')`
  );
  const lineRisks = lineMachines.map((m) => m.riskScore as number);
  const lineRiskScore = calculateLineRiskScore(lineRisks);
  const throughput = calculateLineThroughput(lineRisks);

  await patchTwin(lineId, [
    { op: "replace", path: "/riskScore", value: lineRiskScore },
    { op: "replace", path: "/throughputForecast", value: throughput },
    { op: "replace", path: "/currentThroughput", value: throughput },
  ]);

  // Update the telemetry throughput in ADX if insert succeeded
  if (!adxWarning) {
    try {
      await executeAdxCommand(
        `.set-or-replace Telemetry <| Telemetry | where machine_id == "${machine_id}" and timestamp == datetime("${timestamp}") | extend throughput_forecast = ${throughput}`
      );
    } catch {
      // Non-critical: throughput in telemetry row is for historical reference only
    }
  }

  // Step 7: Recalculate factory aggregate
  const allLines = await queryTwins<Record<string, unknown>>(
    "SELECT * FROM DIGITALTWINS T WHERE IS_OF_MODEL('dtmi:com:productionriskradar:Line;1')"
  );
  const factoryRisk = calculateFactoryRiskScore(allLines.map((l) => l.riskScore as number));

  await patchTwin("demo-factory", [
    { op: "replace", path: "/overallRiskScore", value: factoryRisk },
  ]);

  // Step 8: Return updated state in snake_case
  const response: Record<string, unknown> = {
    machine: {
      machine_id,
      line: lineId,
      name: machine.name,
      status,
      temperature_c: newTemp,
      vibration_mm_s: newVib,
      power_kw: newPower,
      cycle_time_s: newCycle,
      risk_score: riskScore,
      predicted_failure_date: predictedFailureDate,
      energy_deviation_kw: energyDeviation,
    },
    line: {
      line_id: lineId,
      name: lineId,
      line_capacity: 480,
      risk_score: lineRiskScore,
      throughput_forecast: throughput,
      oee: 0.85,
    },
    factory: {
      factory_id: "demo-factory",
      name: "Demo Factory",
      overall_risk_score: factoryRisk,
    },
  };

  if (adxWarning) {
    response.warning = adxWarning;
  }

  return NextResponse.json(response);
}
