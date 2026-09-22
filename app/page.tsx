"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/navigation/AppShell";
import { getAggregateStats, getLatestSession } from "@/lib/session/sessionStore";
import { SessionRecord } from "@/lib/exercises/types";
import { getAllExercises } from "@/lib/exercises/registry";
import {
  Sparkles,
  Play,
  Activity,
  Flame,
  ChevronRight,
  Target,
  Award,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

export default function HomePage() {
  const [stats, setStats] = useState({ totalSessions: 0, totalReps: 0, avgRom: 0 });
  const [latestSession, setLatestSession] = useState<SessionRecord | null>(null);
  const exercises = getAllExercises();

  useEffect(() => {
    setStats(getAggregateStats());
    setLatestSession(getLatestSession());
  }, []);

  return (
    <AppShell>
      {/* Hero Welcome Banner */}
      <div className="relative rounded-3xl bg-gradient-to-br from-emerald-950/80 via-zinc-900 to-zinc-950 border border-emerald-500/30 p-5 shadow-2xl overflow-hidden space-y-4">
        {/* Background glow circle */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/20 blur-3xl rounded-full pointer-events-none" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-[10px] font-black text-emerald-300 uppercase tracking-widest">
              AI Motion Analysis Active
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-amber-400 bg-amber-950/60 border border-amber-800/60 px-2.5 py-1 rounded-full">
            <Flame className="w-3 h-3 fill-current" />
            <span>Streak: 3 Days</span>
          </div>
        </div>

        <div className="space-y-1">
          <h1 className="text-xl font-extrabold text-white tracking-tight leading-snug">
            Real-Time Physiotherapy &amp; Motion Guidance
          </h1>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Computer vision pose tracking, biomechanical ROM analytics, and instant Groq AI form corrections.
          </p>
        </div>

        {/* Primary CTA Button */}
        <div>
          <Link
            href="/exercise"
            className="w-full py-3.5 px-5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 active:scale-[0.99] text-white font-black text-sm rounded-2xl flex items-center justify-between shadow-xl shadow-emerald-950/50 transition-all group"
          >
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4 fill-current" />
              <span>Start Rehabilitation Session</span>
            </div>
            <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>

      {/* Aggregate Progress Telemetry Cards */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-zinc-400">
            Telemetry Overview
          </h2>
          <span className="text-[10px] font-semibold text-emerald-400">Live Sync</span>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-3.5 text-center backdrop-blur-xl space-y-1">
            <span className="text-2xl font-black font-mono text-white">
              {stats.totalReps}
            </span>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Reps</p>
          </div>

          <div className="bg-zinc-900/80 border border-emerald-500/30 rounded-2xl p-3.5 text-center backdrop-blur-xl space-y-1">
            <span className="text-2xl font-black font-mono text-emerald-400">
              {stats.avgRom}&deg;
            </span>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Avg ROM</p>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-3.5 text-center backdrop-blur-xl space-y-1">
            <span className="text-2xl font-black font-mono text-teal-300">
              {stats.totalSessions}
            </span>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Sessions</p>
          </div>
        </div>
      </div>

      {/* Quick Launch Exercises */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-zinc-400">
            Available Programs
          </h2>
          <Link href="/exercise" className="text-xs font-bold text-emerald-400 hover:underline flex items-center gap-0.5">
            View All <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="space-y-2.5">
          {exercises.slice(0, 3).map((ex) => (
            <Link
              key={ex.id}
              href={`/exercise/${ex.id}/setup`}
              className="group bg-zinc-900/80 border border-zinc-800/80 hover:border-emerald-500/40 rounded-2xl p-3.5 flex items-center justify-between transition-all backdrop-blur-xl shadow-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-extrabold text-white group-hover:text-emerald-300 transition-colors">
                      {ex.name}
                    </h3>
                    <span className="text-[9px] font-bold px-2 py-0.2 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                      {ex.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Target: {ex.targetReps} reps • {ex.difficulty}
                  </p>
                </div>
              </div>

              <div className="p-2 rounded-xl bg-zinc-800/80 text-zinc-400 group-hover:text-white group-hover:bg-emerald-600 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Session Summary */}
      <div className="space-y-2 pt-1">
        <h2 className="text-xs font-extrabold uppercase tracking-widest text-zinc-400 px-1">
          Recent Activity
        </h2>

        {latestSession ? (
          <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-4 space-y-3 backdrop-blur-xl shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-extrabold text-white">
                  {latestSession.exerciseName}
                </span>
              </div>
              <span className="text-[10px] font-mono text-zinc-400">
                {new Date(latestSession.date).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-zinc-800/80">
              <span className="font-bold text-emerald-400 font-mono">
                {latestSession.completedReps} Reps Completed
              </span>
              <span className="text-zinc-400 font-mono">
                ROM: {latestSession.rom}&deg; • {latestSession.goodFormCount} Good Reps
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900/60 border border-dashed border-zinc-800 rounded-2xl p-6 text-center text-zinc-400 text-xs">
            No completed sessions yet. Launch an exercise above to get started!
          </div>
        )}
      </div>
    </AppShell>
  );
}
