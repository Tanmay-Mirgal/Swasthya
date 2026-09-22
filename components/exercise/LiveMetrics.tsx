import { Activity, Compass, Clock } from "lucide-react";

interface LiveMetricsProps {
  kneeAngle: number;
  rom: number;
  tempo: number;
}

export default function LiveMetrics({ kneeAngle, rom, tempo }: LiveMetricsProps) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {/* Current Joint Angle Card */}
      <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-3 text-center backdrop-blur-md shadow-lg space-y-1">
        <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
          <Activity className="w-3 h-3 text-emerald-400" />
          <span>Joint Angle</span>
        </div>
        <p className="text-xl font-black font-mono text-emerald-400">
          {Math.round(kneeAngle)}&deg;
        </p>
      </div>

      {/* Range of Motion (ROM) Card */}
      <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-3 text-center backdrop-blur-md shadow-lg space-y-1">
        <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
          <Compass className="w-3 h-3 text-teal-400" />
          <span>Total ROM</span>
        </div>
        <p className="text-xl font-black font-mono text-teal-300">
          {Math.round(rom)}&deg;
        </p>
      </div>

      {/* Tempo Card */}
      <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-3 text-center backdrop-blur-md shadow-lg space-y-1">
        <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
          <Clock className="w-3 h-3 text-cyan-400" />
          <span>Avg Tempo</span>
        </div>
        <p className="text-xl font-black font-mono text-cyan-300">
          {tempo > 0 ? `${tempo.toFixed(1)}s` : "--"}
        </p>
      </div>
    </div>
  );
}
