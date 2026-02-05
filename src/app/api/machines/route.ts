import { NextResponse } from "next/server";

import { queryTwins } from "@/lib/azure";

export async function GET() {
  try {
    const machines = await queryTwins<Record<string, unknown>>(
      "SELECT * FROM DIGITALTWINS T WHERE IS_OF_MODEL('dtmi:com:productionriskradar:Machine;1')"
    );

    // Map ADT camelCase to API snake_case
    const result = machines
      .sort((a, b) => String(a.$dtId).localeCompare(String(b.$dtId)))
      .map((m) => ({
        machine_id: m.$dtId,
        line: String(m.$dtId).split("-")[0],
        name: m.name,
        status: m.status,
        temperature_c: m.temperature,
        vibration_mm_s: m.vibration,
        power_kw: m.power,
        cycle_time_s: m.cycleTime,
        risk_score: m.riskScore,
        predicted_failure_date: m.predictedFailureDate,
        energy_deviation_kw: m.energyDeviation,
      }));

    return NextResponse.json(result);
  } catch (err) {
    console.error("Machines API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
