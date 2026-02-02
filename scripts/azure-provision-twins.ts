import "dotenv/config";
import fs from "fs";
import path from "path";

import { getAdtClient } from "../src/lib/azure";

/**
 * One-time provisioning script: upload DTDL models to Azure Digital Twins.
 * Run after Azure resources are provisioned via CLI.
 *
 * Usage: pnpm azure:provision
 */
async function main() {
  const client = getAdtClient();

  // Upload DTDL models
  const dtdlDir = path.join(process.cwd(), "dtdl");
  const modelFiles = ["Factory.json", "Line.json", "Machine.json"];

  console.log("Uploading DTDL models...");

  const models = modelFiles.map((file) => {
    const content = fs.readFileSync(path.join(dtdlDir, file), "utf-8");
    return JSON.parse(content);
  });

  try {
    await client.createModels(models);
    console.log(`Uploaded ${models.length} DTDL models.`);
  } catch (e: unknown) {
    // Models may already exist
    if (e instanceof Error && e.message.includes("already exists")) {
      console.log("Models already exist, skipping upload.");
    } else {
      throw e;
    }
  }

  // List models to verify
  const modelList = client.listModels();
  const ids: string[] = [];
  for await (const model of modelList) {
    ids.push(model.id);
  }
  console.log("Models in ADT:", ids.join(", "));

  // Now seed twins
  console.log("\nSeeding Azure Digital Twins and ADX...");
  const { seedAzure } = await import("../src/lib/azure-seed");
  const result = await seedAzure();

  console.log(`Twins created: ${result.twins_created}`);
  console.log(`Relationships created: ${result.relationships_created}`);
  console.log(`Telemetry rows ingested: ${result.telemetry_rows}`);
  console.log("Done!");
}

main().catch((err) => {
  console.error("Provisioning failed:", err);
  process.exit(1);
});
