import Link from "next/link";
import { ExerciseConfig } from "@/lib/exercises/types";
import { Play, Activity, Target, ShieldCheck } from "lucide-react";

interface ExerciseCardProps {
  exercise: ExerciseConfig;
  isAvailable?: boolean;
}

export default function ExerciseCard({
  exercise,
  isAvailable = true,
}: ExerciseCardProps) {
  const getCategoryColor = () => {
    switch (exercise.category) {
      case "Neck":
        return "bg-cyan-500/15 text-cyan-400 border-cyan-500/30";
      case "Upper Body":
        return "bg-indigo-500/15 text-indigo-400 border-indigo-500/30";
      default:
        return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    }
  };

  return (
    <div
      className={`group relative bg-zinc-900/80 border rounded-2xl p-4 transition-all duration-300 backdrop-blur-xl shadow-xl overflow-hidden ${
        isAvailable
          ? "border-zinc-800 hover:border-emerald-500/40 hover:shadow-[0_0_30px_rgba(16,185,129,0.12)]"
          : "border-zinc-800/60 opacity-60"
      }`}
    >
      {/* Background ambient glow on hover */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-2xl rounded-full group-hover:bg-emerald-500/15 transition-all pointer-events-none" />

      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${getCategoryColor()}`}>
              {exercise.category}
            </span>
            <span className="text-[10px] font-bold text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded-full border border-zinc-700/60">
              {exercise.difficulty}
            </span>
          </div>

          <h3 className="text-base font-extrabold text-white group-hover:text-emerald-300 transition-colors truncate">
            {exercise.name}
          </h3>

          <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
            {exercise.description}
          </p>
        </div>

        <div className="w-10 h-10 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
          <Activity className="w-5 h-5" />
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-semibold font-mono">
          <Target className="w-3.5 h-3.5 text-emerald-400" />
          <span>{exercise.targetReps} Reps Target</span>
        </div>

        {isAvailable ? (
          <Link
            href={`/exercise/${exercise.id}/setup`}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs rounded-xl transition-all shadow-lg flex items-center gap-1.5 group/btn"
          >
            <span>Start</span>
            <Play className="w-3.5 h-3.5 fill-current transition-transform group-hover/btn:translate-x-0.5" />
          </Link>
        ) : (
          <span className="text-xs text-zinc-500 font-medium bg-zinc-800/60 px-3 py-1.5 rounded-xl border border-zinc-700/40">
            Coming Soon
          </span>
        )}
      </div>
    </div>
  );
}
