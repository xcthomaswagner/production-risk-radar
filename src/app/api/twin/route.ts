import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const factory = db.prepare("SELECT * FROM factory WHERE factory_id = 'demo-factory'").get() as
    { factory_id: string; name: string; overall_risk_score: number };
  const lines = db.prepare("SELECT * FROM lines ORDER BY line_id").all() as
    { line_id: string; name: string; line_capacity: number; risk_score: number; throughput_forecast: number; oee: number }[];
  const machines = db.prepare("SELECT * FROM machines ORDER BY machine_id").all() as
    { machine_id: string; line: string; name: string; status: string; temperature_c: number; vibration_mm_s: number; power_kw: number; cycle_time_s: number; risk_score: number; predicted_failure_date: string; energy_deviation_kw: number }[];

  // Shape like ADT twin graph
  const twinGraph = {
    digitalTwinsId: factory.factory_id,
    $dtId: factory.factory_id,
    $metadata: { $model: "dtmi:com:productionriskradar:Factory;1" },
    name: factory.name,
    overallRiskScore: factory.overall_risk_score,
    lines: lines.map(line => ({
      digitalTwinsId: line.line_id,
      $dtId: line.line_id,
      $metadata: { $model: "dtmi:com:productionriskradar:Line;1" },
      name: line.name,
      lineCapacity: line.line_capacity,
      riskScore: line.risk_score,
      throughputForecast: line.throughput_forecast,
      oee: line.oee,
      machines: machines
        .filter(m => m.line === line.line_id)
        .map(m => ({
          digitalTwinsId: m.machine_id,
          $dtId: m.machine_id,
          $metadata: { $model: "dtmi:com:productionriskradar:Machine;1" },
          name: m.name,
          status: m.status,
          temperature: m.temperature_c,
          vibration: m.vibration_mm_s,
          power: m.power_kw,
          cycleTime: m.cycle_time_s,
          riskScore: m.risk_score,
          predictedFailureDate: m.predicted_failure_date,
          energyDeviation: m.energy_deviation_kw,
        })),
    })),
  };

  return NextResponse.json(twinGraph);
}
