/**
 * Application constants for Production Risk Radar
 */

/** The ID of the factory twin in Azure Digital Twins */
export const FACTORY_ID = "demo-factory";

/** Risk score threshold above which a machine is considered high-risk */
export const HIGH_RISK_THRESHOLD = 0.7;

/** Valid line IDs in the demo factory */
export const VALID_LINE_IDS = ["L1", "L2", "L3"] as const;
export type LineId = (typeof VALID_LINE_IDS)[number];

/** Valid machine ID pattern: L{1-3}-M{1-5} */
export const MACHINE_ID_PATTERN = /^L[1-3]-M[1-5]$/;

/** All valid machine IDs */
export const VALID_MACHINE_IDS = [
  "L1-M1", "L1-M2", "L1-M3", "L1-M4", "L1-M5",
  "L2-M1", "L2-M2", "L2-M3", "L2-M4", "L2-M5",
  "L3-M1", "L3-M2", "L3-M3", "L3-M4", "L3-M5",
] as const;
export type MachineId = (typeof VALID_MACHINE_IDS)[number];

/** Default line capacity (units per day) */
export const DEFAULT_LINE_CAPACITY = 480;

/** Default OEE (Overall Equipment Effectiveness) */
export const DEFAULT_OEE = 0.85;

/** Sensor value bounds for validation */
export const SENSOR_BOUNDS = {
  temperature_c: { min: -40, max: 200 },
  vibration_mm_s: { min: 0, max: 50 },
  power_kw: { min: 0, max: 100 },
  cycle_time_s: { min: 1, max: 300 },
} as const;

/** Maximum telemetry rows to return */
export const MAX_TELEMETRY_LIMIT = 1000;
export const DEFAULT_TELEMETRY_LIMIT = 100;
