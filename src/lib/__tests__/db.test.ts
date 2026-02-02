import Database from "better-sqlite3";
import path from "path";

import { initSchema } from "../../../scripts/init-schema";
import { seedDatabase } from "../seed";

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

describe("initSchema", () => {
  it("creates all 5 tables", () => {
    const db = createTestDb();
    initSchema(db);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all() as { name: string }[];

    const tableNames = tables.map(t => t.name);
    expect(tableNames).toContain("factory");
    expect(tableNames).toContain("lines");
    expect(tableNames).toContain("machines");
    expect(tableNames).toContain("telemetry");
    expect(tableNames).toContain("anomaly_log");

    db.close();
  });

  it("creates all indexes", () => {
    const db = createTestDb();
    initSchema(db);

    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name")
      .all() as { name: string }[];

    const indexNames = indexes.map(i => i.name);
    expect(indexNames).toContain("idx_telemetry_machine_time");
    expect(indexNames).toContain("idx_telemetry_risk");
    expect(indexNames).toContain("idx_machines_line");
    expect(indexNames).toContain("idx_machines_risk");

    db.close();
  });

  it("is idempotent (running twice does not error)", () => {
    const db = createTestDb();
    initSchema(db);
    expect(() => initSchema(db)).not.toThrow();
    db.close();
  });
});

describe("seedDatabase", () => {
  const csvPath = path.join(process.cwd(), "data", "production_risk_radar_demo_data.csv");

  it("populates 360 telemetry rows", () => {
    const db = createTestDb();
    initSchema(db);
    seedDatabase(db, csvPath);

    const count = (db.prepare("SELECT COUNT(*) as count FROM telemetry").get() as { count: number }).count;
    expect(count).toBe(360);

    db.close();
  });

  it("populates 15 machines", () => {
    const db = createTestDb();
    initSchema(db);
    seedDatabase(db, csvPath);

    const count = (db.prepare("SELECT COUNT(*) as count FROM machines").get() as { count: number }).count;
    expect(count).toBe(15);

    db.close();
  });

  it("populates 3 lines", () => {
    const db = createTestDb();
    initSchema(db);
    seedDatabase(db, csvPath);

    const count = (db.prepare("SELECT COUNT(*) as count FROM lines").get() as { count: number }).count;
    expect(count).toBe(3);

    db.close();
  });

  it("populates 1 factory", () => {
    const db = createTestDb();
    initSchema(db);
    seedDatabase(db, csvPath);

    const count = (db.prepare("SELECT COUNT(*) as count FROM factory").get() as { count: number }).count;
    expect(count).toBe(1);

    db.close();
  });

  it("is idempotent (running twice doesn't duplicate)", () => {
    const db = createTestDb();
    initSchema(db);
    seedDatabase(db, csvPath);
    seedDatabase(db, csvPath);

    const telemetryCount = (db.prepare("SELECT COUNT(*) as count FROM telemetry").get() as { count: number }).count;
    const machineCount = (db.prepare("SELECT COUNT(*) as count FROM machines").get() as { count: number }).count;
    expect(telemetryCount).toBe(360);
    expect(machineCount).toBe(15);

    db.close();
  });

  it("sets machine risk scores from scoring engine", () => {
    const db = createTestDb();
    initSchema(db);
    seedDatabase(db, csvPath);

    const machines = db.prepare("SELECT machine_id, risk_score FROM machines").all() as { machine_id: string; risk_score: number }[];
    for (const m of machines) {
      expect(m.risk_score).toBeGreaterThanOrEqual(0);
      expect(m.risk_score).toBeLessThanOrEqual(1);
    }

    db.close();
  });

  it("updates line aggregates", () => {
    const db = createTestDb();
    initSchema(db);
    seedDatabase(db, csvPath);

    const lines = db.prepare("SELECT line_id, risk_score, throughput_forecast FROM lines").all() as { line_id: string; risk_score: number; throughput_forecast: number }[];
    expect(lines.length).toBe(3);
    for (const line of lines) {
      expect(line.risk_score).toBeGreaterThan(0);
      expect(line.throughput_forecast).toBeGreaterThan(0);
      expect(line.throughput_forecast).toBeLessThanOrEqual(480);
    }

    db.close();
  });

  it("updates factory aggregate", () => {
    const db = createTestDb();
    initSchema(db);
    seedDatabase(db, csvPath);

    const factory = db.prepare("SELECT * FROM factory").get() as { overall_risk_score: number };
    expect(factory.overall_risk_score).toBeGreaterThan(0);
    expect(factory.overall_risk_score).toBeLessThanOrEqual(1);

    db.close();
  });

  it("logs seed action to anomaly_log", () => {
    const db = createTestDb();
    initSchema(db);
    seedDatabase(db, csvPath);

    const log = db.prepare("SELECT * FROM anomaly_log WHERE action = 'seed'").all() as { action: string; details: string }[];
    expect(log.length).toBe(1);
    expect(log[0].details).toContain("360");

    db.close();
  });
});
