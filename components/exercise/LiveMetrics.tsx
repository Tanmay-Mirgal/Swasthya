import { Card, CardContent } from "@/components/ui/Card";

interface LiveMetricsProps {
  kneeAngle: number;
  rom: number;
  tempo: number;
}

export default function LiveMetrics({ kneeAngle, rom, tempo }: LiveMetricsProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {/* Current Joint Angle */}
      <Card>
        <CardContent className="p-3 text-center space-y-1">
          <p className="text-xs text-slate-500 font-medium">Angle</p>
          <p className="text-xl font-bold text-slate-900">
            {Math.round(kneeAngle)}&deg;
          </p>
        </CardContent>
      </Card>

      {/* Range of Motion */}
      <Card>
        <CardContent className="p-3 text-center space-y-1">
          <p className="text-xs text-slate-500 font-medium">ROM</p>
          <p className="text-xl font-bold text-slate-900">
            {Math.round(rom)}&deg;
          </p>
        </CardContent>
      </Card>

      {/* Tempo */}
      <Card>
        <CardContent className="p-3 text-center space-y-1">
          <p className="text-xs text-slate-500 font-medium">Tempo</p>
          <p className="text-xl font-bold text-slate-900">
            {tempo > 0 ? `${tempo.toFixed(1)}s` : "--"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
