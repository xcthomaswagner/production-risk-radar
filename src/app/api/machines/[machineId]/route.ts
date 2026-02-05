import { NextResponse } from "next/server";

import { getTwin, queryAdx } from "@/lib/azure";
import { MACHINE_ID_PATTERN } from "@/lib/constants";

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
  try {
    const { machineId } = await params;

    // Validate machineId format
    if (!MACHINE_ID_PATTERN.test(machineId)) {
      return NextResponse.json(
        { error: "Invalid machine ID format. Expected L{1-3}-M{1-5}" },
        { status: 400 }
      );
    }

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
  } catch (err) {
    console.error("Machine detail API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
