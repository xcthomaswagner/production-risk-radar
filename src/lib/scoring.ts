/**
 * Scoring Engine for Production Risk Radar
 *
 * Provides weighted threshold-based risk scoring, predicted failure dates,
 * throughput forecasting, and energy deviation calculations for the
 * AI-enhanced digital twin demo.
 */

interface SensorReading {
  temperature_c: number;
  vibration_mm_s: number;
  power_kw: number;
  cycle_time_s: number;
}

// --- Thresholds ---

const VIBRATION_NOMINAL = 1.0;
const VIBRATION_CRITICAL = 5.0;

const TEMPERATURE_NOMINAL = 65;
const TEMPERATURE_CRITICAL = 95;

const POWER_NOMINAL_KW = 14;
const POWER_DEVIATION_CRITICAL = 8;

const CYCLE_TIME_NOMINAL = 28;
const CYCLE_TIME_CRITICAL = 45;

// --- Weights ---

const WEIGHT_VIBRATION = 0.45;
const WEIGHT_TEMPERATURE = 0.35;
const WEIGHT_POWER = 0.1;
const WEIGHT_CYCLE_TIME = 0.1;

// --- Throughput constants ---

const BASELINE_THROUGHPUT = 480;
const THROUGHPUT_REDUCTION_FACTOR = 0.6;
const THROUGHPUT_BLENDED_AVG_WEIGHT = 0.6;
const THROUGHPUT_BLENDED_MAX_WEIGHT = 0.4;

// --- Predicted failure constants ---

const FAILURE_MAX_DAYS = 14;
const FAILURE_MIN_DAYS = 1;

// --- Helpers ---

/**
 * Clamp a value to the [min, max] range.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Normalize a sensor value to [0, 1] based on nominal and critical thresholds.
 *
 * - value <= nominal  =>  0
 * - value >= critical =>  1
 * - otherwise         =>  linear interpolation between nominal and critical
 */
function normalize(value: number, nominal: number, critical: number): number {
  if (value <= nominal) return 0;
  if (value >= critical) return 1;
  return (value - nominal) / (critical - nominal);
}

// --- Public API ---

/**
 * Calculate a risk score (0-1) for a single machine based on its current
 * sensor readings. Uses a weighted threshold-based approach across four
 * sensor dimensions.
 *
 * Weights:
 *   vibration  0.45
 *   temperature  0.35
 *   power deviation  0.10
 *   cycle time  0.10
 */
export function calculateRiskScore(reading: SensorReading): number {
  const vibrationScore = normalize(reading.vibration_mm_s, VIBRATION_NOMINAL, VIBRATION_CRITICAL);
  const temperatureScore = normalize(reading.temperature_c, TEMPERATURE_NOMINAL, TEMPERATURE_CRITICAL);
  const powerDeviation = Math.abs(reading.power_kw - POWER_NOMINAL_KW);
  const powerScore = normalize(powerDeviation, 0, POWER_DEVIATION_CRITICAL);
  const cycleTimeScore = normalize(reading.cycle_time_s, CYCLE_TIME_NOMINAL, CYCLE_TIME_CRITICAL);

  const weighted =
    WEIGHT_VIBRATION * clamp(vibrationScore, 0, 1) +
    WEIGHT_TEMPERATURE * clamp(temperatureScore, 0, 1) +
    WEIGHT_POWER * clamp(powerScore, 0, 1) +
    WEIGHT_CYCLE_TIME * clamp(cycleTimeScore, 0, 1);

  return clamp(weighted, 0, 1);
}

/**
 * Calculate the predicted failure date as an ISO 8601 string.
 *
 * Maps risk score linearly to a time horizon:
 *   risk 0.0  =>  14 days from now
 *   risk 1.0  =>   1 day  from now
 */
export function calculatePredictedFailureDate(riskScore: number): string {
  const daysOut = FAILURE_MAX_DAYS - riskScore * (FAILURE_MAX_DAYS - FAILURE_MIN_DAYS);
  const date = new Date();
  date.setDate(date.getDate() + daysOut);
  return date.toISOString();
}

/**
 * Calculate the predicted throughput for a production line given the risk
 * scores of its machines.
 *
 * Uses a blended risk that combines the average risk (60%) and the maximum
 * single-machine risk (40%) to model the bottleneck effect of a single
 * high-risk machine on line throughput.
 *
 * Baseline throughput: 480 units/day.
 */
export function calculateLineThroughput(machineRisks: number[]): number {
  if (machineRisks.length === 0) return BASELINE_THROUGHPUT;

  const avg = machineRisks.reduce((sum, r) => sum + r, 0) / machineRisks.length;
  const max = Math.max(...machineRisks);

  const blendedRisk =
    THROUGHPUT_BLENDED_AVG_WEIGHT * avg + THROUGHPUT_BLENDED_MAX_WEIGHT * max;

  return Math.round(BASELINE_THROUGHPUT * (1 - blendedRisk * THROUGHPUT_REDUCTION_FACTOR));
}

/**
 * Calculate the energy deviation for a machine given its current power draw.
 *
 * Returns the difference from the nominal 14 kW baseline, rounded to two
 * decimal places. Positive values indicate excess consumption; negative
 * values indicate under-consumption.
 */
export function calculateEnergyDeviation(power_kw: number): number {
  return Math.round((power_kw - POWER_NOMINAL_KW) * 100) / 100;
}

/**
 * Calculate the aggregate risk score for a production line by averaging
 * the risk scores of its machines.
 *
 * Returns 0 for an empty array (no machines).
 */
export function calculateLineRiskScore(machineRisks: number[]): number {
  if (machineRisks.length === 0) return 0;
  return machineRisks.reduce((sum, r) => sum + r, 0) / machineRisks.length;
}

/**
 * Calculate the aggregate risk score for the entire factory by averaging
 * the risk scores of its production lines.
 *
 * Returns 0 for an empty array (no lines).
 */
export function calculateFactoryRiskScore(lineRisks: number[]): number {
  if (lineRisks.length === 0) return 0;
  return lineRisks.reduce((sum, r) => sum + r, 0) / lineRisks.length;
}
