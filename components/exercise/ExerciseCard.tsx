import Link from "next/link";
import { ExerciseConfig } from "@/lib/exercises/types";

interface ExerciseCardProps {
  exercise: ExerciseConfig;
  isAvailable?: boolean;
}

export default function ExerciseCard({
  exercise,
  isAvailable = true,
}: ExerciseCardProps) {
  return (
    <div
      className={`bg-white dark:bg-zinc-900 border rounded-2xl p-5 shadow-sm transition-all ${
        isAvailable
          ? "border-zinc-200 dark:border-zinc-800 hover:border-emerald-500 dark:hover:border-emerald-500"
          : "border-zinc-200 dark:border-zinc-800 opacity-60"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
            {exercise.category} • {exercise.difficulty}
          </span>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-2">
            {exercise.name}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
            {exercise.description}
          </p>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
        <span className="text-xs text-zinc-400 font-medium">
          Target: {exercise.targetReps} reps
        </span>

        {isAvailable ? (
          <Link
            href={`/exercise/${exercise.id}/setup`}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-xl transition-all shadow-sm flex items-center gap-1"
          >
            Start
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ) : (
          <span className="text-xs text-zinc-400 font-medium bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg">
            Coming soon
          </span>
        )}
      </div>
    </div>
  );
}
