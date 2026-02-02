import { NextResponse } from "next/server";

import { getTwin, queryAdx } from "@/lib/azure";

interface TelemetryRow {
  machine_id: string;
  timestamp: string;
  temperature_c: number;
  vibration_mm_s: number;
  power_kw: number;
  cycle_time_s: number;
  risk_score: number;
  predicted_failure_date: string;
  throughput_forecast: number;
  energy_deviation_kw: number;
  is_injected: boolean;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ machineId: string }> }
) {
  const { machineId } = await params;

  const twin = await getTwin(machineId);
  if (!twin) {
    return NextResponse.json({ error: "Machine not found" }, { status: 404 });
  }

  const telemetry = await queryAdx<TelemetryRow>(
    `Telemetry | where machine_id == "${machineId}" | top 24 by timestamp desc`
  );

  return NextResponse.json({
    machine_id: twin.$dtId,
    line: String(twin.$dtId).split("-")[0],
    name: twin.name,
    status: twin.status,
    temperature_c: twin.temperature,
    vibration_mm_s: twin.vibration,
    power_kw: twin.power,
    cycle_time_s: twin.cycleTime,
    risk_score: twin.riskScore,
    predicted_failure_date: twin.predictedFailureDate,
    energy_deviation_kw: twin.energyDeviation,
    telemetry,
  });
}
