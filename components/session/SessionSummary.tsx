import Link from "next/link";
import { SessionRecord } from "@/lib/exercises/types";
import {
  Trophy,
  CheckCircle2,
  Activity,
  Clock,
  Compass,
  AlertTriangle,
  RotateCcw,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

interface SessionSummaryProps {
  session: SessionRecord;
}

export default function SessionSummary({ session }: SessionSummaryProps) {
  const accuracy = Math.round(
    (session.goodFormCount / Math.max(1, session.completedReps)) * 100
  );

  return (
    <div className="w-full space-y-5">
      {/* Header Badge */}
      <div className="text-center space-y-2 pt-1">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
          <Trophy className="w-4 h-4 text-emerald-400" />
          <span>Session Completed</span>
        </div>

        <h2 className="text-2xl font-black text-white tracking-tight">
          {session.exerciseName}
        </h2>

        <p className="text-xs text-zinc-400 font-mono">
          {new Date(session.date).toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      {/* Main Rep Highlight Card */}
      <div className="relative rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 p-6 text-white text-center shadow-2xl overflow-hidden space-y-1">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 blur-2xl rounded-full pointer-events-none" />

        <span className="text-xs font-bold uppercase tracking-widest text-emerald-100">
          Repetitions Completed
        </span>

        <div className="text-5xl font-black font-mono tracking-tight my-1">
          {session.completedReps} <span className="text-2xl font-bold text-emerald-200">/ {session.targetReps}</span>
        </div>

        <div className="inline-block px-3 py-1 rounded-full bg-black/20 backdrop-blur border border-white/20 text-xs font-semibold">
          Form Accuracy: {accuracy}%
        </div>
      </div>

      {/* Secondary Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-4 text-center backdrop-blur-xl shadow-lg space-y-1">
          <div className="flex items-center justify-center gap-1 text-[10px] font-extrabold uppercase tracking-widest text-zinc-400">
            <Compass className="w-3.5 h-3.5 text-emerald-400" />
            <span>Range of Motion</span>
          </div>
          <p className="text-2xl font-black font-mono text-emerald-400">
            {session.rom}&deg;
          </p>
        </div>

        <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-4 text-center backdrop-blur-xl shadow-lg space-y-1">
          <div className="flex items-center justify-center gap-1 text-[10px] font-extrabold uppercase tracking-widest text-zinc-400">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Average Tempo</span>
          </div>
          <p className="text-2xl font-black font-mono text-cyan-300">
            {session.averageTempo > 0 ? `${session.averageTempo}s` : "--"}
          </p>
        </div>

        <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-4 text-center backdrop-blur-xl shadow-lg space-y-1">
          <div className="flex items-center justify-center gap-1 text-[10px] font-extrabold uppercase tracking-widest text-zinc-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Good Form</span>
          </div>
          <p className="text-2xl font-black font-mono text-emerald-400">
            {session.goodFormCount}
          </p>
        </div>

        <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-4 text-center backdrop-blur-xl shadow-lg space-y-1">
          <div className="flex items-center justify-center gap-1 text-[10px] font-extrabold uppercase tracking-widest text-zinc-400">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Form Hints</span>
          </div>
          <p className="text-2xl font-black font-mono text-amber-400">
            {session.warningCount}
          </p>
        </div>
      </div>

      {/* LocalStorage Saved Badge */}
      <div className="flex items-center justify-center gap-2 text-xs text-zinc-400 bg-zinc-900/80 py-3 rounded-2xl border border-zinc-800/80 backdrop-blur-xl shadow-sm">
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
        <span>Session record permanently saved</span>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2.5 pt-2">
        <Link
          href="/progress"
          className="w-full py-4 px-5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-extrabold text-sm rounded-2xl text-center shadow-xl shadow-emerald-950/40 flex items-center justify-center gap-2 transition-all"
        >
          <span>View Detailed Analytics</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          href="/"
          className="w-full py-3.5 px-5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold text-xs rounded-2xl text-center border border-zinc-800 block transition-all"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
