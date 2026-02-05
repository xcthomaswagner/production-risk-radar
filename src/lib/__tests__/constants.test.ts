import {
  FACTORY_ID,
  HIGH_RISK_THRESHOLD,
  VALID_LINE_IDS,
  MACHINE_ID_PATTERN,
  VALID_MACHINE_IDS,
  DEFAULT_LINE_CAPACITY,
  DEFAULT_OEE,
  SENSOR_BOUNDS,
  MAX_TELEMETRY_LIMIT,
  DEFAULT_TELEMETRY_LIMIT,
} from "../constants";

describe("constants", () => {
  describe("FACTORY_ID", () => {
    it("is defined as demo-factory", () => {
      expect(FACTORY_ID).toBe("demo-factory");
    });
  });

  describe("HIGH_RISK_THRESHOLD", () => {
    it("is 0.7", () => {
      expect(HIGH_RISK_THRESHOLD).toBe(0.7);
    });

    it("is between 0 and 1", () => {
      expect(HIGH_RISK_THRESHOLD).toBeGreaterThanOrEqual(0);
      expect(HIGH_RISK_THRESHOLD).toBeLessThanOrEqual(1);
    });
  });

  describe("VALID_LINE_IDS", () => {
    it("contains L1, L2, L3", () => {
      expect(VALID_LINE_IDS).toContain("L1");
      expect(VALID_LINE_IDS).toContain("L2");
      expect(VALID_LINE_IDS).toContain("L3");
      expect(VALID_LINE_IDS.length).toBe(3);
    });
  });

  describe("MACHINE_ID_PATTERN", () => {
    it("is a regex", () => {
      expect(MACHINE_ID_PATTERN).toBeInstanceOf(RegExp);
    });

    it("matches valid IDs", () => {
      expect(MACHINE_ID_PATTERN.test("L1-M1")).toBe(true);
      expect(MACHINE_ID_PATTERN.test("L3-M5")).toBe(true);
    });

    it("rejects invalid IDs", () => {
      expect(MACHINE_ID_PATTERN.test("L4-M1")).toBe(false);
      expect(MACHINE_ID_PATTERN.test("L1-M6")).toBe(false);
      expect(MACHINE_ID_PATTERN.test("invalid")).toBe(false);
    });
  });

  describe("VALID_MACHINE_IDS", () => {
    it("contains 15 machine IDs (3 lines x 5 machines)", () => {
      expect(VALID_MACHINE_IDS.length).toBe(15);
    });

    it("all IDs match the pattern", () => {
      for (const id of VALID_MACHINE_IDS) {
        expect(MACHINE_ID_PATTERN.test(id)).toBe(true);
      }
    });
  });

  describe("DEFAULT_LINE_CAPACITY", () => {
    it("is a positive number", () => {
      expect(DEFAULT_LINE_CAPACITY).toBeGreaterThan(0);
    });
  });

  describe("DEFAULT_OEE", () => {
    it("is between 0 and 1", () => {
      expect(DEFAULT_OEE).toBeGreaterThan(0);
      expect(DEFAULT_OEE).toBeLessThanOrEqual(1);
    });
  });

  describe("SENSOR_BOUNDS", () => {
    it("has valid temperature_c bounds", () => {
      expect(SENSOR_BOUNDS.temperature_c.min).toBeLessThan(SENSOR_BOUNDS.temperature_c.max);
    });

    it("has valid vibration_mm_s bounds", () => {
      expect(SENSOR_BOUNDS.vibration_mm_s.min).toBeLessThan(SENSOR_BOUNDS.vibration_mm_s.max);
      expect(SENSOR_BOUNDS.vibration_mm_s.min).toBeGreaterThanOrEqual(0);
    });

    it("has valid power_kw bounds", () => {
      expect(SENSOR_BOUNDS.power_kw.min).toBeLessThan(SENSOR_BOUNDS.power_kw.max);
      expect(SENSOR_BOUNDS.power_kw.min).toBeGreaterThanOrEqual(0);
    });

    it("has valid cycle_time_s bounds", () => {
      expect(SENSOR_BOUNDS.cycle_time_s.min).toBeLessThan(SENSOR_BOUNDS.cycle_time_s.max);
      expect(SENSOR_BOUNDS.cycle_time_s.min).toBeGreaterThan(0);
    });
  });

  describe("telemetry limits", () => {
    it("MAX_TELEMETRY_LIMIT is greater than DEFAULT_TELEMETRY_LIMIT", () => {
      expect(MAX_TELEMETRY_LIMIT).toBeGreaterThan(DEFAULT_TELEMETRY_LIMIT);
    });

    it("DEFAULT_TELEMETRY_LIMIT is positive", () => {
      expect(DEFAULT_TELEMETRY_LIMIT).toBeGreaterThan(0);
    });
  });
});
