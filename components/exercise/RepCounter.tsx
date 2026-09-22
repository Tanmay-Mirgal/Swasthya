import { Target, Activity } from "lucide-react";

interface RepCounterProps {
  completedReps: number;
  targetReps: number;
}

export default function RepCounter({ completedReps, targetReps }: RepCounterProps) {
  const percentage = Math.min(100, Math.round((completedReps / Math.max(1, targetReps)) * 100));

  return (
    <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-4 shadow-xl backdrop-blur-xl space-y-3 relative overflow-hidden">
      {/* Background glow when target completed */}
      {completedReps >= targetReps && (
        <div className="absolute inset-0 bg-emerald-500/10 backdrop-blur-xl border border-emerald-500/30 animate-pulse pointer-events-none" />
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <Target className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              Exercise Goal
            </p>
            <h2 className="text-sm font-extrabold text-white leading-tight">
              Repetition Target
            </h2>
          </div>
        </div>

        <div className="text-right">
          <div className="flex items-baseline gap-1 justify-end">
            <span className="text-2xl font-black font-mono text-emerald-400 tracking-tight">
              {completedReps}
            </span>
            <span className="text-xs font-bold text-zinc-500 font-mono">
              / {targetReps}
            </span>
          </div>
          <p className="text-[10px] font-semibold text-zinc-400">
            {completedReps >= targetReps ? "Target Reached! 🎉" : `${percentage}% Completed`}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/60 p-0.5">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500 ease-out shadow-[0_0_12px_#10b981]"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
