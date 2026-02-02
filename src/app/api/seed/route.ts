import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { initSchema } from "../../../../scripts/init-schema";
import { seedDatabase } from "@/lib/seed";

export async function POST() {
  const db = getDb();
  initSchema(db);
  seedDatabase(db);

  const telemetryCount = (db.prepare("SELECT COUNT(*) as count FROM telemetry").get() as { count: number }).count;
  const machineCount = (db.prepare("SELECT COUNT(*) as count FROM machines").get() as { count: number }).count;

  return NextResponse.json({
    message: "Database re-seeded",
    telemetry_rows: telemetryCount,
    machines: machineCount,
  });
}
