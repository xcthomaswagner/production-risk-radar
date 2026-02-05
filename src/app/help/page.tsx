"use client";

import Link from "next/link";
import Image from "next/image";

export default function HelpPage() {
  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">How It Works</h1>
            <p className="text-muted-foreground">
              Understanding the Production Risk Radar data flow
            </p>
          </div>
          <Link
            href="/control"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Back to Control Panel
          </Link>
        </div>

        {/* Architecture Diagram */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-xl font-semibold">Data Flow Architecture</h2>
          <div className="relative w-full overflow-hidden rounded-lg bg-white p-4">
            <Image
              src="/workflow.png"
              alt="Production Risk Radar Architecture - OPC UA to Edge Gateway to Azure IoT Hub to Digital Twins"
              width={1200}
              height={400}
              className="w-full h-auto"
              priority
            />
          </div>
        </div>

        {/* Data Flow Steps */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-xl font-semibold">Data Flow Pipeline</h2>
          <div className="space-y-1 mb-6 font-mono text-sm bg-muted p-3 rounded-md">
            Machines (OPC UA) → Edge Gateway → MQTT → Azure IoT Hub → ADT/ADX
          </div>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-semibold">
                1
              </div>
              <div>
                <h3 className="font-semibold">Factory Floor</h3>
                <p className="text-muted-foreground">
                  Machines expose real-time sensor data via <strong>OPC UA</strong> (Open Platform
                  Communications Unified Architecture) — the industry standard protocol for
                  industrial automation. Sensors capture temperature, vibration, power consumption,
                  and cycle times.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-semibold">
                2
              </div>
              <div>
                <h3 className="font-semibold">Edge Gateway</h3>
                <p className="text-muted-foreground">
                  Translates OPC UA to <strong>MQTT</strong> (Message Queuing Telemetry Transport)
                  for efficient cloud communication. Tools like <strong>Kepware</strong> or{" "}
                  <strong>Azure IoT Edge</strong> handle protocol translation, data filtering, and
                  local buffering.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-semibold">
                3
              </div>
              <div>
                <h3 className="font-semibold">Cloud Ingestion</h3>
                <p className="text-muted-foreground">
                  <strong>Azure IoT Hub</strong> receives MQTT messages at scale, handling millions
                  of events per second. It provides secure device-to-cloud communication, device
                  management, and message routing.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-semibold">
                4
              </div>
              <div>
                <h3 className="font-semibold">Digital Twin & Analytics</h3>
                <p className="text-muted-foreground">
                  Data flows to <strong>Azure Digital Twins (ADT)</strong> for real-time state
                  modeling and <strong>Azure Data Explorer (ADX)</strong> for time-series analytics.
                  AI models analyze patterns to calculate risk scores and predict failures.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Protocol Standards */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-xl font-semibold">Industry Standards</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg bg-muted p-4">
              <h3 className="font-semibold text-blue-600">OPC UA</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Platform-independent industrial communication standard. Provides rich data modeling,
                security, and interoperability between machines from different manufacturers.
              </p>
            </div>
            <div className="rounded-lg bg-muted p-4">
              <h3 className="font-semibold text-blue-600">MQTT</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Lightweight publish-subscribe messaging protocol. Optimized for low bandwidth and
                unreliable networks, ideal for IoT sensor data transmission.
              </p>
            </div>
          </div>
        </div>

        {/* About the Demo */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-xl font-semibold">About This Demo</h2>
          <p className="text-muted-foreground">
            This demo simulates the data flow by injecting telemetry directly via the control panel.
            In a production deployment, real sensor data would flow through the full pipeline
            described above. The demo includes:
          </p>
          <ul className="mt-3 space-y-2 text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-green-600">•</span>
              <span>1 Factory with 3 Production Lines and 15 Machines</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600">•</span>
              <span>Real-time risk scoring and failure prediction</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600">•</span>
              <span>Throughput forecasting based on equipment health</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600">•</span>
              <span>Power BI dashboard with auto-refresh via DirectQuery</span>
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}
