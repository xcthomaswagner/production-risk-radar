# Power BI Setup Guide (Azure Data Explorer)

This guide connects Power BI Desktop to Azure Data Explorer (ADX) via the native ADX connector with DirectQuery, so the dashboard auto-refreshes when you inject anomalies from the Next.js control panel.

## Prerequisites

- Windows machine (or Parallels VM on macOS) with Power BI Desktop installed
- Azure Data Explorer cluster running (`az kusto cluster start` if stopped)
- Production Risk Radar seeded (`pnpm azure:seed` or `pnpm azure:provision`)

## Step 1: Install Power BI Desktop

Open the **Microsoft Store** on Windows, search for **"Power BI Desktop"**, and install it.

Alternatively, download from https://powerbi.microsoft.com/desktop/

## Step 2: Connect Power BI to Azure Data Explorer

1. Open **Power BI Desktop**
2. Click **Get Data** on the Home ribbon
3. Search for **"Azure Data Explorer (Kusto)"** and select it
4. Enter:
   - **Cluster URL:** `https://adxprodriskradar.eastus.kusto.windows.net`
   - **Database:** `productionriskradar`
5. Select **DirectQuery** mode (not Import)
6. Sign in with your Azure credentials when prompted

## Step 3: Add KQL Queries as Data Sources

For each visual, add a new data source using a KQL query:

### Machine Current State

```kql
Telemetry | summarize arg_max(timestamp, *) by machine_id
```

### Risk Heatmap Data

```kql
Telemetry | summarize arg_max(timestamp, *) by machine_id
| extend line = substring(machine_id, 0, 2)
| project line, machine_id, risk_score, temperature_c, vibration_mm_s
```

### Trend Line (from ADT Data History)

```kql
AdtPropertyEvents
| where ModelId == "dtmi:com:productionriskradar:Machine;1"
| where Key == "riskScore"
| project TimeStamp, Id, RiskScore = todouble(Value)
| order by TimeStamp asc
```

### High-Risk Machines

```kql
Telemetry | summarize arg_max(timestamp, *) by machine_id
| where risk_score > 0.7
```

### Line Throughput

```kql
Telemetry | summarize arg_max(timestamp, *) by machine_id
| extend line = substring(machine_id, 0, 2)
| summarize avg_risk = avg(risk_score), max_risk = max(risk_score) by line
| extend blended_risk = 0.6 * avg_risk + 0.4 * max_risk
| extend throughput_forecast = round(480 * (1 - blended_risk * 0.6))
| project line, throughput_forecast, line_capacity = 480
```

## Step 4: Build the Dashboard Visuals

### Top KPI Strip

| Visual | Type | Configuration |
|--------|------|---------------|
| Factory Risk | **Gauge** | KQL: avg of risk_score across all machines * 100. Min: 0, Max: 100. |
| High Risk Count | **Card** | KQL: count where risk_score > 0.7 |
| Predicted Failures | **Card** | KQL: count where predicted_failure_date < now()+7d |
| Throughput | **Card** | Sum of line throughput forecasts |

### Main Visuals

| Visual | Type | Configuration |
|--------|------|---------------|
| **Risk Heatmap** | **Matrix** | Rows: machine_id, Columns: line, Values: risk_score. Gradient: green (0) > yellow (0.5) > red (1.0). |
| **Throughput Bar** | **Clustered Bar** | Axis: line. Values: throughput_forecast + line_capacity (480). |
| **High-Risk Table** | **Table** | Columns: machine_id, line, temperature_c, vibration_mm_s, risk_score, predicted_failure_date. |
| **Trend Line** | **Line Chart** | Axis: TimeStamp, Values: RiskScore, Legend: Id. |

### Conditional Formatting for Heatmap

1. Click on the Matrix visual
2. Go to **Format** > **Cell elements** > **Background color**
3. Click **fx** (conditional formatting)
4. Set gradient:
   - Minimum: 0 = Green (#22c55e)
   - Center: 0.5 = Yellow (#eab308)
   - Maximum: 1.0 = Red (#ef4444)

## Step 5: Enable Page Auto-Refresh

DirectQuery does NOT auto-refresh by default. To enable:

1. Go to **Format** pane > **Page information** (or **Page refresh**)
2. Turn on **Page refresh**
3. Set interval to **5 seconds** (or 10 seconds for lower ADX load)
4. Note: Auto-refresh intervals below 30 seconds may require Admin settings to be enabled

This ensures the dashboard updates automatically after anomaly injection without manual Ctrl+F5.

## Step 6: Demo Flow

1. On macOS: open `/control` and click **"Overheat L1-M2"**
2. Power BI auto-refreshes within 5-10 seconds (DirectQuery + page refresh)
3. The heatmap cell for L1-M2 turns red, factory gauge rises, throughput drops
4. Repeat with other presets or custom injections
5. Use **"Reset to Baseline"** to return to the healthy state

No manual refresh needed — DirectQuery with page auto-refresh handles it automatically.

## Troubleshooting

### ADX cluster is paused

The Dev/Test cluster can be stopped to save costs. Start it:

```bash
az kusto cluster start --cluster-name adxprodriskradar --resource-group rg-production-risk-radar
```

Wait 5-10 minutes for the cluster to warm up.

### Authentication fails

Ensure your Azure account has at least **Database Viewer** permission on the ADX database. The service principal used by the app has Database Admin, but your personal login may need separate access:

```bash
az kusto database-principal-assignment create \
  --cluster-name adxprodriskradar --resource-group rg-production-risk-radar \
  --database-name productionriskradar \
  --principal-assignment-name "user-viewer" \
  --principal-id <your-azure-ad-object-id> \
  --principal-type User --role Viewer
```

### No data in Power BI

1. Verify data exists in ADX: run `Telemetry | count` in the ADX query editor
2. If empty, re-seed: `pnpm azure:seed`
3. Check that the cluster URL and database name match your `.env.local`

### Page auto-refresh not working

In Power BI Desktop, auto-refresh for DirectQuery may need to be enabled:
- File > Options and settings > Options > Current file > Query reduction
- Ensure "Auto page refresh" is not disabled
