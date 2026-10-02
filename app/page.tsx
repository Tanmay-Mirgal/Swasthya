/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/navigation/AppShell";
import { getAggregateStats, getLatestSession } from "@/lib/session/sessionStore";
import { SessionRecord } from "@/lib/exercises/types";
import { getAllExercises } from "@/lib/exercises/registry";
import { Play, ChevronRight, Activity, CalendarDays, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function HomePage() {
  const [stats, setStats] = useState({ totalSessions: 0, totalReps: 0, avgRom: 0 });
  const [latestSession, setLatestSession] = useState<SessionRecord | null>(null);
  const exercises = getAllExercises();

  useEffect(() => {
    setStats(getAggregateStats());
    setLatestSession(getLatestSession());
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const featuredExercise = exercises[0];

  return (
    <AppShell>
      <div className="flex flex-col space-y-8 pb-4 pt-2">
        
        {/* Top Profile / Greeting Area */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-medium tracking-tight text-slate-900">
              {getGreeting()}, Aditya
            </h1>
            <p className="text-sm text-slate-500 mt-1">Keep your momentum going.</p>
          </div>
          <Link href="/therapist" className="shrink-0 group">
            <div className="w-11 h-11 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center transition-transform group-hover:scale-105 group-active:scale-95">
              <span className="text-sm font-semibold text-slate-500">AD</span>
            </div>
          </Link>
        </div>

        {/* Compact Progress Area */}
        <section>
          <div className="flex items-center gap-1.5 mb-3">
            <CalendarDays className="w-4 h-4 text-slate-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Your Journey
            </h2>
          </div>
          
          <div className="flex items-center justify-between py-4 px-2 border-y border-slate-200">
            <div className="flex flex-col">
              <span className="text-2xl font-semibold text-slate-900">{stats.totalSessions}</span>
              <span className="text-xs text-slate-500 mt-0.5">Sessions</span>
            </div>
            <div className="h-10 w-px bg-slate-200" />
            <div className="flex flex-col">
              <span className="text-2xl font-semibold text-slate-900">{stats.totalReps}</span>
              <span className="text-xs text-slate-500 mt-0.5">Total Reps</span>
            </div>
            <div className="h-10 w-px bg-slate-200" />
            <div className="flex flex-col">
              <span className="text-2xl font-semibold text-slate-900">{stats.avgRom}&deg;</span>
              <span className="text-xs text-slate-500 mt-0.5">Avg ROM</span>
            </div>
          </div>
        </section>

        {/* Primary Featured Exercise Action */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            Up Next
          </h2>
          <div className="relative bg-slate-900 text-white rounded-2xl p-5 shadow-lg overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6">
              <Activity className="w-32 h-32 -mt-4 -mr-4" />
            </div>
            
            <div className="relative z-10">
              <div className="inline-block px-2.5 py-1 bg-white/20 rounded-md text-[10px] font-semibold tracking-wide uppercase mb-4 backdrop-blur-sm">
                Prescribed
              </div>
              
              <h3 className="text-xl font-semibold mb-1">{featuredExercise.name}</h3>
              <p className="text-sm text-slate-300 mb-6 font-medium">
                {featuredExercise.targetReps} reps • {featuredExercise.difficulty}
              </p>
              
              <Button asChild className="w-full bg-white text-slate-900 hover:bg-slate-100 h-12 rounded-xl text-sm font-semibold shadow-sm transition-all group-hover:shadow-md">
                <Link href={`/exercise/${featuredExercise.id}/setup`}>
                  Start Session <ChevronRight className="w-4 h-4 ml-1.5" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Compact Recent Activity */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            Recent Activity
          </h2>
          
          {latestSession ? (
            <div className="flex items-center gap-4 py-1">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {latestSession.exerciseName}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {latestSession.completedReps} reps completed
                </p>
              </div>
              <div className="text-xs font-medium text-slate-400 shrink-0">
                {new Date(latestSession.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic py-2">
              No recent activity found.
            </p>
          )}
        </section>

        {/* Other Exercises List */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Other Exercises
            </h2>
            <Link href="/exercise" className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors">
              See all
            </Link>
          </div>
          
          <div className="flex flex-col">
            {exercises.slice(1, 4).map((ex) => (
              <Link 
                key={ex.id}
                href={`/exercise/${ex.id}/setup`} 
                className="flex items-center justify-between py-3.5 border-b border-slate-100 last:border-0 group"
              >
                <div>
                  <h3 className="text-sm font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
                    {ex.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {ex.targetReps} reps • {ex.difficulty}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-colors" />
              </Link>
            ))}
          </div>
        </section>

      </div>
    </AppShell>
  );
}
