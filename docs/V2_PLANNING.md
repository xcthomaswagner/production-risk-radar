# Production Risk Radar - Version 2.0 Planning

## Overview

Version 2.0 adds **LLM-powered intelligence** to transform the demo from a visualization tool into an AI-assisted predictive maintenance system.

---

## V1 vs V2 Comparison

| Capability | V1 (Current) | V2 (Planned) |
|------------|--------------|--------------|
| Risk Scoring | Weighted formula | ML model + LLM analysis |
| Failure Prediction | Linear estimate | Time-series forecasting |
| Operator Guidance | None | Natural language recommendations |
| Root Cause Analysis | None | LLM-powered explanation |
| Alert Generation | None | Context-aware smart alerts |
| Maintenance Planning | None | AI-suggested work orders |

---

## Proposed Features

### 1. Risk Explanation (Priority: High)

**What:** "Explain Risk" button that generates natural language explanation of why a machine is at risk.

**User Experience:**
```
Operator clicks "Explain Risk" on L1-M2

AI Response:
"L1-M2 is at HIGH RISK (0.82) due to:

• Temperature: 98°C (23°C above normal operating range of 60-75°C)
  - This level of heat stress accelerates bearing wear

• Vibration: 4.2 mm/s (elevated from baseline 1.8 mm/s)
  - Combined with high temperature, suggests possible bearing degradation

Likely Cause: Insufficient lubrication or bearing wear
Recommended Action: Schedule inspection within 48 hours
Similar Past Incident: L2-M3 showed same pattern before bearing failure in Oct 2025"
```

**Implementation:**
- API endpoint: `POST /api/ai/explain`
- Input: Machine ID + current sensor values + historical context
- LLM: Claude API or Azure OpenAI
- Prompt engineering to ensure consistent, actionable responses

---

### 2. Predictive Maintenance Chat (Priority: High)

**What:** Chat interface where operators can ask questions about equipment health.

**Example Interactions:**
```
Operator: "Which machines should I prioritize for maintenance this week?"

AI: "Based on current risk scores and predicted failure dates, I recommend:

1. L1-M2 (Risk: 0.82) - Predicted failure in 3 days
   - Action: Immediate inspection, likely bearing replacement

2. L2-M5 (Risk: 0.67) - Predicted failure in 6 days
   - Action: Schedule for Thursday maintenance window

3. L3-M3 (Risk: 0.58) - Showing early warning signs
   - Action: Monitor closely, add to next week's schedule

All other machines are operating within normal parameters."
```

```
Operator: "What's causing the vibration issues on Line 2?"

AI: "Line 2 has elevated vibration on 3 machines (L2-M1, L2-M3, L2-M5).

Pattern Analysis:
- All three machines share the same coolant supply line
- Vibration increases correlate with afternoon shift (higher ambient temp)
- Similar pattern occurred in March 2025, resolved by coolant system flush

Recommended Investigation:
1. Check coolant flow rates and temperature
2. Inspect shared hydraulic connections
3. Consider coolant system maintenance"
```

**Implementation:**
- New page: `/chat`
- RAG (Retrieval Augmented Generation) over telemetry history
- Context window includes: current machine states, recent trends, maintenance history
- Streaming responses for better UX

---

### 3. Smart Alerts (Priority: Medium)

**What:** AI-generated alerts that provide context, not just thresholds.

**Current (V1):** No alerts

**V2 Alert Example:**
```
⚠️ ALERT: L1-M2 Temperature Rising

Current: 92°C (↑ 15°C in last 2 hours)
Trend: Accelerating - if unchanged, will reach critical (100°C) in ~45 minutes

Context:
- Vibration also elevated (3.8 mm/s)
- Pattern matches pre-failure signature from L3-M1 incident (Jan 2025)

Risk Assessment: HIGH - 78% probability of unplanned stop within 4 hours

Suggested Actions:
1. Reduce machine load by 20%
2. Dispatch technician for inspection
3. Prepare replacement bearing (Part #BRG-2847)
```

**Implementation:**
- Background job checking for alert conditions
- LLM generates contextual alert message
- Push notifications or dashboard banner
- Alert history stored for pattern learning

---

### 4. Automated Work Order Generation (Priority: Medium)

**What:** AI drafts maintenance work orders based on predictions.

