import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const machineId = searchParams.get("machine_id");
  const limit = parseInt(searchParams.get("limit") || "100");

  const db = getDb();
  let query = "SELECT * FROM telemetry";
  const queryParams: (string | number)[] = [];

  if (machineId) {
    query += " WHERE machine_id = ?";
    queryParams.push(machineId);
  }

  query += " ORDER BY timestamp DESC LIMIT ?";
  queryParams.push(limit);

  const telemetry = db.prepare(query).all(...queryParams);
  return NextResponse.json(telemetry);
}
