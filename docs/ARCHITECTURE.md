# Production Risk Radar - Architecture Documentation

## Version 1.0 - Current Design

### Overview

Production Risk Radar is a predictive maintenance demo that visualizes real-time equipment health across a simulated factory floor. It demonstrates how Azure Digital Twins and Power BI can provide operational intelligence to factory operators.

### Architecture Diagram

```
┌─────────────────────────┐         ┌──────────────────────────────────────┐
│  Next.js Control Panel  │         │           Azure Cloud                │
│  (localhost:3000)       │         │                                      │
│                         │  REST   │  Azure Digital Twins (ADT)           │
│  • Status dashboard     │────────▶│  • 1 Factory twin                    │
│  • Anomaly injection    │         │  • 3 Line twins (L1, L2, L3)         │
│  • Reset controls       │         │  • 15 Machine twins                  │
│                         │         │                                      │
└─────────────────────────┘         │  Azure Data Explorer (ADX)           │
                                    │  • Telemetry table (360 seed rows)   │
                                    │  • Real-time anomaly inserts         │
                                    │                                      │
                                    │  Power BI (DirectQuery → ADX)        │
                                    │  • Auto-refreshing dashboard         │
                                    └──────────────────────────────────────┘
```

### Data Flow

**Production System (simulated in demo):**
```
Machines (OPC UA) → Edge Gateway → MQTT → Azure IoT Hub → ADT/ADX
```

**Demo System (actual implementation):**
```
Control Panel UI → REST API → Azure Digital Twins + Azure Data Explorer
```

### Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| Control Panel | Next.js 14 (App Router) | Web UI for injecting anomalies and viewing status |
| Digital Twin Platform | Azure Digital Twins | Real-time state model of factory hierarchy |
| Time-Series Storage | Azure Data Explorer | Telemetry history and fast analytical queries |
| Visualization | Power BI (DirectQuery) | Real-time dashboard with heatmaps and KPIs |

### Data Model

**Twin Hierarchy:**
- 1 Factory ("demo-factory")
- 3 Production Lines (L1, L2, L3)
- 15 Machines (L1-M1 through L3-M5)

**Machine Properties:**
| Property | Type | Description |
|----------|------|-------------|
| temperature | number | Temperature in Celsius (normal: 60-80°C) |
| vibration | number | Vibration in mm/s (normal: 0.5-2.5) |
| power | number | Power consumption in kW (normal: 12-16) |
| cycleTime | number | Cycle time in seconds (normal: 25-35) |
| riskScore | number | Calculated failure probability (0-1) |
| predictedFailureDate | datetime | Estimated failure date |
| status | string | "Running", "Warning", "Critical" |

---

## Risk Scoring - Current Implementation

### Location
`src/lib/scoring.ts`

### Formula

The risk score is a **weighted combination** of normalized sensor deviations:

```typescript
riskScore =
  0.45 × vibrationRisk +    // 45% weight - primary failure indicator
  0.35 × temperatureRisk +  // 35% weight - heat stress indicator
  0.10 × powerRisk +        // 10% weight - efficiency indicator
  0.10 × cycleTimeRisk      // 10% weight - performance indicator
```

### Normalization

Each sensor value is normalized to 0-1 based on defined thresholds:

| Sensor | Normal Range | Warning | Critical |
|--------|--------------|---------|----------|
| Temperature | 60-75°C | 75-85°C | >85°C |
| Vibration | 0.5-2.0 mm/s | 2.0-3.5 mm/s | >3.5 mm/s |
| Power | 12-16 kW | deviation >3 kW | deviation >6 kW |
| Cycle Time | 25-35s | 35-42s | >42s |

### Predicted Failure Date

A simple linear estimate based on risk score:

```typescript
daysToFailure = Math.round(14 * (1 - riskScore) + 2)
predictedFailureDate = today + daysToFailure
```

| Risk Score | Days to Failure |
|------------|-----------------|
| 0.2 | ~13 days |
| 0.5 | ~9 days |
| 0.7 | ~6 days |
| 0.9 | ~3 days |

### Limitations of Current Approach

1. **No historical learning** - Formula is static, doesn't learn from actual failures
2. **No pattern recognition** - Doesn't detect complex multi-sensor failure signatures
3. **Linear assumptions** - Real equipment degradation is often non-linear
4. **No contextual factors** - Ignores maintenance history, age, operating conditions
5. **Single-point prediction** - No confidence intervals or probability distributions

---

## Cascade Calculations

When a machine's risk changes, the system recalculates:

### Line Risk Score
```typescript
lineRisk = 0.6 × avgMachineRisk + 0.4 × maxMachineRisk
```
Blend of average (overall health) and max (worst case) gives a balanced view.

### Line Throughput Forecast
```typescript
baseCapacity = 480 units/day
throughputForecast = baseCapacity × (1 - lineRisk × 0.6)
```
High risk reduces predicted output.

