import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import {
  calculateRiskScore,
  calculatePredictedFailureDate,
  calculateEnergyDeviation,
  calculateLineRiskScore,
  calculateLineThroughput,
  calculateFactoryRiskScore,
} from "@/lib/scoring";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const machineId = body.machine_id;

  const db = getDb();

  const reset = db.transaction(() => {
    // Get machines to reset
    const machines = machineId
      ? [db.prepare("SELECT * FROM machines WHERE machine_id = ?").get(machineId)]
      : db.prepare("SELECT * FROM machines").all();

    if (machineId && !machines[0]) {
      throw new Error("Machine not found");
    }

    for (const machine of machines as { machine_id: string; line: string }[]) {
      // Get last non-injected telemetry reading
      const lastReading = db.prepare(
        "SELECT * FROM telemetry WHERE machine_id = ? AND is_injected = 0 ORDER BY timestamp DESC LIMIT 1"
      ).get(machine.machine_id) as { temperature_c: number; vibration_mm_s: number; power_kw: number; cycle_time_s: number } | undefined;

      if (lastReading) {
        const riskScore = calculateRiskScore({
          temperature_c: lastReading.temperature_c,
          vibration_mm_s: lastReading.vibration_mm_s,
          power_kw: lastReading.power_kw,
          cycle_time_s: lastReading.cycle_time_s,
        });
        const predictedFailureDate = calculatePredictedFailureDate(riskScore);
        const energyDeviation = calculateEnergyDeviation(lastReading.power_kw);

        db.prepare(
          `UPDATE machines SET
            temperature_c = ?, vibration_mm_s = ?, power_kw = ?, cycle_time_s = ?,
            risk_score = ?, predicted_failure_date = ?, energy_deviation_kw = ?, status = 'Running'
          WHERE machine_id = ?`
        ).run(
          lastReading.temperature_c, lastReading.vibration_mm_s,
          lastReading.power_kw, lastReading.cycle_time_s,
          riskScore, predictedFailureDate, energyDeviation,
          machine.machine_id
        );
      }
    }

    // Delete injected telemetry
    if (machineId) {
      db.prepare("DELETE FROM telemetry WHERE machine_id = ? AND is_injected = 1").run(machineId);
    } else {
      db.prepare("DELETE FROM telemetry WHERE is_injected = 1").run();
    }

    // Recalculate all line aggregates
    const lines = db.prepare("SELECT line_id FROM lines").all() as { line_id: string }[];
    for (const line of lines) {
      const lineMachines = db.prepare("SELECT risk_score FROM machines WHERE line = ?").all(line.line_id) as { risk_score: number }[];
      const risks = lineMachines.map(m => m.risk_score);
      db.prepare("UPDATE lines SET risk_score = ?, throughput_forecast = ? WHERE line_id = ?")
        .run(calculateLineRiskScore(risks), calculateLineThroughput(risks), line.line_id);
    }

    // Recalculate factory
    const allLines = db.prepare("SELECT risk_score FROM lines").all() as { risk_score: number }[];
    db.prepare("UPDATE factory SET overall_risk_score = ? WHERE factory_id = 'demo-factory'")
      .run(calculateFactoryRiskScore(allLines.map(l => l.risk_score)));

    // Log
    db.prepare("INSERT INTO anomaly_log (action, machine_id, details) VALUES (?, ?, ?)")
      .run("reset", machineId || null, machineId ? `Reset ${machineId}` : "Reset all machines");
  });

  try {
    reset();
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "Machine not found") {
      return NextResponse.json({ error: "Machine not found" }, { status: 404 });
    }
    throw e;
  }

  const factory = db.prepare("SELECT * FROM factory WHERE factory_id = 'demo-factory'").get();
  const allLines = db.prepare("SELECT * FROM lines ORDER BY line_id").all();
  return NextResponse.json({ factory, lines: allLines, message: "Reset complete" });
}
