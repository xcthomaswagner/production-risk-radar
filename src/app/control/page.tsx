"use client";

import { useState } from "react";
import Link from "next/link";
import { AnomalyControls } from "@/components/anomaly-controls";
import { ResetControls } from "@/components/reset-controls";
import { ControlMachineTable } from "@/components/control-machine-table";

export default function ControlPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  function triggerRefresh() {
    setRefreshTrigger(prev => prev + 1);
  }

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Demo Control Panel</h1>
            <p className="text-muted-foreground">Inject anomalies, reset machines, control the demo</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/help"
              className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              How It Works
            </Link>
            <Link
              href="/"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              View Dashboard
            </Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column: Controls */}
          <div className="lg:col-span-1 space-y-4">
            <AnomalyControls onInject={triggerRefresh} />
            <ResetControls onReset={triggerRefresh} />
          </div>

          {/* Right column: Machine status */}
          <div className="lg:col-span-2">
            <h2 className="mb-3 text-xl font-semibold">Machine Status</h2>
            <ControlMachineTable refreshTrigger={refreshTrigger} />
          </div>
        </div>
      </div>
    </main>
  );
}
