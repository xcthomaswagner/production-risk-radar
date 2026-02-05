import Link from "next/link";

import { getTwin, queryTwins } from "@/lib/azure";
import { FactoryOverview } from "@/components/factory-overview";
import { FACTORY_ID, HIGH_RISK_THRESHOLD } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const factory = await getTwin(FACTORY_ID);

  const lines = await queryTwins<Record<string, unknown>>(
    "SELECT * FROM DIGITALTWINS T WHERE IS_OF_MODEL('dtmi:com:productionriskradar:Line;1')"
  );

  const machines = await queryTwins<Record<string, unknown>>(
    "SELECT * FROM DIGITALTWINS T WHERE IS_OF_MODEL('dtmi:com:productionriskradar:Machine;1')"
  );

  // KPI calculations
  const highRiskCount = machines.filter((m) => (m.riskScore as number) > HIGH_RISK_THRESHOLD).length;
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const predictedFailures7d = machines.filter((m) => {
    const failDate = m.predictedFailureDate ? new Date(m.predictedFailureDate as string) : null;
    return failDate && failDate <= sevenDaysFromNow;
  }).length;
  const totalThroughput = lines.reduce(
    (sum: number, l) => sum + ((l.throughputForecast as number) || 0),
    0
  );

  const powerBiUrl = process.env.POWER_BI_DASHBOARD_URL;

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Production Risk Radar</h1>
            <p className="text-muted-foreground">AI-Enhanced Digital Twin Dashboard — {(factory?.name as string) || "Demo Factory"}</p>
          </div>
          <div className="flex gap-3">
            {powerBiUrl && (
              <a
                href={powerBiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Power BI Dashboard
              </a>
            )}
            <Link
              href="/control"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Control Panel
            </Link>
          </div>
        </div>

        <FactoryOverview
          factoryRisk={(factory?.overallRiskScore as number) ?? 0}
          highRiskCount={highRiskCount}
          predictedFailures7d={predictedFailures7d}
          totalThroughput={totalThroughput}
        />

        <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
          <h2 className="mb-2 text-xl font-semibold">Visualization</h2>
          <p className="text-muted-foreground">
            Detailed heatmaps, trend lines, and machine tables are available in the{" "}
            {powerBiUrl ? (
              <a href={powerBiUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">
                Power BI dashboard
              </a>
            ) : (
              "Power BI dashboard"
            )}
            . Power BI connects directly to Azure Data Explorer via DirectQuery for near-real-time updates.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Use the <Link href="/control" className="text-blue-600 underline hover:text-blue-800">Control Panel</Link> to inject anomalies and reset baselines. Changes propagate to Power BI automatically.
          </p>
        </div>
      </div>
    </main>
  );
}
