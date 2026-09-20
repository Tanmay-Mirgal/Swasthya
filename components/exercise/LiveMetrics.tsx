interface LiveMetricsProps {
  kneeAngle: number;
  rom: number;
  tempo: number;
}

export default function LiveMetrics({
  kneeAngle,
  rom,
  tempo,
}: LiveMetricsProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {/* Knee Angle */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 flex flex-col justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Knee Angle
        </span>
        <div className="mt-1 flex items-baseline">
          <span className="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
            {kneeAngle}&deg;
          </span>
        </div>
      </div>

      {/* ROM */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 flex flex-col justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Session ROM
        </span>
        <div className="mt-1 flex items-baseline">
          <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {rom}&deg;
          </span>
        </div>
      </div>

      {/* Tempo */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 flex flex-col justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Avg Tempo
        </span>
        <div className="mt-1 flex items-baseline">
          <span className="text-xl font-bold font-mono text-cyan-600 dark:text-cyan-400">
            {tempo > 0 ? `${tempo}s` : "--"}
          </span>
        </div>
      </div>
    </div>
  );
}
