"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

// Anomaly presets
const PRESETS = [
  {
    name: "Overheat L1-M2",
    description: "Temperature spike to 98°C on L1-M2",
    payload: { machine_id: "L1-M2", temperature_c: 98, vibration_mm_s: 2.0 },
  },
  {
    name: "Vibration Spike L2-M3",
    description: "Vibration anomaly to 5.5 mm/s on L2-M3",
    payload: { machine_id: "L2-M3", vibration_mm_s: 5.5 },
  },
  {
    name: "Power Surge L3-M1",
    description: "Power consumption spike to 24 kW on L3-M1",
    payload: { machine_id: "L3-M1", power_kw: 24 },
  },
  {
    name: "Cascade Failure",
    description: "Multiple anomalies: L1-M2 overheat + L2-M3 vibration + L3-M1 power",
    payload: { machine_id: "L1-M2", temperature_c: 95, vibration_mm_s: 4.5 },
    // This preset triggers multiple inject calls
    cascade: [
      { machine_id: "L2-M3", vibration_mm_s: 5.0, temperature_c: 85 },
      { machine_id: "L3-M1", power_kw: 22, cycle_time_s: 42 },
    ],
  },
];

const MACHINE_IDS = [
  "L1-M1", "L1-M2", "L1-M3", "L1-M4", "L1-M5",
  "L2-M1", "L2-M2", "L2-M3", "L2-M4", "L2-M5",
  "L3-M1", "L3-M2", "L3-M3", "L3-M4", "L3-M5",
];

interface AnomalyControlsProps {
  onInject?: () => void;
}

export function AnomalyControls({ onInject }: AnomalyControlsProps) {
  const [selectedMachine, setSelectedMachine] = useState("L1-M2");
  const [temperature, setTemperature] = useState(70);
  const [vibration, setVibration] = useState(2.0);
  const [power, setPower] = useState(14);
  const [cycleTime, setCycleTime] = useState(30);
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  // Calculate estimated risk preview
  const estimatedRisk = Math.min(1, Math.max(0,
    0.45 * Math.max(0, Math.min(1, (vibration - 1.0) / (5.0 - 1.0))) +
    0.35 * Math.max(0, Math.min(1, (temperature - 65) / (95 - 65))) +
    0.10 * Math.max(0, Math.min(1, Math.abs(power - 14) / 8)) +
    0.10 * Math.max(0, Math.min(1, (cycleTime - 28) / (45 - 28)))
  ));

  async function injectPreset(preset: typeof PRESETS[number]) {
    setLoading(true);
    setLastResult(null);
    try {
      const res = await fetch("/api/anomaly/inject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preset.payload),
      });
      const data = await res.json();

      // Handle cascade presets
      if ("cascade" in preset && preset.cascade) {
        for (const cascadePayload of preset.cascade) {
          await fetch("/api/anomaly/inject", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(cascadePayload),
          });
        }
      }

      setLastResult(`${preset.name}: Risk → ${(data.machine?.risk_score * 100).toFixed(0)}%`);
      onInject?.();
    } catch {
      setLastResult("Error injecting anomaly");
    } finally {
      setLoading(false);
    }
  }

  async function injectCustom() {
    setLoading(true);
    setLastResult(null);
    try {
      const res = await fetch("/api/anomaly/inject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          machine_id: selectedMachine,
          temperature_c: temperature,
          vibration_mm_s: vibration,
          power_kw: power,
          cycle_time_s: cycleTime,
        }),
      });
      const data = await res.json();
      setLastResult(`${selectedMachine}: Risk → ${(data.machine?.risk_score * 100).toFixed(0)}%`);
      onInject?.();
    } catch {
      setLastResult("Error injecting anomaly");
    } finally {
      setLoading(false);
    }
  }

  const riskPreviewColor = estimatedRisk > 0.7 ? "text-red-600" : estimatedRisk > 0.4 ? "text-yellow-600" : "text-green-600";

  return (
    <div className="space-y-4">
      {/* Presets */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Anomaly Presets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {PRESETS.map(preset => (
            <Button
              key={preset.name}
              variant="outline"
              className="w-full justify-start"
              disabled={loading}
              onClick={() => injectPreset(preset)}
            >
              <div className="text-left">
                <div className="font-semibold">{preset.name}</div>
                <div className="text-xs text-muted-foreground">{preset.description}</div>
              </div>
            </Button>
          ))}
        </CardContent>
      </Card>

      <Separator />

      {/* Custom injection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Custom Injection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Machine</label>
            <Select value={selectedMachine} onValueChange={setSelectedMachine}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MACHINE_IDS.map(id => (
                  <SelectItem key={id} value={id}>{id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              Temperature: {temperature}°C
            </label>
            <Slider
              value={[temperature]}
              onValueChange={([v]) => setTemperature(v)}
              min={50}
              max={110}
              step={1}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              Vibration: {vibration.toFixed(1)} mm/s
            </label>
            <Slider
              value={[vibration]}
              onValueChange={([v]) => setVibration(v)}
              min={0}
              max={8}
              step={0.1}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              Power: {power} kW
            </label>
            <Slider
              value={[power]}
              onValueChange={([v]) => setPower(v)}
              min={5}
              max={30}
              step={0.5}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              Cycle Time: {cycleTime}s
            </label>
            <Slider
              value={[cycleTime]}
              onValueChange={([v]) => setCycleTime(v)}
              min={20}
              max={55}
              step={1}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-muted-foreground">Estimated Risk: </span>
              <span className={`font-bold ${riskPreviewColor}`}>{(estimatedRisk * 100).toFixed(0)}%</span>
            </div>
            <Button onClick={injectCustom} disabled={loading}>
              {loading ? "Injecting..." : "Inject Anomaly"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {lastResult && (
        <div className="rounded-lg bg-muted p-3 text-sm">
          {lastResult}
        </div>
      )}
    </div>
  );
}
