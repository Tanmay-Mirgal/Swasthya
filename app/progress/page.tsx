/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/navigation/AppShell";
import { getSessionHistory, getAggregateStats } from "@/lib/session/sessionStore";
import { SessionRecord } from "@/lib/exercises/types";
import { BarChart3, Dumbbell } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function ProgressPage() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [stats, setStats] = useState({ totalSessions: 0, totalReps: 0, avgRom: 0 });

  useEffect(() => {
    setSessions(getSessionHistory());
    setStats(getAggregateStats());
  }, []);

  return (
    <AppShell title="Progress" showBackNav backHref="/">
      <div className="space-y-6">
        {/* Aggregate Stats */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Overview</h2>
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-3 text-center space-y-1">
                <span className="text-xs font-medium text-slate-500">Sessions</span>
                <p className="text-2xl font-bold text-slate-900">{stats.totalSessions}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center space-y-1">
                <span className="text-xs font-medium text-slate-500">Total Reps</span>
                <p className="text-2xl font-bold text-slate-900">{stats.totalReps}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center space-y-1">
                <span className="text-xs font-medium text-slate-500">Avg ROM</span>
                <p className="text-2xl font-bold text-slate-900">{stats.avgRom}&deg;</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* History Timeline List */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">History</h2>
            <span className="text-xs text-slate-500">{sessions.length} records</span>
          </div>

          {sessions.length > 0 ? (
            <div className="space-y-3">
              {sessions.map((s) => (
                <Card key={s.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                          <Dumbbell className="w-4 h-4" />
                        </div>
                        <h3 className="text-sm font-medium text-slate-900">
                          {s.exerciseName}
                        </h3>
                      </div>

                      <span className="text-xs text-slate-500">
                        {new Date(s.date).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-center">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Completed</p>
                        <p className="text-sm font-semibold text-slate-900">
                          {s.completedReps}/{s.targetReps}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">ROM</p>
                        <p className="text-sm font-semibold text-slate-900">
                          {s.rom}&deg;
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Good Form</p>
                        <p className="text-sm font-semibold text-slate-900">
                          {s.goodFormCount}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-slate-50 border-dashed">
              <CardContent className="p-8 flex flex-col items-center justify-center space-y-4">
                <BarChart3 className="w-8 h-8 text-slate-400" />
                <p className="text-sm text-slate-500 text-center">
                  No recorded session history found yet.
                </p>
                <Button asChild>
                  <Link href="/exercise">
                    Start Session
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </AppShell>
  );
}
