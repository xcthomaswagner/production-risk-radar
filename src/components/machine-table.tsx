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
  temperature_c: number;
  vibration_mm_s: number;
  power_kw: number;
  cycle_time_s: number;
  risk_score: number;
  predicted_failure_date: string;
  energy_deviation_kw: number;
}

interface MachineTableProps {
  machines: Machine[];
}

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "Warning": return "destructive";
    case "Down": return "destructive";
    default: return "secondary";
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "\u2014";
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return dateStr;
  }
}

export function MachineTable({ machines }: MachineTableProps) {
  const sorted = [...machines].sort((a, b) => b.risk_score - a.risk_score);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Machine</TableHead>
          <TableHead>Line</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Temp (\u00b0C)</TableHead>
          <TableHead className="text-right">Vibration (mm/s)</TableHead>
          <TableHead className="text-right">Power (kW)</TableHead>
          <TableHead className="text-right">Cycle (s)</TableHead>
          <TableHead className="text-right">Risk</TableHead>
          <TableHead>Predicted Failure</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map(m => (
          <TableRow key={m.machine_id} className={m.risk_score > 0.7 ? "bg-red-50" : ""}>
            <TableCell className="font-medium">{m.machine_id}</TableCell>
            <TableCell>{m.line}</TableCell>
            <TableCell>
              <Badge variant={getStatusBadgeVariant(m.status)}>{m.status}</Badge>
            </TableCell>
            <TableCell className="text-right">{m.temperature_c.toFixed(1)}</TableCell>
            <TableCell className="text-right">{m.vibration_mm_s.toFixed(2)}</TableCell>
            <TableCell className="text-right">{m.power_kw.toFixed(1)}</TableCell>
            <TableCell className="text-right">{m.cycle_time_s.toFixed(1)}</TableCell>
            <TableCell className="text-right font-bold">
              {(m.risk_score * 100).toFixed(0)}%
            </TableCell>
            <TableCell>{formatDate(m.predicted_failure_date)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
