import {
  calculateRiskScore,
  calculatePredictedFailureDate,
  calculateLineThroughput,
  calculateEnergyDeviation,
  calculateLineRiskScore,
  calculateFactoryRiskScore,
} from "../scoring";

describe("calculateRiskScore", () => {
  it("returns low risk for baseline values", () => {
    const risk = calculateRiskScore({ temperature_c: 70, vibration_mm_s: 1.5, power_kw: 14, cycle_time_s: 30 });
    expect(risk).toBeLessThan(0.4);
    expect(risk).toBeGreaterThanOrEqual(0);
  });

  it("returns high risk for anomaly values", () => {
    const risk = calculateRiskScore({ temperature_c: 95, vibration_mm_s: 5.0, power_kw: 14, cycle_time_s: 30 });
    expect(risk).toBeGreaterThan(0.8);
  });

  it("returns near zero for all nominal values", () => {
    const risk = calculateRiskScore({ temperature_c: 60, vibration_mm_s: 1.0, power_kw: 14, cycle_time_s: 28 });
    expect(risk).toBeLessThan(0.2);
  });

  it("returns near 1.0 for all critical values", () => {
    const risk = calculateRiskScore({ temperature_c: 100, vibration_mm_s: 6.0, power_kw: 25, cycle_time_s: 50 });
    expect(risk).toBeGreaterThan(0.9);
    expect(risk).toBeLessThanOrEqual(1.0);
  });

  it("returns mid-range for single-axis anomaly (only vibration high)", () => {
    const risk = calculateRiskScore({ temperature_c: 65, vibration_mm_s: 5.0, power_kw: 14, cycle_time_s: 28 });
    expect(risk).toBeGreaterThan(0.3);
    expect(risk).toBeLessThan(0.7);
  });

  it("clamps to 0-1 range", () => {
    const riskLow = calculateRiskScore({ temperature_c: 20, vibration_mm_s: 0, power_kw: 10, cycle_time_s: 20 });
    const riskHigh = calculateRiskScore({ temperature_c: 150, vibration_mm_s: 10, power_kw: 30, cycle_time_s: 60 });
    expect(riskLow).toBeGreaterThanOrEqual(0);
    expect(riskHigh).toBeLessThanOrEqual(1.0);
  });
});

describe("calculatePredictedFailureDate", () => {
  it("risk 0.0 -> 14 days out", () => {
    const date = calculatePredictedFailureDate(0.0);
    const now = new Date();
    const diff = (new Date(date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    expect(diff).toBeGreaterThan(13);
    expect(diff).toBeLessThan(15);
  });

  it("risk 0.5 -> ~7 days out", () => {
    const date = calculatePredictedFailureDate(0.5);
    const now = new Date();
    const diff = (new Date(date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    expect(diff).toBeGreaterThan(6);
    expect(diff).toBeLessThan(8.5);
  });

  it("risk 1.0 -> 1 day out", () => {
    const date = calculatePredictedFailureDate(1.0);
    const now = new Date();
    const diff = (new Date(date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    expect(diff).toBeGreaterThan(0.5);
    expect(diff).toBeLessThan(2);
  });
});

describe("calculateLineThroughput", () => {
  it("all low risk -> near 480", () => {
    const throughput = calculateLineThroughput([0.1, 0.1, 0.1, 0.1, 0.1]);
    expect(throughput).toBeGreaterThan(450);
    expect(throughput).toBeLessThanOrEqual(480);
  });

  it("one machine at 0.9 -> noticeable drop", () => {
    const throughput = calculateLineThroughput([0.1, 0.1, 0.9, 0.1, 0.1]);
    expect(throughput).toBeLessThan(450);
    expect(throughput).toBeGreaterThan(300);
  });

  it("all machines at 1.0 -> significant reduction", () => {
    const throughput = calculateLineThroughput([1.0, 1.0, 1.0, 1.0, 1.0]);
    expect(throughput).toBeLessThan(300);
  });
});

describe("calculateEnergyDeviation", () => {
  it("power=14 -> 0", () => {
    expect(calculateEnergyDeviation(14)).toBe(0);
  });

  it("power=20 -> 6", () => {
    expect(calculateEnergyDeviation(20)).toBe(6);
  });

  it("power=8 -> -6", () => {
    expect(calculateEnergyDeviation(8)).toBe(-6);
  });
});

describe("calculateLineRiskScore", () => {
  it("averages machine risks", () => {
    expect(calculateLineRiskScore([0.2, 0.3, 0.4, 0.5, 0.6])).toBeCloseTo(0.4);
  });

  it("returns 0 for empty array", () => {
    expect(calculateLineRiskScore([])).toBe(0);
  });
});

describe("calculateFactoryRiskScore", () => {
  it("averages line risks", () => {
    expect(calculateFactoryRiskScore([0.3, 0.4, 0.5])).toBeCloseTo(0.4);
  });

  it("returns 0 for empty array", () => {
    expect(calculateFactoryRiskScore([])).toBe(0);
  });
});
