import Link from "next/link";

import { getDb } from "@/lib/db";
import { FactoryOverview } from "@/components/factory-overview";
import { HeatmapGrid } from "@/components/heatmap-grid";
import { MachineTable } from "@/components/machine-table";

import type { Factory, Line, Machine } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const db = getDb();

  const factory = db.prepare("SELECT * FROM factory WHERE factory_id = 'demo-factory'").get() as Factory | undefined;
  const lines = db.prepare("SELECT * FROM lines ORDER BY line_id").all() as Line[];
  const machines = db.prepare("SELECT * FROM machines ORDER BY machine_id").all() as Machine[];

  // KPI calculations
  const highRiskCount = machines.filter((m) => m.risk_score > 0.7).length;
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const predictedFailures7d = machines.filter((m) => {
    if (!m.predicted_failure_date) return false;
    const failDate = new Date(m.predicted_failure_date);
    return failDate <= sevenDaysFromNow;
  }).length;
  const totalThroughput = lines.reduce((sum: number, l) => sum + l.throughput_forecast, 0);
  const lineIds = lines.map((l) => l.line_id);

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Production Risk Radar</h1>
            <p className="text-muted-foreground">AI-Enhanced Digital Twin Dashboard — {factory?.name || "Demo Factory"}</p>
          </div>
          <Link
            href="/control"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Control Panel
          </Link>
        </div>

        <FactoryOverview
          factoryRisk={factory?.overall_risk_score ?? 0}
          highRiskCount={highRiskCount}
          predictedFailures7d={predictedFailures7d}
          totalThroughput={totalThroughput}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="mb-3 text-xl font-semibold">Risk Heatmap</h2>
            <HeatmapGrid machines={machines} lines={lineIds} />
          </div>

          <div>
            <h2 className="mb-3 text-xl font-semibold">Line Throughput Forecast</h2>
            <div className="space-y-3">
              {lines.map((line) => {
                const pct = Math.round((line.throughput_forecast / line.line_capacity) * 100);
                const barColor = pct > 80 ? "bg-green-500" : pct > 60 ? "bg-yellow-400" : "bg-red-500";
                return (
                  <div key={line.line_id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{line.line_id}</span>
                      <span>{line.throughput_forecast} / {line.line_capacity} units/day ({pct}%)</span>
                    </div>
                    <div className="h-4 w-full rounded-full bg-muted">
                      <div className={`h-4 rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-xl font-semibold">Machine Details</h2>
          <MachineTable machines={machines} />
        </div>
      </div>
    </main>
  );
}
