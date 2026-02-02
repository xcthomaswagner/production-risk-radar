# Claude Guide for Production Risk Radar

> **This is a standalone demo project.** It does NOT follow the master CLAUDE.md architecture (Next.js/tRPC/Prisma). Ignore those conventions entirely for this repo.

## Project Overview

Production Risk Radar is an **AI-enhanced digital twin demo** for a Manufacturing Summit. It visualizes predictive maintenance, risk scoring, and throughput forecasting for a simulated factory floor using Azure Digital Twins and Power BI.

## Tech Stack

- **Digital Twin platform:** Azure Digital Twins (ADT)
- **Data ingestion:** Azure IoT Hub
- **AI/ML:** Azure Machine Learning / AutoML
- **Processing:** Azure Functions / Stream Analytics
- **Storage:** Azure Data Explorer / Blob Storage
- **Visualization:** Power BI
- **Twin modeling:** DTDL (Digital Twins Definition Language)

## Domain Model

Hierarchy: **Factory → Line → Machine** (optionally → ProcessStep)

### Twin Types

| Twin Type | Properties | Relationships | AI Elements |
|-----------|-----------|---------------|-------------|
| Factory | Name, Location, OverallRiskScore | HasLines → Line | Aggregated predicted risk |
| Line | Name, LineCapacity, OEE, CurrentThroughput, RiskScore | HasMachines → Machine | Predicted throughput |
| Machine | Name, Type, Status, Temp, Vibration, Power, LastMaintenanceDate, RiskScore, PredictedFailureDate | PartOf → Line | AI-predicted failure, anomaly detection |
| ProcessStep (optional) | StepName, CycleTime, DefectRate, RiskScore | PartOf → Machine | Predicted defect trend |

### AI-Powered Fields

- **RiskScore** (0–1): Predicted probability of machine failure via anomaly detection / predictive ML
- **PredictedFailureDate** (date): Forecasted maintenance or downtime date
- **LineThroughputForecast** (units/day): AI-predicted production capacity
- **EnergyDeviation** (kW): Actual vs expected energy usage anomaly

## Demo Data

Located in `docs/production_risk_radar_demo_data.csv`:

- 1 factory ("Demo Factory")
- 3 production lines (L1, L2, L3)
- 5 machines per line (15 total)
- 24 hours of hourly telemetry (360 rows)
- Columns: Timestamp, Factory, Line, Machine, Temperature_C, Vibration_mm_s, Power_kW, CycleTime_s, Status, RiskScore, PredictedFailureDate, LineThroughputForecast_units_per_day, EnergyDeviation_kW

## Power BI Dashboard Layout

### Top KPI Strip
- Factory Risk (Gauge 0–100, from OverallRiskScore)
- Machines at High Risk (Card, count where RiskScore > 0.7)
- Predicted Failures Next 7 Days (Card)
- Line Throughput Forecast (Card, units/day)

### Main Visuals
- **A. Heatmap:** X=Line, Y=Machine, Color=RiskScore (Green → Yellow → Red). Tooltip: Temp, Vibration, Status, RiskScore, PredictedFailureDate
- **B. Trend Line:** Factory RiskScore over last 24–48h, optionally with AI forecast
- **C. High-Risk Machine Table:** Filtered to RiskScore > 0.7. Columns: Machine, Line, Temp, Vibration, RiskScore, PredictedFailureDate, Status. Drilldown to historical metrics.
- **D. Line Throughput Forecast:** Bar chart — Line vs Predicted throughput, optional actual vs predicted comparison
- **E. Energy / ESG Visual (optional):** Line/heatmap of EnergyDeviation, highlight machines above expected consumption

## Demo Flow (scripted)

1. Show healthy factory baseline — all green, throughput on target
2. Introduce simulated anomaly on Machine L1-M2
3. Heatmap updates — machine turns red
4. Table shows PredictedFailureDate = 2026-02-03
5. Trend line shows factory risk rising, AI predicts impact on production
6. Throughput forecast bar shows possible drop if machine fails
7. (Optional) Energy deviation visual shows excessive consumption

## Design Docs

- `docs/Production Radar.pdf` — Full AI-enhanced demo design (ChatGPT export)
- `docs/Production Risk Radar Spec.docx` — Detailed specification
- `docs/production_risk_radar_demo_data.csv` — Simulated telemetry + AI fields

## Things to Avoid

- Do not apply Next.js/tRPC/Prisma patterns from the master CLAUDE.md
- Do not add web application scaffolding unless explicitly requested
- Keep focus on Azure Digital Twins, DTDL models, Power BI visuals, and demo data
- Do not hardcode secrets or connection strings — use environment variables