**Example Output:**
```
WORK ORDER #WO-2026-0234 (AI-Generated Draft)

Machine: L1-M2 (CNC Lathe, Line 1)
Priority: HIGH
Requested By: AI Predictive System

Issue Description:
Elevated temperature (98°C) and vibration (4.2 mm/s) indicate probable
bearing degradation. Pattern analysis suggests main spindle bearing.

Recommended Work:
□ Inspect main spindle bearing for wear
□ Check lubrication system flow rate
□ Replace bearing if wear > 0.05mm (Part #BRG-2847)
□ Verify coolant circulation

Estimated Duration: 2-3 hours
Suggested Window: Night shift (minimize production impact)

Parts Needed:
- Spindle Bearing BRG-2847 (check stock: 3 available)
- Lubricant LUB-220 (2 liters)

⚠️ This is an AI-generated draft. Review and approve before scheduling.
```

**Implementation:**
- Button: "Generate Work Order" on high-risk machines
- LLM combines: machine specs, failure prediction, parts inventory, maintenance history
- Output to PDF or integrate with CMMS (Computerized Maintenance Management System)

---

### 5. Anomaly Detection with Explanation (Priority: Medium)

**What:** Replace formula-based scoring with ML anomaly detection + LLM explanation.

**Current (V1):**
```
riskScore = 0.45 × vibration + 0.35 × temp + 0.10 × power + 0.10 × cycle
```

**V2 Approach:**
1. **Anomaly Detection Model** (Azure ML or local)
   - Trained on historical telemetry
   - Detects unusual patterns, not just threshold breaches
   - Outputs anomaly score + contributing factors

2. **LLM Explanation Layer**
   - Takes anomaly detection output
   - Generates human-readable explanation
   - Compares to historical incidents

**Example:**
```
Anomaly Detected: L2-M3

The ML model detected an unusual pattern (confidence: 94%):
- Power consumption is 18.5 kW (normal: 14 kW)
- BUT temperature is only 68°C (normal)

This is unusual because high power typically correlates with high temperature.
Possible explanations:
1. Electrical fault causing energy waste
2. Motor working harder due to mechanical resistance
3. Sensor calibration issue (less likely - other sensors normal)

This pattern was seen once before on L1-M4 (Aug 2025) - root cause was
worn drive belt causing motor strain.
```

---

### 6. Failure Prediction with Confidence (Priority: Low)

**What:** Replace linear estimate with probabilistic prediction.

**Current (V1):**
```
Predicted Failure: February 8, 2026
```

**V2:**
```
Failure Probability (next 14 days):

Days 1-3:   ████████████████████ 85%
Days 4-7:   ██████████░░░░░░░░░░ 12%
Days 8-14:  ██░░░░░░░░░░░░░░░░░░  3%

Most Likely Failure Window: Feb 5-7, 2026
Confidence: High (based on 847 similar historical patterns)

Key Factors:
• Vibration trend (↑ 0.3 mm/s per day)
• Temperature-vibration correlation (r=0.89)
• Machine age: 4.2 years (avg failure at 4.5 years for this model)
```

**Implementation:**
- Time-series model (Prophet, LSTM, or Azure AutoML)
- Trained on run-to-failure datasets
- Outputs probability distribution, not point estimate
- LLM translates statistical output to operator-friendly language

---

## Technical Architecture (V2)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Next.js Application                         │
├─────────────────────────────────────────────────────────────────────┤
│  Control Panel  │  Chat Interface  │  Alert Dashboard  │  Reports   │
└────────┬────────┴────────┬─────────┴─────────┬─────────┴────────────┘
         │                 │                   │
         ▼                 ▼                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         API Layer                                    │
├─────────────────────────────────────────────────────────────────────┤
│  /api/ai/explain     │  /api/ai/chat    │  /api/ai/alerts           │
│  /api/ai/workorder   │  /api/ai/predict │  /api/ai/anomaly          │
└────────┬─────────────┴────────┬─────────┴─────────┬─────────────────┘
         │                      │                   │
         ▼                      ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Claude API    │  │  Azure OpenAI   │  │   Azure ML      │
│   (LLM)         │  │  (Alternative)  │  │ (Anomaly Det.)  │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         └──────────────┬─────┴────────────────────┘
                        │
                        ▼
         ┌──────────────────────────────┐
         │   Context Assembly Layer     │
         │  • Current machine state     │
         │  • Historical telemetry      │
         │  • Maintenance records       │
         │  • Similar past incidents    │
         └──────────────┬───────────────┘
                        │
         ┌──────────────┴───────────────┐
         │                              │
         ▼                              ▼
