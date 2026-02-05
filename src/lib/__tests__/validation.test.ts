import {
  machineIdSchema,
  injectSchema,
  resetSchema,
  parseJsonBody,
} from "../validation";
import {
  MACHINE_ID_PATTERN,
  SENSOR_BOUNDS,
  VALID_MACHINE_IDS,
} from "../constants";

describe("machineIdSchema", () => {
  it("accepts valid machine IDs", () => {
    for (const id of VALID_MACHINE_IDS) {
      const result = machineIdSchema.safeParse(id);
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid machine IDs", () => {
    const invalidIds = [
      "L0-M1", // L0 not valid
      "L4-M1", // L4 not valid
      "L1-M0", // M0 not valid
      "L1-M6", // M6 not valid
      "L1M1", // missing dash
      "l1-m1", // lowercase
      "L1-M1-extra", // extra suffix
      "", // empty
      "machine", // no pattern
      "L1-M2; DROP TABLE", // injection attempt
    ];

    for (const id of invalidIds) {
      const result = machineIdSchema.safeParse(id);
      expect(result.success).toBe(false);
    }
  });
});

describe("injectSchema", () => {
  it("accepts valid inject input with all fields", () => {
    const input = {
      machine_id: "L1-M2",
      temperature_c: 85.5,
      vibration_mm_s: 3.2,
      power_kw: 15.0,
      cycle_time_s: 30,
    };
    const result = injectSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("accepts valid inject input with only machine_id", () => {
    const input = { machine_id: "L2-M3" };
    const result = injectSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("rejects missing machine_id", () => {
    const input = { temperature_c: 85.5 };
    const result = injectSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects invalid machine_id", () => {
    const input = { machine_id: "INVALID" };
    const result = injectSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects temperature_c below min", () => {
    const input = {
      machine_id: "L1-M1",
      temperature_c: SENSOR_BOUNDS.temperature_c.min - 1,
    };
    const result = injectSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects temperature_c above max", () => {
    const input = {
      machine_id: "L1-M1",
      temperature_c: SENSOR_BOUNDS.temperature_c.max + 1,
    };
    const result = injectSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("accepts temperature_c at boundary values", () => {
    const minInput = {
      machine_id: "L1-M1",
      temperature_c: SENSOR_BOUNDS.temperature_c.min,
    };
    const maxInput = {
      machine_id: "L1-M1",
      temperature_c: SENSOR_BOUNDS.temperature_c.max,
    };
    expect(injectSchema.safeParse(minInput).success).toBe(true);
    expect(injectSchema.safeParse(maxInput).success).toBe(true);
  });

  it("rejects vibration_mm_s below min", () => {
    const input = {
      machine_id: "L1-M1",
      vibration_mm_s: SENSOR_BOUNDS.vibration_mm_s.min - 1,
    };
    const result = injectSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects vibration_mm_s above max", () => {
    const input = {
      machine_id: "L1-M1",
      vibration_mm_s: SENSOR_BOUNDS.vibration_mm_s.max + 1,
    };
    const result = injectSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects power_kw out of bounds", () => {
    const lowInput = {
      machine_id: "L1-M1",
      power_kw: SENSOR_BOUNDS.power_kw.min - 1,
    };
    const highInput = {
      machine_id: "L1-M1",
      power_kw: SENSOR_BOUNDS.power_kw.max + 1,
    };
    expect(injectSchema.safeParse(lowInput).success).toBe(false);
    expect(injectSchema.safeParse(highInput).success).toBe(false);
  });

  it("rejects cycle_time_s out of bounds", () => {
    const lowInput = {
      machine_id: "L1-M1",
      cycle_time_s: SENSOR_BOUNDS.cycle_time_s.min - 1,
    };
    const highInput = {
      machine_id: "L1-M1",
      cycle_time_s: SENSOR_BOUNDS.cycle_time_s.max + 1,
    };
    expect(injectSchema.safeParse(lowInput).success).toBe(false);
    expect(injectSchema.safeParse(highInput).success).toBe(false);
  });

  it("rejects non-numeric sensor values", () => {
    const input = {
      machine_id: "L1-M1",
      temperature_c: "hot",
    };
    const result = injectSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe("resetSchema", () => {
  it("accepts empty object (reset all)", () => {
    const result = resetSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts valid machine_id", () => {
    const input = { machine_id: "L3-M5" };
    const result = resetSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("rejects invalid machine_id", () => {
    const input = { machine_id: "INVALID" };
    const result = resetSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe("parseJsonBody", () => {
  it("parses valid JSON body", async () => {
    const mockRequest = {
      json: async () => ({ machine_id: "L1-M1" }),
    } as Request;

    const result = await parseJsonBody(mockRequest, injectSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.machine_id).toBe("L1-M1");
    }
  });

  it("returns error for invalid JSON body", async () => {
    const mockRequest = {
      json: async () => {
        throw new Error("Invalid JSON");
      },
    } as unknown as Request;

    const result = await parseJsonBody(mockRequest, injectSchema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Invalid JSON body");
    }
  });

  it("returns validation errors for invalid data", async () => {
    const mockRequest = {
      json: async () => ({ machine_id: "INVALID" }),
    } as Request;

    const result = await parseJsonBody(mockRequest, injectSchema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("machine_id");
    }
  });
});

describe("MACHINE_ID_PATTERN", () => {
  it("matches the documented pattern L{1-3}-M{1-5}", () => {
    // Test all valid combinations
    for (let l = 1; l <= 3; l++) {
      for (let m = 1; m <= 5; m++) {
        const id = `L${l}-M${m}`;
        expect(MACHINE_ID_PATTERN.test(id)).toBe(true);
      }
    }
  });
});
