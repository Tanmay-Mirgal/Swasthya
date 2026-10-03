/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/navigation/AppShell";
import { getAggregateStats, getLatestSession } from "@/lib/session/sessionStore";
import { SessionRecord } from "@/lib/exercises/types";
import { getExerciseById } from "@/lib/exercises/registry";
import { Play, ChevronRight, Activity, CalendarDays, CheckCircle2, User, Loader2, AlertCircle, Clock, Search, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth, useUser } from "@clerk/react";

export default function HomePage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  
  const [stats, setStats] = useState({ totalSessions: 0, totalReps: 0, avgRom: 0 });
  const [latestSession, setLatestSession] = useState<SessionRecord | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStats(getAggregateStats());
    setLatestSession(getLatestSession());
    
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      const token = await getToken();
      if (!token) return;

      const res = await fetch("/api/patient/dashboard", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!res.ok) {
        const text = await res.text();
        try {
           const json = JSON.parse(text);
           setError(json.error || "Failed to load dashboard data");
        } catch {
           setError("Failed to load dashboard data (Server returned non-JSON)");
        }
        return;
      }

      const data = await res.json();
      if (data.success) {
        setDashboardData(data.data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("Failed to load dashboard data");
    } finally {
      setIsLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  if (isLoading) {
    return (
      <AppShell hideHeader>
        <div className="flex h-full items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell hideHeader>
        <div className="flex flex-col h-full items-center justify-center p-6 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <h2 className="text-xl font-semibold text-slate-900">Error loading dashboard</h2>
          <p className="text-slate-500">{error}</p>
        </div>
      </AppShell>
    );
  }

  const { profile, assignment, therapist, pendingRequest, requestedTherapist, exerciseAssignments } = dashboardData || {};

  // Enrich exercise assignments with registry data
  const enrichedAssignments = exerciseAssignments?.map((ea: any) => {
    const ex = getExerciseById(ea.exerciseId);
    return {
      ...ea,
      exercise: ex
    };
  }).filter((ea: any) => ea.exercise) || [];

  const featuredAssignment = enrichedAssignments.length > 0 ? enrichedAssignments[0] : null;

  return (
    <AppShell hideHeader>
      <div className="flex flex-col space-y-8 pb-4 pt-2">
        
        {/* Top Profile / Greeting Area */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-medium tracking-tight text-slate-900">
              {getGreeting()}, {user?.firstName || "Patient"}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
               {assignment ? "Your care plan is active." : "Let's connect you with care."}
            </p>
          </div>
          <Link href="/profile" className="shrink-0 group">
            <div className="w-11 h-11 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center transition-transform group-hover:scale-105 group-active:scale-95">
              {user?.imageUrl ? (
                 <img src={user.imageUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-5 h-5 text-slate-500" />
              )}
            </div>
          </Link>
        </div>
        
        {/* Relationship / Therapist Section */}
        <section>
          {assignment && assignment.status === "active" ? (
            // STATE C: Therapist accepted
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between">
                 <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                   Your Therapist
                 </h2>
                 <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-sm">Active</span>
              </div>
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                   <User className="w-6 h-6 text-blue-600" />
                 </div>
                 <div>
                    <p className="text-base font-medium text-slate-900">{therapist?.professionalName || "Assigned Therapist"}</p>
                    <p className="text-sm text-slate-500">{therapist?.specialization || "Physical Therapist"}</p>
                 </div>
              </div>
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                 <Button asChild variant="outline" className="flex-1 text-sm h-9">
                   <Link href={`/chat/${therapist?.clerkUserId}`}>
                     <MessageSquare className="w-4 h-4 mr-2" /> Message
                   </Link>
                 </Button>
                 <Button asChild variant="secondary" className="flex-1 text-sm h-9">
                   <Link href={`/therapist-profile/${therapist?.clerkUserId}`}>
                     View Profile
                   </Link>
                 </Button>
              </div>
            </div>
          ) : pendingRequest ? (
            // STATE B: Appointment request pending
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-1.5 mb-4">
                <Clock className="w-4 h-4 text-amber-500" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Appointment Request
                </h2>
              </div>
              
              <div className="bg-slate-50 rounded-xl p-4 flex flex-col gap-3">
                 <p className="text-sm font-medium text-slate-900">Waiting for response</p>
                 <p className="text-xs text-slate-500 leading-relaxed">
                   Your request has been sent to <strong>{requestedTherapist?.professionalName || "the therapist"}</strong>. We'll notify you when they review your request.
                 </p>
                 <Button asChild variant="outline" className="w-full mt-2 h-9 text-xs">
                   <Link href="/requests">View Request Details</Link>
                 </Button>
              </div>
            </div>
          ) : (
            // STATE A: No therapist interaction yet
            <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 rounded-lg">
                  <Search className="w-4 h-4 text-blue-600" />
                </div>
                <h2 className="text-sm font-semibold text-slate-900">Find a Therapist</h2>
              </div>
              
              <p className="text-xs text-slate-600 leading-relaxed">
                Connect with a specialist based on your reported concerns: 
                <span className="font-medium text-slate-900 ml-1">
                  {(profile?.concerns || []).join(", ") || "Rehabilitation"}
                </span>
              </p>
              
              <Button asChild className="w-full bg-blue-600 hover:bg-blue-700 text-white h-10 mt-1">
                 <Link href="/discover">
                   Browse Recommended Therapists
                 </Link>
              </Button>
            </div>
          )}
        </section>

        {/* STATE D: Active exercise plan */}
        {assignment && assignment.status === "active" && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Your Exercises
            </h2>
            
            {!featuredAssignment ? (
               <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center space-y-2">
                   <p className="text-sm font-medium text-slate-900">No active exercises.</p>
                   <p className="text-xs text-slate-500">Your therapist will assign exercises here.</p>
               </div>
            ) : (
               <div className="relative bg-slate-900 text-white rounded-2xl p-5 shadow-lg overflow-hidden group">
                 <div className="absolute top-0 right-0 p-4 opacity-10 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6">
                   <Activity className="w-32 h-32 -mt-4 -mr-4" />
                 </div>
                 
                 <div className="relative z-10">
                   <div className="inline-block px-2.5 py-1 bg-white/20 rounded-md text-[10px] font-semibold tracking-wide uppercase mb-4 backdrop-blur-sm">
                     {featuredAssignment.type === "assigned" ? "Assigned by therapist" : "Suggested"}
                   </div>
                   
                   <h3 className="text-xl font-semibold mb-1">{featuredAssignment.exercise.name}</h3>
                   <p className="text-sm text-slate-300 mb-6 font-medium">
                     {featuredAssignment.targetReps} reps • {featuredAssignment.exercise.difficulty}
                   </p>
                   
                   <Button asChild className="w-full bg-white text-slate-900 hover:bg-slate-100 h-12 rounded-xl text-sm font-semibold shadow-sm transition-all group-hover:shadow-md">
                     <Link href={`/exercise/${featuredAssignment.exercise.id}/setup`}>
                       Start Session <ChevronRight className="w-4 h-4 ml-1.5" />
                     </Link>
                   </Button>
                 </div>
               </div>
            )}

            {/* Other Exercises List */}
            {enrichedAssignments.length > 1 && (
               <div className="flex flex-col mt-4">
                 <h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2 px-1">
                   More in Your Plan
                 </h2>
                 {enrichedAssignments.slice(1).map((ea: any) => (
                   <Link 
                     key={ea._id}
                     href={`/exercise/${ea.exercise.id}/setup`} 
                     className="flex items-center justify-between py-3 px-3 bg-white border border-slate-100 rounded-xl mb-2 group shadow-sm hover:border-slate-200 transition-colors"
                   >
                     <div>
                       <h3 className="text-sm font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
                         {ea.exercise.name}
                       </h3>
                       <p className="text-xs text-slate-500 mt-0.5">
                         {ea.targetReps} reps • {ea.type === "assigned" ? "Assigned" : "Suggested"}
                       </p>
                     </div>
                     <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-colors" />
                   </Link>
                 ))}
               </div>
            )}
          </section>
        )}

        {/* STATE E: Completed activity */}
        <section>
          <div className="flex items-center gap-1.5 mb-3">
            <CalendarDays className="w-4 h-4 text-slate-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Your Progress
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
              Complete your first session to start building your progress.
            </p>
          )}
        </section>

      </div>
    </AppShell>
  );
}
