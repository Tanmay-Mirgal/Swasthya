import Link from "next/link";
import { SessionRecord } from "@/lib/exercises/types";

interface SessionSummaryProps {
  session: SessionRecord;
}

export default function SessionSummary({ session }: SessionSummaryProps) {
  return (
    <div className="w-full space-y-6">
      {/* Header Badge */}
      <div className="text-center space-y-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Session Complete
        </span>
        <h2 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50">
          {session.exerciseName}
        </h2>
        <p className="text-xs text-zinc-400">
          {new Date(session.date).toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      {/* Main Metric Highlight Card */}
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white text-center shadow-lg space-y-1">
        <span className="text-xs font-medium uppercase tracking-wider opacity-90">
          Repetitions Completed
        </span>
        <div className="text-5xl font-extrabold font-mono tracking-tight">
          {session.completedReps} / {session.targetReps}
        </div>
      </div>

      {/* Secondary Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Range of Motion
          </span>
          <p className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1">
            {session.rom}&deg;
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Average Tempo
          </span>
          <p className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1">
            {session.averageTempo}s
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Good Form Reps
          </span>
          <p className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {session.goodFormCount}
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Corrections
          </span>
          <p className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
            {session.warningCount}
          </p>
        </div>
      </div>

      {/* LocalStorage Saved Badge */}
      <div className="flex items-center justify-center gap-2 text-xs text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 py-2.5 rounded-xl border border-zinc-200/60 dark:border-zinc-800">
        <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
        </svg>
        Session saved to LocalStorage
      </div>

      {/* Action Buttons */}
      <div className="space-y-3 pt-2">
        <Link
          href="/progress"
          className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl text-center shadow-md block transition-all"
        >
          View Progress
        </Link>
        <Link
          href="/"
          className="w-full py-3.5 px-4 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold text-sm rounded-xl text-center block transition-all"
        >
          Done
        </Link>
      </div>
    </div>
  );
}
