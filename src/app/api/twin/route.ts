import { NextResponse } from "next/server";

import { getTwin, queryTwins } from "@/lib/azure";
import { FACTORY_ID } from "@/lib/constants";

export async function GET() {
  try {
    const factory = await getTwin(FACTORY_ID);
    if (!factory) {
      return NextResponse.json({ error: "Factory not found" }, { status: 404 });
    }

    const lines = await queryTwins<Record<string, unknown>>(
      "SELECT * FROM DIGITALTWINS T WHERE IS_OF_MODEL('dtmi:com:productionriskradar:Line;1')"
    );

    const machines = await queryTwins<Record<string, unknown>>(
      "SELECT * FROM DIGITALTWINS T WHERE IS_OF_MODEL('dtmi:com:productionriskradar:Machine;1')"
    );

    // Shape like ADT twin graph
    const twinGraph = {
      digitalTwinsId: factory.$dtId,
      $dtId: factory.$dtId,
      $metadata: { $model: "dtmi:com:productionriskradar:Factory;1" },
      name: factory.name,
      overallRiskScore: factory.overallRiskScore,
      lines: lines
        .sort((a, b) => String(a.$dtId).localeCompare(String(b.$dtId)))
        .map((line) => ({
          digitalTwinsId: line.$dtId,
          $dtId: line.$dtId,
          $metadata: { $model: "dtmi:com:productionriskradar:Line;1" },
          name: line.name,
          lineCapacity: line.lineCapacity,
          riskScore: line.riskScore,
          throughputForecast: line.throughputForecast,
          oee: line.oee,
          machines: machines
            .filter((m) => String(m.$dtId).startsWith(String(line.$dtId) + "-"))
            .sort((a, b) => String(a.$dtId).localeCompare(String(b.$dtId)))
            .map((m) => ({
              digitalTwinsId: m.$dtId,
              $dtId: m.$dtId,
              $metadata: { $model: "dtmi:com:productionriskradar:Machine;1" },
              name: m.name,
              status: m.status,
              temperature: m.temperature,
              vibration: m.vibration,
              power: m.power,
              cycleTime: m.cycleTime,
              riskScore: m.riskScore,
              predictedFailureDate: m.predictedFailureDate,
              energyDeviation: m.energyDeviation,
            })),
        })),
    };

    return NextResponse.json(twinGraph);
  } catch (err) {
    console.error("Twin API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
