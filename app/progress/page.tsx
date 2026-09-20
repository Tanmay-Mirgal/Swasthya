"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/navigation/AppShell";
import { getSessionHistory, getAggregateStats } from "@/lib/session/sessionStore";
import { SessionRecord } from "@/lib/exercises/types";

export default function ProgressPage() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [stats, setStats] = useState({ totalSessions: 0, totalReps: 0, avgRom: 0 });

  useEffect(() => {
    setSessions(getSessionHistory());
    setStats(getAggregateStats());
  }, []);

  return (
    <AppShell title="Progress" showBackNav backHref="/">
      <div className="space-y-6 pt-1">
        {/* Aggregate Stats Bar */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Sessions
            </span>
            <p className="text-2xl font-black font-mono text-zinc-900 dark:text-zinc-100 mt-1">
              {stats.totalSessions}
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Total Reps
            </span>
            <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              {stats.totalReps}
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Avg ROM
            </span>
            <p className="text-2xl font-black font-mono text-cyan-600 dark:text-cyan-400 mt-1">
              {stats.avgRom}&deg;
            </p>
          </div>
        </div>

        {/* Recent Sessions History Header */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Recent Sessions
          </h2>

          {sessions.length > 0 ? (
            <div className="space-y-3">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {s.exerciseName}
                    </h3>
                    <span className="text-[10px] font-medium text-zinc-400">
                      {new Date(s.date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-zinc-100 dark:border-zinc-800/80 text-xs">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {s.completedReps} reps completed
                    </span>
                    <span className="text-zinc-500 font-mono">
                      {s.rom}&deg; ROM • {s.averageTempo}s avg
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 text-center text-zinc-400 text-xs">
              No recorded sessions found in LocalStorage.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
