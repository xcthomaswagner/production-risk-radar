/**
 * Zod validation schemas for API inputs
 */

import { z } from "zod";
import {
  MACHINE_ID_PATTERN,
  SENSOR_BOUNDS,
  MAX_TELEMETRY_LIMIT,
  DEFAULT_TELEMETRY_LIMIT,
} from "./constants";

/**
 * Schema for validating machine IDs
 */
export const machineIdSchema = z
  .string()
  .regex(MACHINE_ID_PATTERN, "Invalid machine ID format. Expected L{1-3}-M{1-5}");

/**
 * Schema for the anomaly inject endpoint
 */
export const injectSchema = z.object({
  machine_id: machineIdSchema,
  temperature_c: z
    .number()
    .min(SENSOR_BOUNDS.temperature_c.min)
    .max(SENSOR_BOUNDS.temperature_c.max)
    .optional(),
  vibration_mm_s: z
    .number()
    .min(SENSOR_BOUNDS.vibration_mm_s.min)
    .max(SENSOR_BOUNDS.vibration_mm_s.max)
    .optional(),
  power_kw: z
    .number()
    .min(SENSOR_BOUNDS.power_kw.min)
    .max(SENSOR_BOUNDS.power_kw.max)
    .optional(),
  cycle_time_s: z
    .number()
    .min(SENSOR_BOUNDS.cycle_time_s.min)
    .max(SENSOR_BOUNDS.cycle_time_s.max)
    .optional(),
});

export type InjectInput = z.infer<typeof injectSchema>;

/**
 * Schema for the anomaly reset endpoint
 */
export const resetSchema = z.object({
  machine_id: machineIdSchema.optional(),
});

export type ResetInput = z.infer<typeof resetSchema>;

/**
 * Schema for telemetry query parameters
 */
export const telemetryQuerySchema = z.object({
  machine_id: machineIdSchema.optional(),
  limit: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1).max(MAX_TELEMETRY_LIMIT))
    .optional()
    .default(DEFAULT_TELEMETRY_LIMIT),
});

export type TelemetryQueryInput = z.infer<typeof telemetryQuerySchema>;

/**
 * Schema for single machine route parameter
 */
export const machineParamSchema = z.object({
  machineId: machineIdSchema,
});

/**
 * Helper to parse JSON body safely
 */
export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      const issues = result.error.issues.map(
        (issue: z.ZodIssue) => `${issue.path.join(".")}: ${issue.message}`
      );
      return { success: false, error: issues.join(", ") };
    }
    return { success: true, data: result.data };
  } catch {
    return { success: false, error: "Invalid JSON body" };
  }
}

/**
 * Helper to parse query parameters safely
 */
export function parseQueryParams<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: string } {
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });

  const result = schema.safeParse(params);
  if (!result.success) {
    const issues = result.error.issues.map(
      (issue: z.ZodIssue) => `${issue.path.join(".")}: ${issue.message}`
    );
    return { success: false, error: issues.join(", ") };
  }
  return { success: true, data: result.data };
}
