import { NextResponse } from "next/server";

import { seedAzure } from "@/lib/azure-seed";

export async function POST() {
  const result = await seedAzure();

  return NextResponse.json({
    message: "Azure Digital Twins and ADX re-seeded",
    twins_created: result.twins_created,
    relationships_created: result.relationships_created,
    telemetry_rows: result.telemetry_rows,
    machines: 15,
  });
}
