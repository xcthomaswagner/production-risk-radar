import { NextResponse } from "next/server";

import { queryAdx } from "@/lib/azure";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const machineId = searchParams.get("machine_id");
  const limit = parseInt(searchParams.get("limit") || "100");

  let kql = "Telemetry";

  if (machineId) {
    kql += ` | where machine_id == "${machineId}"`;
  }

  kql += ` | top ${limit} by timestamp desc`;

  const telemetry = await queryAdx(kql);
  return NextResponse.json(telemetry);
}
