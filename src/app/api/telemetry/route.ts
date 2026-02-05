import { NextResponse } from "next/server";

import { queryAdx } from "@/lib/azure";
import { MACHINE_ID_PATTERN, MAX_TELEMETRY_LIMIT, DEFAULT_TELEMETRY_LIMIT } from "@/lib/constants";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const machineId = searchParams.get("machine_id");
    const limitParam = searchParams.get("limit");

    // Validate machine_id if provided
    if (machineId && !MACHINE_ID_PATTERN.test(machineId)) {
      return NextResponse.json(
        { error: "Invalid machine_id format. Expected L{1-3}-M{1-5}" },
        { status: 400 }
      );
    }

    // Validate and clamp limit
    let limit = DEFAULT_TELEMETRY_LIMIT;
    if (limitParam) {
      const parsed = parseInt(limitParam, 10);
      if (isNaN(parsed) || parsed < 1) {
        return NextResponse.json(
          { error: "Invalid limit parameter. Must be a positive integer" },
          { status: 400 }
        );
      }
      limit = Math.min(parsed, MAX_TELEMETRY_LIMIT);
    }

    let kql = "Telemetry";

    if (machineId) {
      kql += ` | where machine_id == "${machineId}"`;
    }

    kql += ` | top ${limit} by timestamp desc`;

    const telemetry = await queryAdx(kql);
    return NextResponse.json(telemetry);
  } catch (err) {
    console.error("Telemetry API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
