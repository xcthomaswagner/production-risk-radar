"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ResetControlsProps {
  onReset?: () => void;
}

export function ResetControls({ onReset }: ResetControlsProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleReset() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/anomaly/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      await res.json();
      setMessage("All machines reset to baseline");
      onReset?.();
    } catch {
      setMessage("Error resetting");
    } finally {
      setLoading(false);
    }
  }

  async function handleSeed() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data = await res.json();
      setMessage(`Database re-seeded: ${data.telemetry_rows} telemetry rows, ${data.machines} machines`);
      onReset?.();
    } catch {
      setMessage("Error re-seeding");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Reset Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          variant="outline"
          className="w-full"
          disabled={loading}
          onClick={handleReset}
        >
          {loading ? "Resetting..." : "Reset to Baseline"}
        </Button>
        <Button
          variant="secondary"
          className="w-full"
          disabled={loading}
          onClick={handleSeed}
        >
          {loading ? "Re-seeding..." : "Re-seed Database"}
        </Button>
        {message && (
          <div className="rounded-lg bg-muted p-3 text-sm">
            {message}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
