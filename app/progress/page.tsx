/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/navigation/AppShell";
import { getSessionHistory, getAggregateStats } from "@/lib/session/sessionStore";
import { SessionRecord } from "@/lib/exercises/types";
import { Activity, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export default function ProgressPage() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [stats, setStats] = useState({ totalSessions: 0, totalReps: 0, avgRom: 0 });

  useEffect(() => {
    setSessions(getSessionHistory());
    setStats(getAggregateStats());
  }, []);

  const groupSessionsByDate = (history: SessionRecord[]) => {
    const groups: Record<string, SessionRecord[]> = {};
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    history.forEach((s) => {
      const d = new Date(s.date);
      let dateStr = "";
      if (d.toDateString() === today.toDateString()) {
        dateStr = "Today";
      } else if (d.toDateString() === yesterday.toDateString()) {
        dateStr = "Yesterday";
      } else {
        dateStr = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      }

      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(s);
    });

    return groups;
  };

  const getActivityData = () => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const count = sessions.filter(
        (s) => new Date(s.date).toDateString() === d.toDateString()
      ).length;
      data.push({
        day: d.toLocaleDateString(undefined, { weekday: "narrow" }), // e.g. M, T, W
        count,
      });
    }
    return data;
  };

  const groupedSessions = groupSessionsByDate(sessions);
  const activityData = getActivityData();
  const maxActivity = Math.max(...activityData.map((d) => d.count), 1);

  if (sessions.length === 0) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center text-center px-4 h-full min-h-[70vh]">
          <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mb-5">
            <TrendingUp className="w-8 h-8 text-slate-300" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Your journey starts here
          </h2>
          <p className="text-sm text-slate-500 mb-8 max-w-[250px] leading-relaxed">
            Complete your first guided session to see your progress and activity history.
          </p>
          <Button asChild className="rounded-xl px-8 h-12 bg-slate-900 text-white shadow-sm hover:bg-slate-800 transition-colors">
            <Link href="/exercise">Start an Exercise</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col space-y-10 pt-4 pb-12 px-2">
        {/* Progress Summary & Chart */}
        <section>
          <div className="mb-8">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">
              {stats.totalSessions}
            </h1>
            <p className="text-sm font-medium text-slate-500 mt-1">
              Sessions completed
            </p>
          </div>

          <div className="mb-2">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              This Week
            </h2>
            <div className="flex items-end justify-between h-24 mt-4">
              {activityData.map((d, i) => {
                const heightPercentage = Math.max((d.count / maxActivity) * 100, 4); // min height for visibility if 0
                const isZero = d.count === 0;

                return (
                  <div key={i} className="flex flex-col items-center gap-2 flex-1">
                    <div className="w-full max-w-[28px] h-16 flex items-end justify-center rounded-t-md relative group">
                      {/* Tooltip on hover (desktop only) */}
                      {!isZero && (
                        <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded">
                          {d.count}
                        </div>
                      )}
                      <div
                        className={cn(
                          "w-full rounded-t-sm transition-all duration-700 ease-out",
                          isZero ? "bg-slate-100" : "bg-slate-900"
                        )}
                        style={{ height: isZero ? "4%" : `${heightPercentage}%` }}
                      />
                    </div>
                    <span
                      className={cn(
                        "text-[10px] font-semibold",
                        isZero ? "text-slate-300" : "text-slate-600"
                      )}
                    >
                      {d.day}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Supporting Metrics */}
        <section className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 p-4 rounded-2xl flex flex-col justify-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Total Volume
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-slate-900">
                {stats.totalReps}
              </span>
              <span className="text-xs font-medium text-slate-500">reps</span>
            </div>
          </div>
          <div className="bg-slate-50 p-4 rounded-2xl flex flex-col justify-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Mobility
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-slate-900">
                {stats.avgRom}&deg;
              </span>
              <span className="text-xs font-medium text-slate-500">avg</span>
            </div>
          </div>
        </section>

        {/* History Timeline */}
        <section>
          <div className="flex flex-col gap-6">
            {Object.entries(groupedSessions).map(([date, dateSessions]) => (
              <div key={date}>
                <div className="sticky top-0 bg-slate-50/90 backdrop-blur-md py-2 z-10 mb-2 -mx-2 px-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {date}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {dateSessions.map((s) => {
                    // Form Quality Calculation
                    const formPercentage = s.completedReps > 0
                      ? Math.round((s.goodFormCount / s.completedReps) * 100)
                      : 0;

                    return (
                      <div
                        key={s.id}
                        className="flex items-center gap-4 py-3 border-b border-slate-100 last:border-0 group cursor-default"
                      >
                        <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center shrink-0 transition-colors group-hover:bg-slate-100">
                          <Activity className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {s.exerciseName}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-[11px] font-medium text-slate-500">
                            <span>
                              {s.completedReps}/{s.targetReps} reps
                            </span>
                            <span className="opacity-30">•</span>
                            <span className={cn(
                              formPercentage >= 80 ? "text-emerald-600" : ""
                            )}>
                              {formPercentage}% form
                            </span>
                            <span className="opacity-30">•</span>
                            <span>{s.rom}&deg;</span>
                          </div>
                        </div>
                        <div className="text-[10px] font-semibold text-slate-400 shrink-0">
                          {new Date(s.date).toLocaleTimeString(undefined, {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
