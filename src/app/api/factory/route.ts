import { NextResponse } from "next/server";

import { getTwin, queryTwins } from "@/lib/azure";

export async function GET() {
  const factory = await getTwin("demo-factory");
  if (!factory) {
    return NextResponse.json({ error: "Factory not found" }, { status: 404 });
  }

  const lines = await queryTwins<Record<string, unknown>>(
    "SELECT * FROM DIGITALTWINS T WHERE IS_OF_MODEL('dtmi:com:productionriskradar:Line;1')"
  );

  // Map ADT camelCase to API snake_case
  return NextResponse.json({
    factory_id: factory.$dtId,
    name: factory.name,
    overall_risk_score: factory.overallRiskScore,
    lines: lines
      .sort((a, b) => String(a.$dtId).localeCompare(String(b.$dtId)))
      .map((line) => ({
        line_id: line.$dtId,
        name: line.name,
        line_capacity: line.lineCapacity,
        risk_score: line.riskScore,
        throughput_forecast: line.throughputForecast,
        oee: line.oee,
      })),
  });
}
