import type Database from "better-sqlite3";

import { getDb } from "../src/lib/db";

export function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS factory (
      factory_id TEXT PRIMARY KEY,
      name TEXT,
      overall_risk_score REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS lines (
      line_id TEXT PRIMARY KEY,
      name TEXT,
      line_capacity REAL DEFAULT 480,
      risk_score REAL DEFAULT 0,
      throughput_forecast REAL DEFAULT 480,
      oee REAL DEFAULT 0.85
    );

    CREATE TABLE IF NOT EXISTS machines (
      machine_id TEXT PRIMARY KEY,
      line TEXT REFERENCES lines(line_id),
      name TEXT,
      status TEXT DEFAULT 'Running',
      temperature_c REAL,
      vibration_mm_s REAL,
      power_kw REAL,
      cycle_time_s REAL,
      risk_score REAL DEFAULT 0,
      predicted_failure_date TEXT,
      energy_deviation_kw REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS telemetry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      machine_id TEXT REFERENCES machines(machine_id),
      timestamp TEXT,
      temperature_c REAL,
      vibration_mm_s REAL,
      power_kw REAL,
      cycle_time_s REAL,
      risk_score REAL,
      predicted_failure_date TEXT,
      throughput_forecast REAL,
      energy_deviation_kw REAL,
      is_injected INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS anomaly_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT DEFAULT (datetime('now')),
      action TEXT,
      machine_id TEXT,
      details TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_telemetry_machine_time ON telemetry(machine_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_telemetry_risk ON telemetry(risk_score);
    CREATE INDEX IF NOT EXISTS idx_machines_line ON machines(line);
    CREATE INDEX IF NOT EXISTS idx_machines_risk ON machines(risk_score);
  `);
}

// CLI entry point
if (require.main === module) {
  const db = getDb();
  console.log("Initializing schema...");
  initSchema(db);
  console.log("Schema initialized successfully.");

  // Print table info
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all() as { name: string }[];
  console.log(
    "Tables:",
    tables.map((t) => t.name).join(", ")
  );

  const indexes = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name"
    )
    .all() as { name: string }[];
  console.log(
    "Indexes:",
    indexes.map((i) => i.name).join(", ")
  );
}
