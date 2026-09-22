"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/navigation/AppShell";
import { getSessionHistory, getAggregateStats } from "@/lib/session/sessionStore";
import { SessionRecord } from "@/lib/exercises/types";
import { BarChart3, Activity, Clock, Compass, Dumbbell, Calendar, ChevronRight } from "lucide-react";
import Link from "next/link";

export default function ProgressPage() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [stats, setStats] = useState({ totalSessions: 0, totalReps: 0, avgRom: 0 });

  useEffect(() => {
    setSessions(getSessionHistory());
    setStats(getAggregateStats());
  }, []);

  return (
    <AppShell title="Analytics & Progress" showBackNav backHref="/">
      <div className="space-y-5 pt-1">
        {/* Aggregate Telemetry Stat Cards */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-3.5 text-center backdrop-blur-xl shadow-lg space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
              Sessions
            </span>
            <p className="text-2xl font-black font-mono text-white">
              {stats.totalSessions}
            </p>
          </div>

          <div className="bg-zinc-900/90 border border-emerald-500/30 rounded-2xl p-3.5 text-center backdrop-blur-xl shadow-lg space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
              Total Reps
            </span>
            <p className="text-2xl font-black font-mono text-emerald-400">
              {stats.totalReps}
            </p>
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-3.5 text-center backdrop-blur-xl shadow-lg space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
              Avg ROM
            </span>
            <p className="text-2xl font-black font-mono text-cyan-300">
              {stats.avgRom}&deg;
            </p>
          </div>
        </div>

        {/* History Timeline List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400">
              Session History Log
            </h2>
            <span className="text-[10px] font-bold text-zinc-400 font-mono">
              {sessions.length} Recorded
            </span>
          </div>

          {sessions.length > 0 ? (
            <div className="space-y-3">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="bg-zinc-900/90 border border-zinc-800/80 hover:border-emerald-500/40 rounded-2xl p-4 shadow-xl backdrop-blur-xl space-y-3 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                        <Dumbbell className="w-4 h-4" />
                      </div>
                      <h3 className="text-sm font-extrabold text-white">
                        {s.exerciseName}
                      </h3>
                    </div>

                    <span className="text-[10px] font-semibold text-zinc-400 font-mono bg-zinc-800/80 px-2.5 py-0.5 rounded-full border border-zinc-700/60">
                      {new Date(s.date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-800/80 text-center text-xs">
                    <div>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Completed</p>
                      <p className="font-extrabold font-mono text-emerald-400 mt-0.5">
                        {s.completedReps}/{s.targetReps} reps
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">ROM Angle</p>
                      <p className="font-extrabold font-mono text-cyan-300 mt-0.5">
                        {s.rom}&deg;
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Good Form</p>
                      <p className="font-extrabold font-mono text-white mt-0.5">
                        {s.goodFormCount} reps
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-zinc-900/60 border border-dashed border-zinc-800 rounded-2xl p-8 text-center text-zinc-400 space-y-3">
              <BarChart3 className="w-8 h-8 text-zinc-600 mx-auto" />
              <p className="text-xs">No recorded session history found yet.</p>
              <Link
                href="/exercise"
                className="inline-block px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md"
              >
                Start First Session
              </Link>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
