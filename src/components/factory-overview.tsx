import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface FactoryOverviewProps {
  factoryRisk: number;
  highRiskCount: number;
  predictedFailures7d: number;
  totalThroughput: number;
}

export function FactoryOverview({ factoryRisk, highRiskCount, predictedFailures7d, totalThroughput }: FactoryOverviewProps) {
  const riskPercent = Math.round(factoryRisk * 100);
  const riskColor = riskPercent > 70 ? "text-red-600" : riskPercent > 40 ? "text-yellow-600" : "text-green-600";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Factory Risk</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-3xl font-bold ${riskColor}`}>{riskPercent}%</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Machines at High Risk</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-3xl font-bold ${highRiskCount > 0 ? "text-red-600" : "text-green-600"}`}>
            {highRiskCount}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Predicted Failures (7d)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-3xl font-bold ${predictedFailures7d > 0 ? "text-yellow-600" : "text-green-600"}`}>
            {predictedFailures7d}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Throughput</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{totalThroughput.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">units/day</p>
        </CardContent>
      </Card>
    </div>
  );
}
