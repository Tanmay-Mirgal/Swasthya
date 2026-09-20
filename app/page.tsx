"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/navigation/AppShell";
import { getAggregateStats, getLatestSession } from "@/lib/session/sessionStore";
import { SessionRecord } from "@/lib/exercises/types";

export default function HomePage() {
  const [stats, setStats] = useState({ totalSessions: 0, totalReps: 0, avgRom: 0 });
  const [latestSession, setLatestSession] = useState<SessionRecord | null>(null);

  useEffect(() => {
    setStats(getAggregateStats());
    setLatestSession(getLatestSession());
  }, []);

  return (
    <AppShell>
      {/* Brand Header */}
      <div className="space-y-1 pt-2">
        <span className="text-xs font-bold tracking-widest text-emerald-600 dark:text-emerald-400 uppercase">
          RehabLens
        </span>
        <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">
          Your movement.<br />
          <span className="text-zinc-500 font-semibold">Your progress.</span>
        </h1>
      </div>

      {/* Primary CTA Button */}
      <div className="pt-2">
        <Link
          href="/exercise"
          className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base rounded-2xl flex items-center justify-between shadow-lg shadow-emerald-950/20 transition-all group"
        >
          <span>Start Exercise</span>
          <svg
            className="w-5 h-5 transition-transform group-hover:translate-x-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </Link>
      </div>

      {/* Today's / Aggregate Progress Summary Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Today&apos;s Progress
        </h2>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="space-y-0.5">
            <span className="text-2xl font-black font-mono text-zinc-900 dark:text-zinc-100">
              {stats.totalReps}
            </span>
            <p className="text-[10px] text-zinc-500 font-medium">Repetitions</p>
          </div>

          <div className="space-y-0.5 border-x border-zinc-100 dark:border-zinc-800">
            <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              {stats.avgRom}&deg;
            </span>
            <p className="text-[10px] text-zinc-500 font-medium">Range of Motion</p>
          </div>

          <div className="space-y-0.5">
            <span className="text-2xl font-black font-mono text-zinc-900 dark:text-zinc-100">
              {stats.totalSessions}
            </span>
            <p className="text-[10px] text-zinc-500 font-medium">Sessions</p>
          </div>
        </div>
      </div>

      {/* Recent Session Card */}
      <div className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Recent Session
        </h2>

        {latestSession ? (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {latestSession.exerciseName}
              </span>
              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {latestSession.completedReps} reps completed
              </p>
              <p className="text-xs text-zinc-400">
                {latestSession.goodFormCount} good form reps • {latestSession.rom}&deg; ROM
              </p>
            </div>
            <Link
              href="/progress"
              className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 text-center text-zinc-400 text-xs">
            No completed sessions yet. Click &quot;Start Exercise&quot; to perform your first session!
          </div>
        )}
      </div>
    </AppShell>
  );
}
