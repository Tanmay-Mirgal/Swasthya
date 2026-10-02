/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/navigation/AppShell";
import { getAggregateStats, getLatestSession } from "@/lib/session/sessionStore";
import { SessionRecord } from "@/lib/exercises/types";
import { getAllExercises } from "@/lib/exercises/registry";
import { Play, Activity, ChevronRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

export default function HomePage() {
  const [stats, setStats] = useState({ totalSessions: 0, totalReps: 0, avgRom: 0 });
  const [latestSession, setLatestSession] = useState<SessionRecord | null>(null);
  const exercises = getAllExercises();

  useEffect(() => {
    setStats(getAggregateStats());
    setLatestSession(getLatestSession());
  }, []);

  return (
    <AppShell title="Dashboard">
      <div className="space-y-6">
        
        {/* Welcome & Primary Action */}
        <section className="space-y-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Ready to train?</h1>
            <p className="text-slate-500 text-sm mt-1">
              Select an exercise and follow the on-screen instructions.
            </p>
          </div>
          
          <Button asChild size="lg" className="w-full">
            <Link href="/exercise">
              <Play className="w-4 h-4 mr-2 fill-current" />
              Start Session
            </Link>
          </Button>
        </section>

        {/* Progress Overview */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-slate-900">Your Progress</h2>
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4 flex flex-col justify-center items-center text-center">
                <span className="text-3xl font-bold tracking-tight text-slate-900">
                  {stats.totalSessions}
                </span>
                <span className="text-xs text-slate-500 mt-1">Sessions</span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex flex-col justify-center items-center text-center">
                <span className="text-3xl font-bold tracking-tight text-slate-900">
                  {stats.totalReps}
                </span>
                <span className="text-xs text-slate-500 mt-1">Total Reps</span>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Available Programs */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-900">Programs</h2>
            <Link href="/exercise" className="text-xs text-slate-500 hover:text-slate-900">
              View All
            </Link>
          </div>

          <div className="space-y-2">
            {exercises.slice(0, 3).map((ex) => (
              <Link
                key={ex.id}
                href={`/exercise/${ex.id}/setup`}
                className="group block"
              >
                <Card className="hover:border-slate-300 transition-colors">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                        <Activity className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-slate-900">
                          {ex.name}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {ex.targetReps} reps • {ex.difficulty}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* Recent Session */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-slate-900">Recent Activity</h2>

          {latestSession ? (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-slate-600" />
                    <span className="text-sm font-medium text-slate-900">
                      {latestSession.exerciseName}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {new Date(latestSession.date).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-100">
                  <span className="font-medium text-slate-900">
                    {latestSession.completedReps} Reps Completed
                  </span>
                  <span className="text-slate-500">
                    {latestSession.goodFormCount} Good Reps
                  </span>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-sm text-slate-500">
                  No completed sessions yet. Start an exercise to record your first session.
                </p>
              </CardContent>
            </Card>
          )}
        </section>

        <div className="pb-4">
          <Link
            href="/therapist"
            className="text-xs text-slate-500 hover:text-slate-900 underline underline-offset-4"
          >
            Switch to Therapist View
          </Link>
        </div>

      </div>
    </AppShell>
  );
}
