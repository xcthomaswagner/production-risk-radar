import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ machineId: string }> }
) {
  const { machineId } = await params;
  const db = getDb();
  const machine = db.prepare("SELECT * FROM machines WHERE machine_id = ?").get(machineId);
  if (!machine) {
    return NextResponse.json({ error: "Machine not found" }, { status: 404 });
  }
  const telemetry = db.prepare(
    "SELECT * FROM telemetry WHERE machine_id = ? ORDER BY timestamp DESC LIMIT 24"
  ).all(machineId);
  return NextResponse.json({ ...machine, telemetry });
}
