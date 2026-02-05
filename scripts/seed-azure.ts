import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { seedAzure } from "../src/lib/azure-seed";

/**
 * Repeatable seed script: clears and re-seeds ADT twins + ADX telemetry.
 *
 * Usage: pnpm azure:seed
 */
async function main() {
  console.log("Seeding Azure Digital Twins and ADX...");
  const result = await seedAzure();

  console.log(`Twins created: ${result.twins_created}`);
  console.log(`Relationships created: ${result.relationships_created}`);
  console.log(`Telemetry rows ingested: ${result.telemetry_rows}`);
  console.log("Done!");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
