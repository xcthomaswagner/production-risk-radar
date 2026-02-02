export interface Machine {
  machine_id: string; // e.g. "L1-M1"
  line: string; // e.g. "L1"
  name: string; // e.g. "L1-M1"
  status: string; // "Running" | "Warning" | "Down"
  temperature_c: number;
  vibration_mm_s: number;
  power_kw: number;
  cycle_time_s: number;
  risk_score: number; // 0-1
  predicted_failure_date: string; // ISO date
  energy_deviation_kw: number;
}

export interface Line {
  line_id: string; // e.g. "L1"
  name: string;
  line_capacity: number; // default 480
  risk_score: number;
  throughput_forecast: number;
  oee: number; // 0-1
}

export interface Factory {
  factory_id: string; // "demo-factory"
  name: string;
  overall_risk_score: number;
}

export interface TelemetryReading {
  id?: number;
  machine_id: string;
  timestamp: string; // ISO datetime
  temperature_c: number;
  vibration_mm_s: number;
  power_kw: number;
  cycle_time_s: number;
  risk_score: number;
  predicted_failure_date: string;
  throughput_forecast: number;
  energy_deviation_kw: number;
  is_injected: number; // 0 or 1
}

export interface AnomalyInjectPayload {
  machine_id: string;
  temperature_c?: number;
  vibration_mm_s?: number;
  power_kw?: number;
  cycle_time_s?: number;
}

export interface AnomalyPreset {
  name: string;
  description: string;
  payload: AnomalyInjectPayload;
}

export interface AnomalyLogEntry {
  id?: number;
  timestamp: string;
  action: string; // "inject" | "reset" | "seed"
  machine_id: string | null;
  details: string;
}

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