### Factory Risk Score
```typescript
factoryRisk = average of all line risk scores
```

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/factory` | GET | Factory + line summary |
| `/api/machines` | GET | All machine states |
| `/api/machines/[id]` | GET | Single machine + recent telemetry |
| `/api/telemetry` | GET | Telemetry history (filterable) |
| `/api/anomaly/inject` | POST | Inject anomaly values |
| `/api/anomaly/reset` | POST | Reset to baseline |
| `/api/seed` | POST | Re-seed all data |
| `/api/twin` | GET | Full digital twin graph |

---

## Demo Flow

1. **Baseline State** - All machines green (risk ~0.2-0.4)
2. **Inject Anomaly** - Operator clicks preset (e.g., "Overheat L1-M2")
3. **Real-time Update** - ADT twin patched, telemetry row inserted to ADX
4. **Cascade Calculation** - Line and factory risk recalculated
5. **Dashboard Refresh** - Power BI shows machine turning red
6. **Reset** - Operator resets to baseline

---

## Technology Choices

### Why Azure Digital Twins?
- Native support for hierarchical models (Factory → Line → Machine)
- Real-time state queries
- DTDL (Digital Twins Definition Language) for schema definition
- Integration with Azure ecosystem

### Why Azure Data Explorer?
- Optimized for time-series telemetry data
- KQL for powerful analytical queries
- Native Power BI connector with DirectQuery
- Handles high-volume sensor data ingestion

### Why Power BI DirectQuery?
- Near-real-time refresh (no manual data import)
- Auto-refresh capability for live demos
- Rich visualization options for industrial dashboards

### Why Next.js for Control Panel?
- Server-side API routes for Azure SDK calls
- React components for interactive UI
- Simple deployment for demo purposes

---

## File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── anomaly/inject/route.ts   # Inject anomalies
│   │   ├── anomaly/reset/route.ts    # Reset to baseline
│   │   ├── factory/route.ts          # Factory summary
│   │   ├── machines/route.ts         # All machines
│   │   ├── machines/[machineId]/route.ts
│   │   ├── telemetry/route.ts        # Telemetry history
│   │   ├── twin/route.ts             # Full twin graph
│   │   └── seed/route.ts             # Re-seed data
│   ├── control/page.tsx              # Control panel UI
│   ├── help/page.tsx                 # Architecture explanation
│   └── page.tsx                      # Status dashboard
├── components/
│   ├── anomaly-controls.tsx          # Preset buttons + custom injection
│   ├── reset-controls.tsx            # Reset buttons
│   ├── control-machine-table.tsx     # Machine status table
│   └── factory-overview.tsx          # KPI cards
├── lib/
│   ├── azure.ts                      # ADT + ADX client singletons
│   ├── azure-seed.ts                 # Seed function
│   ├── scoring.ts                    # Risk calculation formulas
│   ├── constants.ts                  # Thresholds and config
│   ├── validation.ts                 # Zod schemas
│   └── types.ts                      # TypeScript interfaces
└── ...

dtdl/
├── Factory.json                      # Factory twin model
├── Line.json                         # Production line model
└── Machine.json                      # Machine twin model

data/
└── production_risk_radar_demo_data.csv  # Seed telemetry data

docs/
├── ARCHITECTURE.md                   # This file
├── POWERBI_SETUP.md                  # Power BI configuration guide
└── Workflow.png                      # Data flow diagram
```

---

## Azure Resources

| Resource | Name | Region | SKU |
|----------|------|--------|-----|
| Resource Group | rg-production-risk-radar | West US 2 | - |
| Digital Twins | adt-prodriskradar2 | West US 2 | Standard |
| Data Explorer Cluster | adxprodradarw | West US 2 | Dev/Test |
| Data Explorer Database | productionriskradar | - | - |

**Monthly Cost:** ~$98 running 24/7, near-zero if ADX cluster stopped between demos.

---

## What This Demo Demonstrates

1. **Digital Twin Technology** - Virtual model of physical factory
2. **Predictive Maintenance Concept** - Risk scores and failure predictions
3. **Operational Intelligence** - Throughput forecasting based on equipment health
4. **Real-time Visualization** - Power BI auto-refresh showing live state changes
5. **Azure Integration** - ADT + ADX + Power BI working together

---

## What This Demo Does NOT Include

1. **Real ML/AI Models** - Risk scoring is formula-based, not learned
2. **Actual Sensor Integration** - Data is simulated, not from real OPC-UA/MQTT
3. **Historical Training** - No model training on past failure data
4. **Natural Language Insights** - No LLM-generated explanations
5. **Automated Recommendations** - No AI-driven maintenance suggestions

These limitations are addressed in **Version 2.0** (see v2 planning document).
