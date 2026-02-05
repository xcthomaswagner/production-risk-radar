import { NextResponse } from "next/server";

import { getTwin, patchTwin, queryTwins, executeAdxCommand } from "@/lib/azure";
import {
  FACTORY_ID,
  HIGH_RISK_THRESHOLD,
  DEFAULT_LINE_CAPACITY,
  DEFAULT_OEE,
  VALID_LINE_IDS,
} from "@/lib/constants";
import {
  calculateRiskScore,
  calculatePredictedFailureDate,
  calculateLineThroughput,
  calculateEnergyDeviation,
  calculateLineRiskScore,
  calculateFactoryRiskScore,
} from "@/lib/scoring";
import { injectSchema, parseJsonBody } from "@/lib/validation";

export async function POST(request: Request) {
  // Step 1: Parse and validate input
  const parsed = await parseJsonBody(request, injectSchema);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { machine_id, temperature_c, vibration_mm_s, power_kw, cycle_time_s } = parsed.data;

  // Validate lineId derived from machine_id
  const lineId = machine_id.split("-")[0];
  if (!VALID_LINE_IDS.includes(lineId as typeof VALID_LINE_IDS[number])) {
    return NextResponse.json({ error: "Invalid line ID derived from machine_id" }, { status: 400 });
  }

  try {
    // Step 2: Get current machine twin
    const machine = await getTwin(machine_id);
    if (!machine) {
      return NextResponse.json({ error: "Machine not found" }, { status: 404 });
    }

    // Step 3: Apply overrides (use incoming values or keep existing)
    const newTemp = temperature_c ?? (machine.temperature as number);
    const newVib = vibration_mm_s ?? (machine.vibration as number);
    const newPower = power_kw ?? (machine.power as number);
    const newCycle = cycle_time_s ?? (machine.cycleTime as number);

    // Step 4: Recalculate via scoring engine
    const riskScore = calculateRiskScore({
      temperature_c: newTemp,
      vibration_mm_s: newVib,
      power_kw: newPower,
      cycle_time_s: newCycle,
    });
    const predictedFailureDate = calculatePredictedFailureDate(riskScore);
    const energyDeviation = calculateEnergyDeviation(newPower);
    const status = riskScore > HIGH_RISK_THRESHOLD ? "Warning" : "Running";

    // Step 5: Patch machine twin in ADT
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

    // Step 6: Insert telemetry row to ADX via .set-or-append (immediately queryable)
    const timestamp = new Date().toISOString();

    // Retry once on ADX insert failure
    let adxWarning: string | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await executeAdxCommand(
          `.set-or-append Telemetry <| print machine_id="${machine_id}", timestamp=datetime("${timestamp}"), temperature_c=real(${newTemp}), vibration_mm_s=real(${newVib}), power_kw=real(${newPower}), cycle_time_s=real(${newCycle}), risk_score=real(${riskScore}), predicted_failure_date=datetime("${predictedFailureDate}"), throughput_forecast=real(0), energy_deviation_kw=real(${energyDeviation}), is_injected=true`
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

    // Step 7: Recalculate line aggregates
    // Use queryTwins for sibling machines, but override the just-patched machine's risk
    // since ADT query index may not reflect the patch instantly
    const lineMachines = await queryTwins<Record<string, unknown>>(
      `SELECT * FROM DIGITALTWINS T WHERE IS_OF_MODEL('dtmi:com:productionriskradar:Machine;1') AND STARTSWITH(T.$dtId, '${lineId}-')`
    );
    const lineRisks = lineMachines.map((m) =>
      (m.$dtId as string) === machine_id ? riskScore : (m.riskScore as number)
    );
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

    // Step 8: Recalculate factory aggregate
    // Override the just-patched line's risk since ADT query may not reflect it yet
    const allLines = await queryTwins<Record<string, unknown>>(
      "SELECT * FROM DIGITALTWINS T WHERE IS_OF_MODEL('dtmi:com:productionriskradar:Line;1')"
    );
    const factoryRisk = calculateFactoryRiskScore(
      allLines.map((l) => ((l.$dtId as string) === lineId ? lineRiskScore : (l.riskScore as number)))
    );

    await patchTwin(FACTORY_ID, [
      { op: "replace", path: "/overallRiskScore", value: factoryRisk },
    ]);

    // Step 9: Return updated state in snake_case
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
        line_capacity: DEFAULT_LINE_CAPACITY,
        risk_score: lineRiskScore,
        throughput_forecast: throughput,
        oee: DEFAULT_OEE,
      },
      factory: {
        factory_id: FACTORY_ID,
        name: "Demo Factory",
        overall_risk_score: factoryRisk,
      },
    };

    if (adxWarning) {
      response.warning = adxWarning;
    }

    return NextResponse.json(response);
  } catch (err) {
    console.error("Inject error:", err);
    return NextResponse.json(
      { error: "Internal server error during anomaly injection" },
      { status: 500 }
    );
  }
}
