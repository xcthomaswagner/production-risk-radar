interface Machine {
  machine_id: string;
  line: string;
  name: string;
  status: string;
  temperature_c: number;
  vibration_mm_s: number;
  risk_score: number;
  predicted_failure_date: string;
}

interface HeatmapGridProps {
  machines: Machine[];
  lines: string[];
}

function getRiskColor(risk: number): string {
  if (risk >= 0.7) return "bg-red-500";
  if (risk >= 0.5) return "bg-orange-400";
  if (risk >= 0.3) return "bg-yellow-400";
  return "bg-green-500";
}

function getRiskTextColor(risk: number): string {
  if (risk >= 0.5) return "text-white";
  return "text-gray-900";
}

export function HeatmapGrid({ machines, lines }: HeatmapGridProps) {
  // Group machines by line
  const machinesByLine: Record<string, Machine[]> = {};
  for (const line of lines) {
    machinesByLine[line] = machines
      .filter(m => m.line === line)
      .sort((a, b) => a.machine_id.localeCompare(b.machine_id));
  }

  const maxMachines = Math.max(...Object.values(machinesByLine).map(m => m.length));

  return (
    <div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${lines.length}, 1fr)` }}>
        {/* Headers */}
        {lines.map(line => (
          <div key={line} className="text-center font-semibold text-sm py-2">
            {line}
          </div>
        ))}

        {/* Machine cells */}
        {Array.from({ length: maxMachines }, (_, rowIdx) => (
          lines.map(line => {
            const machine = machinesByLine[line]?.[rowIdx];
            if (!machine) return <div key={`${line}-${rowIdx}`} />;

            return (
              <div
                key={machine.machine_id}
                className={`rounded-lg p-3 ${getRiskColor(machine.risk_score)} ${getRiskTextColor(machine.risk_score)} transition-colors`}
                title={`${machine.machine_id}: Risk ${(machine.risk_score * 100).toFixed(0)}% | Temp ${machine.temperature_c.toFixed(1)}°C | Vib ${machine.vibration_mm_s.toFixed(2)} mm/s`}
              >
                <div className="text-xs font-bold">{machine.machine_id}</div>
                <div className="text-lg font-bold">{(machine.risk_score * 100).toFixed(0)}%</div>
                <div className="text-xs">
                  {machine.status}
                </div>
              </div>
            );
          })
        )).flat()}
      </div>
    </div>
  );
}
