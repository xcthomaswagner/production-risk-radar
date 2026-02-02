# Claude Guide for Production Risk Radar

> **This is a standalone demo project.** It does NOT follow the master CLAUDE.md architecture (Next.js/tRPC/Prisma). Ignore those conventions entirely for this repo.

## Project Overview

Production Risk Radar is an **AI-enhanced digital twin demo** for a Manufacturing Summit. It visualizes predictive maintenance, risk scoring, and throughput forecasting for a simulated factory floor using Azure Digital Twins, Azure Data Explorer, and Power BI.

## Tech Stack

- **Runtime:** Next.js 16 (App Router, TypeScript) — runs locally on macOS as the control panel
- **Digital Twin platform:** Azure Digital Twins (ADT) — stores twin graph (Factory > Lines > Machines)
- **Telemetry store:** Azure Data Explorer (ADX) — stores time-series telemetry + receives ADT Data History
- **Data pipeline:** Event Hub + ADT Data History connection → ADX `AdtPropertyEvents` table
- **Auth:** Azure Service Principal via `ClientSecretCredential`
- **UI:** Tailwind CSS + shadcn/ui
- **Scoring:** Threshold-based TypeScript functions (`src/lib/scoring.ts`)
- **Visualization:** Power BI Desktop via DirectQuery to ADX
- **Testing:** Jest (scoring unit tests + azure-seed mock tests)
- **Twin modeling:** DTDL v2 (3 models in `dtdl/`)

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/azure.ts` | ADT + ADX client singletons, `getTwin()`, `patchTwin()`, `queryTwins()`, `queryAdx()`, `executeAdxCommand()` |
| `src/lib/azure-seed.ts` | `seedAzure()`: delete twins, create 19 twins + 33 relationships, bulk-load 360 telemetry rows |
| `src/lib/scoring.ts` | Pure functions: `calculateRiskScore()`, `calculatePredictedFailureDate()`, `calculateLineThroughput()`, etc. |
| `src/lib/types.ts` | TypeScript interfaces: Machine, Line, Factory, TelemetryReading, DigitalTwin, etc. |
| `src/app/page.tsx` | Status dashboard: KPI cards from ADT, link to Power BI |
| `src/app/control/page.tsx` | Control panel: inject anomalies, reset baseline, re-seed |
| `src/app/api/anomaly/inject/route.ts` | Inject: patch ADT twins + `.set-or-append` ADX row |
| `src/app/api/anomaly/reset/route.ts` | Reset: restore from last baseline telemetry, delete injected rows |

## Domain Model

Hierarchy: **Factory > Line > Machine**

### Twin Types

| Twin Type | Properties | Relationships | AI Elements |
|-----------|-----------|---------------|-------------|
| Factory | Name, Location, OverallRiskScore | HasLines > Line | Aggregated predicted risk |
| Line | Name, LineCapacity, OEE, CurrentThroughput, RiskScore, ThroughputForecast | HasMachines > Machine | Predicted throughput |
| Machine | Name, Type, Status, Temperature, Vibration, Power, CycleTime, RiskScore, PredictedFailureDate, EnergyDeviation | PartOf > Line | AI-predicted failure |

### Property Name Mapping (ADT camelCase > API snake_case)

| ADT twin property | API response field |
|---|---|
| `temperature` | `temperature_c` |
| `vibration` | `vibration_mm_s` |
| `power` | `power_kw` |
| `cycleTime` | `cycle_time_s` |
| `riskScore` | `risk_score` |
| `predictedFailureDate` | `predicted_failure_date` |
| `energyDeviation` | `energy_deviation_kw` |
| `overallRiskScore` | `overall_risk_score` |

### AI-Powered Fields

- **RiskScore** (0-1): Weighted threshold scoring (vibration 45%, temperature 35%, power 10%, cycle time 10%)
- **PredictedFailureDate** (ISO datetime): 14 days at risk 0, 1 day at risk 1
- **ThroughputForecast** (units/day): Baseline 480, blended avg+max risk reduction
- **EnergyDeviation** (kW): Delta from 14 kW nominal

## Demo Data

Located in `data/production_risk_radar_demo_data.csv`:

- 1 factory ("Demo Factory")
- 3 production lines (L1, L2, L3)
- 5 machines per line (15 total)
- 24 hours of hourly telemetry (360 rows)

## Environment Variables

Required in `.env.local`:
- `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` — Service principal auth
- `ADT_INSTANCE_URL` — Azure Digital Twins endpoint
- `ADX_CLUSTER_URL` — Azure Data Explorer cluster URL
- `ADX_DATABASE` — ADX database name
- `POWER_BI_DASHBOARD_URL` — (Optional) Power BI dashboard link

## Power BI Dashboard Layout

### Top KPI Strip
- Factory Risk (Gauge 0-100, from OverallRiskScore)
- Machines at High Risk (Card, count where RiskScore > 0.7)
- Predicted Failures Next 7 Days (Card)
- Line Throughput Forecast (Card, units/day)

### Main Visuals
- **A. Heatmap:** X=Line, Y=Machine, Color=RiskScore (Green > Yellow > Red)
- **B. Trend Line:** Factory RiskScore over last 24-48h (from `AdtPropertyEvents`)
- **C. High-Risk Machine Table:** Filtered to RiskScore > 0.7
- **D. Line Throughput Forecast:** Bar chart - Line vs Predicted throughput
- **E. Energy / ESG Visual (optional):** EnergyDeviation heatmap

Power BI connects to ADX via native DirectQuery connector. Page auto-refresh set to 5-10s.

## Demo Flow (scripted)

1. Show healthy factory baseline — all green, throughput on target
2. Introduce simulated anomaly on Machine L1-M2
3. Heatmap updates — machine turns red (within 5-10s via DirectQuery)
4. Table shows PredictedFailureDate approaching
5. Trend line shows factory risk rising
6. Throughput forecast bar shows possible drop if machine fails
7. (Optional) Energy deviation visual shows excessive consumption

## Design Docs

- `docs/Production Radar.pdf` — Full AI-enhanced demo design
- `docs/Production Risk Radar Spec.docx` — Detailed specification
- `docs/production_risk_radar_demo_data.csv` — Original simulated telemetry

## Things to Avoid

- Do not apply Next.js/tRPC/Prisma patterns from the master CLAUDE.md
- Do not add web application scaffolding unless explicitly requested
- Keep focus on Azure Digital Twins, DTDL models, Power BI visuals, and demo data
- Do not hardcode secrets or connection strings — use environment variables
- Do not import `better-sqlite3` or reference SQLite — the project uses Azure ADT + ADX
