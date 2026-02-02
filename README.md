# Production Risk Radar

AI-Enhanced Digital Twin Dashboard for Manufacturing Summit demo. Visualizes predictive maintenance, risk scoring, and throughput forecasting for a simulated factory floor using Azure Digital Twins and Power BI.

## Architecture

```
Next.js (local macOS)                    Azure Cloud
┌──────────────────┐      ┌──────────────────────────────────────┐
│  /              status   │                                      │
│  /control    inject/reset│  Azure Digital Twins (ADT)           │
│                  │──────>│  ├─ Factory twin                     │
│  /api/*   REST   │       │  ├─ 3 Line twins                    │
│                  │       │  └─ 15 Machine twins                │
│                  │       │         │ Data History               │
│                  │       │         v                            │
│                  │──────>│  Azure Data Explorer (ADX)           │
│                  │       │  ├─ Telemetry table (360 seed rows) │
│                  │       │  └─ AdtPropertyEvents (auto)        │
└──────────────────┘       │                                      │
                           │  Power BI (DirectQuery -> ADX)       │
                           └──────────────────────────────────────┘
```

Next.js runs locally as the control panel. Azure Digital Twins stores the twin graph. Azure Data Explorer stores telemetry. Power BI connects to ADX via DirectQuery for near-real-time visualization.

## Tech Stack

- **Runtime:** Next.js 16 (App Router, TypeScript)
- **Digital Twins:** Azure Digital Twins (ADT) with DTDL v2 models
- **Telemetry Store:** Azure Data Explorer (ADX) Dev/Test SKU
- **Data Pipeline:** Event Hub + ADT Data History connection
- **UI:** Tailwind CSS + shadcn/ui
- **Scoring:** Threshold-based TypeScript functions (no ML dependencies)
- **Visualization:** Power BI Desktop via DirectQuery to ADX
- **Testing:** Jest (scoring + azure-seed mock tests)
- **Auth:** Azure Service Principal (ClientSecretCredential)

## Quick Start

### Prerequisites

1. Azure CLI installed with IoT extension (`az extension add --name azure-iot`)
2. Azure resources provisioned (see Phase 1 in migration plan)
3. `.env.local` configured with Azure credentials

### Setup

```bash
# Install dependencies
pnpm install

# Upload DTDL models + create twins + seed ADX telemetry
pnpm azure:provision

# Start dev server
pnpm dev
```

Open http://localhost:3000 for the status dashboard, http://localhost:3000/control for the control panel.

### Re-seed (reset to baseline)

```bash
pnpm azure:seed
```

Or use the "Re-seed" button in the control panel at `/control`.

## Demo Flow

1. **Show healthy baseline** -- Dashboard at `/` shows KPI cards, all machines green in Power BI
2. **Inject anomaly** -- Go to `/control`, click "Overheat L1-M2"
3. **See impact** -- Power BI auto-refreshes (5-10s): L1-M2 turns red, factory risk rises, L1 throughput drops
4. **Escalate** -- Click "Cascade Failure" to hit 3 machines across all lines
5. **Custom injection** -- Pick any machine, drag sliders, see live risk preview
6. **Reset** -- Click "Reset to Baseline" to return everything to green
7. **Power BI** -- Dashboard updates automatically via DirectQuery

## Domain Model

**Hierarchy:** Factory > Line (3) > Machine (5 per line = 15 total)

| AI Field | Description |
|----------|-------------|
| RiskScore (0-1) | Weighted: vibration 45%, temperature 35%, power 10%, cycle time 10% |
| PredictedFailureDate | Inverse of risk: 0.0 = 14 days out, 1.0 = 1 day out |
| ThroughputForecast | Baseline 480 units/day, reduced by blended avg+max risk |
| EnergyDeviation | Delta from 14 kW nominal |

## API Routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/factory` | Factory + lines aggregate from ADT |
| GET | `/api/machines` | All 15 machines from ADT |
| GET | `/api/machines/[id]` | Single machine + 24h telemetry from ADT + ADX |
| GET | `/api/telemetry` | Filtered telemetry history from ADX |
| POST | `/api/anomaly/inject` | Inject anomaly: patch ADT twins + insert ADX row |
| POST | `/api/anomaly/reset` | Reset machine(s): restore from last baseline telemetry |
| POST | `/api/seed` | Re-seed ADT twins + ADX telemetry from CSV |
| GET | `/api/twin` | Full ADT twin graph (Factory > Lines > Machines) |

## Scripts

```bash
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm lint             # ESLint
pnpm typecheck        # TypeScript check
pnpm test             # Run Jest tests
pnpm azure:provision  # Upload DTDL models + create twins + seed ADX
pnpm azure:seed       # Re-seed twins + ADX telemetry from CSV
```

## Project Structure

```
src/
  app/
    page.tsx                    # Status dashboard (async server component)
    control/page.tsx            # Control panel (client component)
    api/                        # 8 API routes (ADT + ADX)
  components/
    factory-overview.tsx        # KPI cards
    heatmap-grid.tsx            # Risk heatmap (used by Power BI now)
    machine-table.tsx           # Machine details table
    anomaly-controls.tsx        # Preset + custom injection
    reset-controls.tsx          # Reset + re-seed buttons
    control-machine-table.tsx   # Polling machine table (2s refresh)
    ui/                         # shadcn/ui components
  lib/
    azure.ts                    # ADT + ADX client singletons + helpers
    azure-seed.ts               # CSV parser + Azure seeder
    scoring.ts                  # Risk scoring engine
    types.ts                    # TypeScript interfaces
    __tests__/
      scoring.test.ts           # 19 scoring unit tests
      azure-seed.test.ts        # Azure seed mock tests
scripts/
  azure-provision-twins.ts      # One-time: DTDL upload + twin creation + seed
  seed-azure.ts                 # Repeatable: re-seed twins + ADX
dtdl/
  Factory.json                  # DTDL v2 model
  Line.json                     # DTDL v2 model
  Machine.json                  # DTDL v2 model
data/
  production_risk_radar_demo_data.csv   # 360 rows of demo telemetry
```

## Power BI Integration

See [docs/POWERBI_SETUP.md](docs/POWERBI_SETUP.md) for connecting Power BI Desktop to Azure Data Explorer via the native ADX connector with DirectQuery.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your Azure credentials:

| Variable | Description |
|----------|-------------|
| `AZURE_TENANT_ID` | Azure AD tenant ID |
| `AZURE_CLIENT_ID` | Service principal app ID |
| `AZURE_CLIENT_SECRET` | Service principal secret |
| `ADT_INSTANCE_URL` | Azure Digital Twins instance URL |
| `ADX_CLUSTER_URL` | Azure Data Explorer cluster URL |
| `ADX_DATABASE` | ADX database name |
| `POWER_BI_DASHBOARD_URL` | (Optional) Link to Power BI dashboard |

## Cost

| Resource | Monthly Cost |
|----------|-------------|
| ADX Dev/Test cluster | ~$86 (stop when not demoing) |
| ADT instance | ~$1 (minimal demo usage) |
| Event Hub Standard | ~$11 base |
| **Total** | **~$98** (near-zero if cluster stopped) |

## License

Private -- Manufacturing Summit demo.