┌─────────────────┐          ┌─────────────────┐
│ Azure Digital   │          │ Azure Data      │
│ Twins (ADT)     │          │ Explorer (ADX)  │
└─────────────────┘          └─────────────────┘
```

---

## Implementation Phases

### Phase 1: Risk Explanation (1-2 days)
- [ ] Add Claude API integration
- [ ] Create `/api/ai/explain` endpoint
- [ ] Build prompt template for risk explanation
- [ ] Add "Explain Risk" button to control panel
- [ ] Display explanation in modal or side panel

### Phase 2: Chat Interface (2-3 days)
- [ ] Create `/chat` page with chat UI
- [ ] Implement `/api/ai/chat` with streaming
- [ ] Build context assembly (current state + history)
- [ ] Add conversation memory (session-based)
- [ ] Test with common operator questions

### Phase 3: Smart Alerts (1-2 days)
- [ ] Define alert trigger conditions
- [ ] Create alert generation prompt
- [ ] Build alert UI component
- [ ] Add alert history storage

### Phase 4: Work Order Generation (1 day)
- [ ] Create work order prompt template
- [ ] Build PDF generation
- [ ] Add "Generate Work Order" button

### Phase 5: Advanced ML (Future)
- [ ] Train anomaly detection model on telemetry
- [ ] Integrate Azure ML endpoint
- [ ] Replace formula-based scoring
- [ ] Add confidence intervals to predictions

---

## LLM Prompt Examples

### Risk Explanation Prompt

```
You are an industrial maintenance AI assistant analyzing equipment health data.

Machine: {machine_id}
Type: CNC Lathe
Current Readings:
- Temperature: {temperature}°C (normal range: 60-75°C)
- Vibration: {vibration} mm/s (normal range: 0.5-2.5 mm/s)
- Power: {power} kW (normal range: 12-16 kW)
- Cycle Time: {cycle_time}s (normal range: 25-35s)

Risk Score: {risk_score} (0-1 scale, >0.7 is high risk)
Predicted Failure: {predicted_failure_date}

Recent Trend (last 24 hours):
{trend_data}

Similar Past Incidents:
{similar_incidents}

Provide a concise explanation for the maintenance operator:
1. Why is this machine at this risk level?
2. What is the most likely root cause?
3. What action should the operator take?
4. How urgent is this?

Keep the response under 200 words. Use plain language, not technical jargon.
```

### Chat System Prompt

```
You are a predictive maintenance AI assistant for a manufacturing facility.

You have access to:
- Real-time sensor data from 15 machines across 3 production lines
- Risk scores and failure predictions for each machine
- Historical telemetry and maintenance records

Current Factory State:
{factory_state_json}

Guidelines:
- Be concise and actionable
- Prioritize safety and production continuity
- If uncertain, say so and recommend inspection
- Reference specific machines by ID (e.g., L1-M2)
- Suggest concrete next steps, not vague advice

Answer the operator's question:
```

---

## Environment Variables (V2 Additions)

```env
# LLM Configuration
ANTHROPIC_API_KEY=sk-ant-...           # For Claude API
# OR
AZURE_OPENAI_ENDPOINT=https://...      # For Azure OpenAI
AZURE_OPENAI_KEY=...
AZURE_OPENAI_DEPLOYMENT=gpt-4

# Feature Flags
ENABLE_AI_FEATURES=true
ENABLE_CHAT=true
ENABLE_SMART_ALERTS=true
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Explanation accuracy | Operators rate 80%+ as "helpful" |
| Chat response time | <3 seconds for simple queries |
| Alert relevance | <10% false positive rate |
| Work order quality | 90%+ require no major edits |

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| LLM hallucination | Ground responses in actual data, add disclaimers |
| Slow response time | Use streaming, cache common queries |
| Cost overrun | Set token limits, batch requests |
| Operator over-reliance | Clear "AI suggestion" labeling, require human approval |

---

## Open Questions

1. **Claude vs Azure OpenAI?**
   - Claude: Better reasoning, but separate vendor
   - Azure OpenAI: Native Azure integration, but GPT-4 may be less capable for technical analysis

2. **How much history to include in context?**
   - More history = better answers but higher cost and latency
   - Start with 24-hour window, expand if needed

3. **Should alerts auto-generate or require trigger?**
   - Auto: More proactive but risk of alert fatigue
   - Manual: Operator control but might miss issues

4. **Integration with existing CMMS?**
   - For demo: PDF export is sufficient
   - For production: Would need API integration with SAP PM, Maximo, etc.
