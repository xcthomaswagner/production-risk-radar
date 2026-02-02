import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const factory = db.prepare("SELECT * FROM factory WHERE factory_id = 'demo-factory'").get() as Record<string, unknown>;
  const lines = db.prepare("SELECT * FROM lines ORDER BY line_id").all();
  return NextResponse.json({ ...factory, lines });
}
