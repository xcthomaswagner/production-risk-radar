import { getDb } from "../src/lib/db";
import { initSchema } from "./init-schema";
import { seedDatabase } from "../src/lib/seed";

const db = getDb();
console.log("Initializing schema...");
initSchema(db);
console.log("Seeding database...");
seedDatabase(db);

// Print counts
const telemetryCount = (db.prepare("SELECT COUNT(*) as count FROM telemetry").get() as { count: number }).count;
const machineCount = (db.prepare("SELECT COUNT(*) as count FROM machines").get() as { count: number }).count;
const lineCount = (db.prepare("SELECT COUNT(*) as count FROM lines").get() as { count: number }).count;
const factoryCount = (db.prepare("SELECT COUNT(*) as count FROM factory").get() as { count: number }).count;
const factory = db.prepare("SELECT * FROM factory").get() as { overall_risk_score: number };

console.log(`Telemetry rows: ${telemetryCount}`);
console.log(`Machines: ${machineCount}`);
console.log(`Lines: ${lineCount}`);
console.log(`Factory: ${factoryCount}`);
console.log(`Factory risk score: ${factory.overall_risk_score.toFixed(4)}`);
console.log("Done!");
