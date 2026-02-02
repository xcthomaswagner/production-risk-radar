"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Machine {
  machine_id: string;
  line: string;
  status: string;
  risk_score: number;
  temperature_c: number;
  vibration_mm_s: number;
}

interface ControlMachineTableProps {
  refreshTrigger?: number;
}

export function ControlMachineTable({ refreshTrigger }: ControlMachineTableProps) {
  const [machines, setMachines] = useState<Machine[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/machines");
        const data = await res.json();
        if (!cancelled) setMachines(data);
      } catch {
        // silently ignore
      }
    }

    poll();
    const interval = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [refreshTrigger]);

  const sorted = [...machines].sort((a, b) => b.risk_score - a.risk_score);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Machine</TableHead>
          <TableHead>Line</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Risk</TableHead>
          <TableHead className="text-right">Temp</TableHead>
          <TableHead className="text-right">Vibration</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map(m => (
          <TableRow key={m.machine_id} className={m.risk_score > 0.7 ? "bg-red-50" : ""}>
            <TableCell className="font-medium">{m.machine_id}</TableCell>
            <TableCell>{m.line}</TableCell>
            <TableCell>
              <Badge variant={m.status === "Warning" ? "destructive" : "secondary"}>
                {m.status}
              </Badge>
            </TableCell>
            <TableCell className="text-right font-bold">
              {(m.risk_score * 100).toFixed(0)}%
            </TableCell>
            <TableCell className="text-right">{m.temperature_c?.toFixed(1)}°C</TableCell>
            <TableCell className="text-right">{m.vibration_mm_s?.toFixed(2)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
