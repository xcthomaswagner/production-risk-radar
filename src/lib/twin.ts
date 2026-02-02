import Database from "better-sqlite3";
import { getDb } from "./db";

import type { Factory, Line, Machine } from "./types";

export interface DigitalTwin {
  digitalTwinsId: string;
  $dtId: string;
  $metadata: { $model: string };
  [key: string]: unknown;
}

export interface TwinRelationship {
  $relationshipId: string;
  $sourceId: string;
  $targetId: string;
  $relationshipName: string;
}

/**
 * Get the full twin graph (Factory -> Lines -> Machines) shaped like ADT API responses.
 */
export function getTwinGraph(db?: Database.Database) {
  const d = db || getDb();

  const factory = d.prepare("SELECT * FROM factory WHERE factory_id = 'demo-factory'").get() as Factory;
  const lines = d.prepare("SELECT * FROM lines ORDER BY line_id").all() as Line[];
  const machines = d.prepare("SELECT * FROM machines ORDER BY machine_id").all() as Machine[];

  const factoryTwin: DigitalTwin = {
    digitalTwinsId: factory.factory_id,
    $dtId: factory.factory_id,
    $metadata: { $model: "dtmi:com:productionriskradar:Factory;1" },
    name: factory.name,
    overallRiskScore: factory.overall_risk_score,
  };

  const lineTwins: (DigitalTwin & { machines: DigitalTwin[] })[] = lines.map((line) => ({
    digitalTwinsId: line.line_id,
    $dtId: line.line_id,
    $metadata: { $model: "dtmi:com:productionriskradar:Line;1" },
    name: line.name,
    lineCapacity: line.line_capacity,
    riskScore: line.risk_score,
    throughputForecast: line.throughput_forecast,
    oee: line.oee,
    machines: machines
      .filter((m) => m.line === line.line_id)
      .map((m) => ({
        digitalTwinsId: m.machine_id,
        $dtId: m.machine_id,
        $metadata: { $model: "dtmi:com:productionriskradar:Machine;1" },
        name: m.name,
        status: m.status,
        temperature: m.temperature_c,
        vibration: m.vibration_mm_s,
        power: m.power_kw,
        cycleTime: m.cycle_time_s,
        riskScore: m.risk_score,
        predictedFailureDate: m.predicted_failure_date,
        energyDeviation: m.energy_deviation_kw,
      })),
  }));

  return {
    ...factoryTwin,
    lines: lineTwins,
  };
}

/**
 * Get all relationships in the twin graph (flat list).
 */
export function getTwinRelationships(db?: Database.Database): TwinRelationship[] {
  const d = db || getDb();

  const lines = d.prepare("SELECT line_id FROM lines ORDER BY line_id").all() as Pick<Line, "line_id">[];
  const machines = d.prepare("SELECT machine_id, line FROM machines ORDER BY machine_id").all() as Pick<Machine, "machine_id" | "line">[];

  const relationships: TwinRelationship[] = [];

  // Factory -> Line relationships
  for (const line of lines) {
    relationships.push({
      $relationshipId: `demo-factory-hasLines-${line.line_id}`,
      $sourceId: "demo-factory",
      $targetId: line.line_id,
      $relationshipName: "hasLines",
    });
  }

  // Line -> Machine relationships
  for (const machine of machines) {
    relationships.push({
      $relationshipId: `${machine.line}-hasMachines-${machine.machine_id}`,
      $sourceId: machine.line,
      $targetId: machine.machine_id,
      $relationshipName: "hasMachines",
    });
  }

  return relationships;
}

/**
 * Get a single twin by ID.
 */
export function getTwinById(twinId: string, db?: Database.Database): DigitalTwin | null {
  const d = db || getDb();

  // Try factory
  const factory = d.prepare("SELECT * FROM factory WHERE factory_id = ?").get(twinId) as Factory | undefined;
  if (factory) {
    return {
      digitalTwinsId: factory.factory_id,
      $dtId: factory.factory_id,
      $metadata: { $model: "dtmi:com:productionriskradar:Factory;1" },
      name: factory.name,
      overallRiskScore: factory.overall_risk_score,
    };
  }

  // Try line
  const line = d.prepare("SELECT * FROM lines WHERE line_id = ?").get(twinId) as Line | undefined;
  if (line) {
    return {
      digitalTwinsId: line.line_id,
      $dtId: line.line_id,
      $metadata: { $model: "dtmi:com:productionriskradar:Line;1" },
      name: line.name,
      lineCapacity: line.line_capacity,
      riskScore: line.risk_score,
      throughputForecast: line.throughput_forecast,
      oee: line.oee,
    };
  }

  // Try machine
  const machine = d.prepare("SELECT * FROM machines WHERE machine_id = ?").get(twinId) as Machine | undefined;
  if (machine) {
    return {
      digitalTwinsId: machine.machine_id,
      $dtId: machine.machine_id,
      $metadata: { $model: "dtmi:com:productionriskradar:Machine;1" },
      name: machine.name,
      status: machine.status,
      temperature: machine.temperature_c,
      vibration: machine.vibration_mm_s,
      power: machine.power_kw,
      cycleTime: machine.cycle_time_s,
      riskScore: machine.risk_score,
      predictedFailureDate: machine.predicted_failure_date,
      energyDeviation: machine.energy_deviation_kw,
    };
  }

  return null;
}
