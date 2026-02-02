# Azure Migration Notes

> Internal notes for Claude Code context continuity. Written at the end of v1.0.0 implementation session.

## Current State (v1.0.0)

### What exists
- Next.js 15 App Router app with SQLite (better-sqlite3, WAL mode)
- Dashboard (`/`) and Control Panel (`/control`) — fully working
- 8 API routes under `src/app/api/`
- Scoring engine in `src/lib/scoring.ts` (pure functions, no dependencies)
- Seed pipeline parsing CSV into SQLite (`src/lib/seed.ts`)
- Mock ADT twin module in `src/lib/twin.ts` (already shapes data like ADT API responses)
- DTDL v2 models in `dtdl/` (Factory.json, Line.json, Machine.json) — static, not yet uploaded to ADT
- 31 passing tests (19 scoring, 12 DB/seed)
- Power BI connects via ODBC to SQLite on Windows VM in Parallels

### Key files to modify during migration
- `src/lib/db.ts` — singleton SQLite connection (replace with Azure data layer)
- `src/lib/seed.ts` — seeds SQLite from CSV (replace with ADT/ADX ingestion)
- `src/lib/twin.ts` — mock ADT module (replace with real `@azure/digital-twins-core`)
- `src/app/api/**` — all routes query SQLite directly (switch to Azure backend)
- `src/app/page.tsx` — server component reads from SQLite
- `scripts/init-schema.ts` — SQLite schema (may become ADT model upload + ADX table creation)

### What can stay unchanged
- `src/lib/scoring.ts` — pure functions, no DB dependency
- `src/lib/types.ts` — domain interfaces (may need minor additions)
- `src/lib/__tests__/scoring.test.ts` — tests for pure scoring functions
- `dtdl/*.json` — already written, ready to upload to ADT
- All UI components (`src/components/*`) — they consume props, not DB directly
- `src/app/control/page.tsx` — client component, calls APIs via fetch

### Architecture decisions already made
- Scoring weights: vibration 0.45, temperature 0.35, power 0.10, cycle_time 0.10
- Thresholds: temp nominal=65/critical=95, vib nominal=1.0/critical=5.0, power deviation critical=8kW, cycle nominal=28/critical=45
- Throughput: baseline 480 units/day, blended = 0.6*avg + 0.4*max, reduction factor 0.6
- Failure prediction: daysOut = 14 - riskScore * 13

## Azure Target Architecture

Based on the plan and CLAUDE.md, the target stack is:

```
IoT Hub → Stream Analytics → Azure Digital Twins (ADT)
                                    ↓
                              Azure Data Explorer (ADX)
                                    ↓
                              Power BI (DirectQuery or Import)
```

### Azure services needed
1. **Azure Digital Twins (ADT)** — twin graph (Factory → Lines → Machines), upload DTDL models
2. **Azure IoT Hub** — simulated device telemetry ingestion
3. **Azure Stream Analytics** or **Azure Functions** — process telemetry, update twins
4. **Azure Data Explorer (ADX)** — time-series telemetry storage (replaces SQLite telemetry table)
5. **Power BI** — connects to ADX via native connector (replaces ODBC/SQLite)

### Migration strategy (suggested)
1. Provision Azure resources (ADT, ADX, IoT Hub)
2. Upload DTDL models to ADT (`dtdl/*.json`)
3. Create ADT twin instances (1 factory, 3 lines, 15 machines)
4. Set up ADX database + tables for telemetry
5. Create ADT → ADX data history connection (built-in feature)
6. Replace `src/lib/db.ts` with Azure clients (`@azure/digital-twins-core`, `@azure/data-explorer`)
7. Update API routes to read/write ADT twins instead of SQLite
8. Update anomaly inject to update ADT twin properties (triggers ADX history)
9. Connect Power BI to ADX (native connector, no ODBC needed)
10. Optionally keep SQLite as local dev fallback

### Power BI changes
- **Current:** ODBC → SQLite file via Parallels shared folder
- **Target:** Native ADX connector (DirectQuery for real-time, or Import with scheduled refresh)
- The visual layout stays the same — just swap the data source
- DirectQuery against ADX gives near-real-time refresh without manual Ctrl+F5

### Environment variables needed
```
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
ADT_INSTANCE_URL=https://<instance>.api.<region>.digitaltwins.azure.net
ADX_CLUSTER_URL=https://<cluster>.<region>.kusto.windows.net
ADX_DATABASE=production-risk-radar
IOT_HUB_CONNECTION_STRING=
```

### NPM packages to add
- `@azure/digital-twins-core`
- `@azure/identity` (DefaultAzureCredential)
- `@azure/data-explorer` (or `azure-kusto-data` + `azure-kusto-ingest`)

### Git info
- Remote: `git@github.com:xcthomaswagner/production-risk-radar.git`
- Current version: v1.0.0 (tagged + released)
- Branch: main
- All clean, no pending changes

## Demo data reference
- 1 factory ("Demo Factory"), factory_id = "demo-factory"
- 3 lines: L1, L2, L3 (capacity 480 units/day each)
- 15 machines: L1-M1 through L3-M5
- 360 telemetry rows (24 hours × 15 machines)
- CSV at: `data/production_risk_radar_demo_data.csv`
