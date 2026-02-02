# Production Risk Radar

AI-Enhanced Digital Twin Dashboard for Manufacturing Summit demo. Visualizes predictive maintenance, risk scoring, and throughput forecasting for a simulated factory floor.

## Architecture

```
+-------------------------------+     +----------------------+
|  Next.js App (macOS)          |     |  Power BI Desktop    |
|                               |     |  (Windows/Parallels) |
|  /          Dashboard         |     |                      |
|  /control   Control Panel     |     |  Heatmap, KPIs,      |
|             - Inject anomaly  |     |  Trend lines, Tables |
|             - Reset baseline  |     |                      |
|             - Re-seed         |     +----------+-----------+
|                               |                | ODBC
|  /api/*     REST endpoints    |                |
+------------+------------------+     +----------v-----------+
             |                        |                      |
             +----------->----------->|  SQLite (factory.db) |
                  better-sqlite3      |  WAL mode            |
                                      +----------------------+
```

SQLite is the shared data layer. WAL mode enables concurrent reads from Power BI while Next.js writes.

## Tech Stack

- **Runtime:** Next.js 15 (App Router, TypeScript)
- **Database:** SQLite via better-sqlite3
- **UI:** Tailwind CSS + shadcn/ui
- **Scoring:** Threshold-based TypeScript functions (no ML dependencies)
- **Visualization:** Power BI Desktop via ODBC
- **Testing:** Jest (31 tests)
- **Twin Models:** DTDL v2 (static JSON for future Azure Digital Twins)

## Quick Start

```bash
# Install dependencies
pnpm install

# Initialize and seed the database
pnpm db:reset

# Start dev server
pnpm dev
```

Open http://localhost:3000 for the dashboard, http://localhost:3000/control for the control panel.

## Demo Flow

1. **Show healthy baseline** -- Dashboard at `/` shows all machines green, throughput near 480/line
2. **Inject anomaly** -- Go to `/control`, click "Overheat L1-M2"
3. **See impact** -- Back to `/`, L1-M2 turns red, factory risk rises, L1 throughput drops
4. **Escalate** -- Click "Cascade Failure" to hit 3 machines across all lines
5. **Custom injection** -- Pick any machine, drag sliders, see live risk preview
6. **Reset** -- Click "Reset to Baseline" to return everything to green
7. **Power BI** -- Switch to Parallels, Ctrl+F5 to refresh after each action

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
| GET | `/api/factory` | Factory + lines aggregate |
| GET | `/api/machines` | All 15 machines |
| GET | `/api/machines/[id]` | Single machine + 24h telemetry |
| GET | `/api/telemetry` | Filtered telemetry history |
| POST | `/api/anomaly/inject` | Inject anomaly with cascade recalculation |
| POST | `/api/anomaly/reset` | Reset machine(s) to baseline |
| POST | `/api/seed` | Re-seed database from CSV |
| GET | `/api/twin` | Mock Azure Digital Twins graph |

## Scripts

```bash
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm lint         # ESLint
pnpm typecheck    # TypeScript check
pnpm test         # Run 31 Jest tests
pnpm db:init      # Create schema only
pnpm db:seed      # Seed from CSV
pnpm db:reset     # Init schema + seed
```

## Project Structure

```
src/
  app/
    page.tsx                    # Dashboard (server component)
    control/page.tsx            # Control panel (client component)
    api/                        # 8 API routes
  components/
    factory-overview.tsx        # KPI cards
    heatmap-grid.tsx            # Risk heatmap (3x5 grid)
    machine-table.tsx           # Full machine details table
    anomaly-controls.tsx        # Preset + custom injection
    reset-controls.tsx          # Reset + re-seed buttons
    control-machine-table.tsx   # Polling machine table (2s refresh)
    ui/                         # shadcn/ui components
  lib/
    db.ts                       # SQLite singleton (WAL mode)
    scoring.ts                  # Risk scoring engine
    seed.ts                     # CSV parser + database seeder
    twin.ts                     # Mock Azure Digital Twins module
    types.ts                    # TypeScript interfaces
    __tests__/
      scoring.test.ts           # 19 scoring unit tests
      db.test.ts                # 12 DB/seed integration tests
scripts/
  init-schema.ts                # Schema creation (5 tables, 4 indexes)
  seed-db.ts                    # CLI seed wrapper
dtdl/
  Factory.json                  # DTDL v2 model
  Line.json                     # DTDL v2 model
  Machine.json                  # DTDL v2 model
data/
  production_risk_radar_demo_data.csv   # 360 rows of demo telemetry
docs/
  Production Radar.pdf          # Design document
  Production Risk Radar Spec.docx
  production_risk_radar_demo_data.csv   # Original CSV
```

## Power BI Integration

See [docs/POWERBI_SETUP.md](docs/POWERBI_SETUP.md) for step-by-step instructions on setting up Power BI Desktop in Parallels to connect to the live SQLite database.

## License

Private -- Manufacturing Summit demo.
