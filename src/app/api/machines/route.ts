import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const machines = db.prepare("SELECT * FROM machines ORDER BY machine_id").all();
  return NextResponse.json(machines);
}
