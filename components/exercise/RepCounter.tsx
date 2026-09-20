interface RepCounterProps {
  completedReps: number;
  targetReps: number;
}

export default function RepCounter({
  completedReps,
  targetReps,
}: RepCounterProps) {
  const percentage = Math.min(100, Math.round((completedReps / targetReps) * 100));

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex items-center justify-between shadow-sm">
      <div>
        <span className="text-xs uppercase font-semibold tracking-wider text-zinc-400">
          Repetitions
        </span>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-3xl font-extrabold font-mono text-zinc-900 dark:text-zinc-50">
            {completedReps}
          </span>
          <span className="text-base text-zinc-400 font-medium">
            / {targetReps}
          </span>
        </div>
      </div>

      {/* Progress ring / bar */}
      <div className="flex flex-col items-end">
        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          {percentage}%
        </span>
        <div className="w-24 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden mt-2">
          <div
            className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}
