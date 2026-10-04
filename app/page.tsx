/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "@/components/navigation/AppShell";
import { getAggregateStats, getLatestSession } from "@/lib/session/sessionStore";
import { SessionRecord } from "@/lib/exercises/types";
import { getExerciseById } from "@/lib/exercises/registry";
import {
  Play,
  ChevronRight,
  CheckCircle2,
  User,
  Loader2,
  AlertCircle,
  Clock,
  Search,
  MessageSquare,
  Stethoscope,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth, useUser } from "@clerk/react";
import SplashScreen from "@/components/splash/SplashScreen";
import RecoveryRings from "@/components/dashboard/RecoveryRings";

export default function HomePage() {
  const router = useRouter();
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();

  const [stats, setStats] = useState({ totalSessions: 0, totalReps: 0, avgRom: 0 });
  const [latestSession, setLatestSession] = useState<SessionRecord | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isSignedIn && user) {
      if (user.publicMetadata?.role === "therapist") {
        router.replace("/therapist");
        return;
      }
    }
    if (isSignedIn) {
      setStats(getAggregateStats());
      setLatestSession(getLatestSession());
      fetchDashboardData();
    } else if (isLoaded) {
      setIsLoading(false);
    }
  }, [isSignedIn, isLoaded, user, router]);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      const token = await getToken();
      if (!token) return;

      const res = await fetch("/api/patient/dashboard", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (data.isTherapist || data.redirect === "/therapist") {
        router.replace("/therapist");
        return;
      }

      if (!res.ok) {
        setError(data.error || "Failed to load dashboard data");
        return;
      }

      if (data.success) {
        setDashboardData(data.data);
        if (data.data.stats && (data.data.stats.totalSessions > 0 || stats.totalSessions === 0)) {
          setStats(data.data.stats);
        }
        if (data.data.latestSession) {
          setLatestSession(data.data.latestSession);
        }
      } else {
        setError(data.error);
      }
    } catch {
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

  // Unauthenticated user -> Splash Screen
  if (isLoaded && !isSignedIn) {
    return <SplashScreen launchHref="/onboarding" signInHref="/sign-in" />;
  }

  if (isLoading) {
    return (
      <AppShell hideHeader>
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell hideHeader>
        <div className="flex flex-col h-screen items-center justify-center p-6 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <h2 className="text-xl font-semibold text-slate-900">Error loading dashboard</h2>
          <p className="text-slate-500">{error}</p>
        </div>
      </AppShell>
    );
  }

  const { profile, assignment, therapist, pendingRequest, requestedTherapist, exerciseAssignments, activeConsultation, consultationDoctor } =
    dashboardData || {};

  // Enrich exercise assignments with registry data
  const enrichedAssignments =
    exerciseAssignments
      ?.map((ea: any) => {
        const ex = getExerciseById(ea.exerciseId);
        return {
          ...ea,
          exercise: ex,
        };
      })
      .filter((ea: any) => ea.exercise) || [];

  const recommendation = dashboardData?.recommendation;

  const featuredAssignment =
    enrichedAssignments.length > 0
      ? enrichedAssignments[0]
      : recommendation
      ? {
          exercise: recommendation.exercise,
          targetReps: recommendation.targetReps,
          targetSets: recommendation.targetSets,
          type: recommendation.matchType === "doctor_prescribed" ? "assigned" : "suggested",
          matchedConcern: recommendation.matchedConcern,
          clinicalRationale: recommendation.clinicalRationale,
        }
      : null;

  return (
    <AppShell hideHeader>
      <div className="w-full max-w-full flex flex-col space-y-5 pb-6 pt-2 px-0.5 sm:px-0 bg-[#F8FAFC] overflow-x-hidden">
        
        {/* ── 1. HEADER BAR (Apple Health Style) ───────────────────────── */}
        <div className="flex items-center justify-between gap-2 pt-1 w-full">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 truncate">
              {getGreeting()}, {user?.firstName || "Tanmay"}
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 truncate">
              {enrichedAssignments.length > 0
                ? `${enrichedAssignments.length} routines scheduled for today`
                : "2 routines scheduled for today"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Streak Pill */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200/80 shadow-xs">
              <span className="text-xs">🔥</span>
              <span className="text-xs font-bold text-amber-900">5</span>
            </div>

            {/* User Profile Avatar with green health dot */}
            <Link href="/profile" className="relative group shrink-0">
              <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center transition-transform group-hover:scale-105 shadow-xs">
                {user?.imageUrl ? (
                  <img src={user.imageUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-5 h-5 text-slate-600" />
                )}
              </div>
              <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 border-2 border-white" />
            </Link>
          </div>
        </div>

        {/* ── ACTIVE DOCTOR CONSULTATION QUICK BAR (If Active) ────────── */}
        {activeConsultation && (
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-2xl p-4 shadow-md flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <Stethoscope className="size-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold">
                    {consultationDoctor?.professionalName || "Dr. Aarti Sharma"}
                  </span>
                  <span className="text-[10px] bg-emerald-500/80 px-1.5 py-0.5 rounded font-semibold text-emerald-100">
                    {activeConsultation.status === "COMPLETED" ? "Prescription Active" : "Active Consultation"}
                  </span>
                </div>
                <p className="text-[11px] text-emerald-100">
                  Focus: {activeConsultation.issue || "Knee Rehabilitation"}
                </p>
              </div>
            </div>

            <Button
              asChild
              className="bg-white hover:bg-emerald-50 text-emerald-900 font-bold text-xs h-9 px-3 rounded-xl shadow-xs"
            >
              <Link href={`/consultation/${activeConsultation._id}`}>
                <span>Open Room</span>
                <ChevronRight className="size-3.5 ml-0.5" />
              </Link>
            </Button>
          </div>
        )}

        {/* ── 2. CONCENTRIC RECOVERY PROGRESS RINGS CARD ───────────────── */}
        <RecoveryRings
          mobilityPercent={75}
          formPercent={94}
          targetPercent={50}
          completedCount={2}
          totalCount={4}
          activeMinutes={18}
        />

        {/* ── 3. HERO: TODAY'S PRESCRIBED AI THERAPY CARD ─────────────── */}
        <div className="bg-white rounded-2xl border border-emerald-200/80 p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)] relative overflow-hidden group">
          {/* Subtle background radial ambient gradient */}
          <div className="absolute top-0 right-0 w-44 h-44 bg-gradient-to-bl from-emerald-100/30 via-emerald-50/10 to-transparent rounded-bl-full pointer-events-none" />

          <div className="relative z-10 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/60 text-[11px] font-semibold text-emerald-800">
                <Camera className="size-3 text-emerald-600" />
                <span>AI Camera Motion Tracking</span>
              </div>
              <span className="text-[11px] font-medium text-slate-400">
                {featuredAssignment?.matchedConcern
                  ? `For ${featuredAssignment.matchedConcern}`
                  : featuredAssignment?.type === "assigned"
                  ? "Assigned by Therapist"
                  : "Clinical Routine"}
              </span>
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900 group-hover:text-emerald-800 transition-colors">
                {featuredAssignment?.exercise?.name || "Seated Knee Extension"}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {featuredAssignment?.targetReps || 10} Reps × {featuredAssignment?.targetSets || 3} Sets • Real-time Angle Tracking
              </p>

              {featuredAssignment?.clinicalRationale && (
                <p className="text-xs text-emerald-950/80 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200/50 mt-2.5 leading-relaxed font-medium">
                  💡 <span className="font-semibold text-emerald-950">Clinical target:</span> {featuredAssignment.clinicalRationale}
                </p>
              )}
            </div>

            <Link
              href={`/exercise/${featuredAssignment?.exercise?.id || "seated-knee-extension"}/setup`}
              className="mt-1 w-full h-12 rounded-xl flex items-center justify-center gap-2 font-semibold text-white text-sm bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-600/30 active:scale-[0.98] transition-all"
            >
              <span>Begin AI Session</span>
              <Play className="size-4 fill-white" />
            </Link>
          </div>
        </div>

        {/* ── 4. SPECIALIST / DOCTOR CONNECTION CARD ───────────────────── */}
        {assignment && assignment.status === "active" ? (
          // Active Assigned Therapist
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(15,23,42,0.04)] flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-700">
                  <Stethoscope className="size-4" />
                </div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Your Physical Therapist
                </h2>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/50">
                Care Active
              </span>
            </div>

            <div className="flex items-center gap-3.5 pt-1">
              <div className="size-12 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                <User className="size-6 text-slate-500" />
              </div>
              <div>
                <p className="text-base font-bold text-slate-900">
                  {therapist?.professionalName || "Dr. Sarah Jenkins, DPT"}
                </p>
                <p className="text-xs text-slate-500">
                  {therapist?.specialization || "Orthopedic Physical Therapist"}
                </p>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2 border-t border-slate-100">
              <Button asChild variant="outline" className="flex-1 text-xs h-9 rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700">
                <Link href={`/chat/${therapist?.clerkUserId}`}>
                  <MessageSquare className="size-3.5 mr-1.5 text-emerald-600" /> Message
                </Link>
              </Button>
              <Button asChild variant="secondary" className="flex-1 text-xs h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800">
                <Link href={`/therapist-profile/${therapist?.clerkUserId}`}>
                  View Profile
                </Link>
              </Button>
            </div>
          </div>
        ) : pendingRequest ? (
          // Pending Request
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="size-4 text-amber-500" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Appointment Request Pending
              </h2>
            </div>
            <div className="bg-slate-50 rounded-xl p-3.5 text-xs text-slate-600 space-y-2">
              <p>
                Request sent to <strong>{requestedTherapist?.professionalName || "the specialist"}</strong>.
              </p>
              <Button asChild variant="outline" className="w-full h-8 text-xs bg-white rounded-lg">
                <Link href="/requests">View Request Details</Link>
              </Button>
            </div>
          </div>
        ) : (
          // Find Specialist CTA
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(15,23,42,0.04)] flex flex-col gap-3.5">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-emerald-50 border border-emerald-200/50 flex items-center justify-center text-emerald-700 shrink-0">
                <Stethoscope className="size-4.5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Find an Orthopedic Specialist</h2>
                <p className="text-xs text-slate-500">Personalized care for your reported concerns</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {(profile?.concerns && profile.concerns.length > 0
                ? profile.concerns
                : ["Neck", "Back", "Arm / Elbow", "Knee", "Shoulder"]
              ).map((concern: string) => (
                <span
                  key={concern}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-slate-50 text-slate-600 border border-slate-200/80"
                >
                  {concern}
                </span>
              ))}
            </div>

            <Button asChild className="w-full bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-xl h-10 shadow-xs font-semibold text-xs mt-1">
              <Link href="/discover" className="flex items-center justify-center gap-1.5">
                <span>Browse Recommended Specialists</span>
                <ChevronRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        )}

        {/* ── 5. HEALTH METRICS GRID (2x2 Clean White Cards) ───────────── */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 px-1">
            Biometric Health Metrics
          </h2>

          <div className="grid grid-cols-2 gap-3.5">
            {/* Card 1: Completed Sessions */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
              <span className="text-[11px] font-medium text-slate-500 block">Completed Sessions</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-slate-900">{stats.totalSessions}</span>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                  +2 this week
                </span>
              </div>
            </div>

            {/* Card 2: Total Reps */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
              <span className="text-[11px] font-medium text-slate-500 block">Total Reps</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold text-slate-900">{stats.totalReps}</span>
                <span className="text-xs text-slate-400 font-medium ml-1">reps</span>
              </div>
            </div>

            {/* Card 3: Avg ROM with Emerald Sparkline */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
              <span className="text-[11px] font-medium text-slate-500 block">Avg ROM (Range)</span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-2xl font-bold text-slate-900">{stats.avgRom}&deg;</span>
                {/* Mini Sparkline Graph */}
                <svg className="w-14 h-6 text-emerald-500" viewBox="0 0 56 24" fill="none">
                  <path
                    d="M2 18 L16 14 L30 16 L44 8 L54 6"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            {/* Card 4: Form Accuracy */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
              <span className="text-[11px] font-medium text-slate-500 block">Form Accuracy</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold text-slate-900">96%</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2.5 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full w-[96%]" />
              </div>
            </div>
          </div>
        </div>

        {/* ── 6. RECENT ACTIVITY TIMELINE ──────────────────────────────── */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Recent Activity
            </h2>
            <span className="text-[11px] font-medium text-slate-400">Past Sessions</span>
          </div>

          {latestSession ? (
            <div className="flex items-center gap-3.5 py-1">
              <div className="size-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="size-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">
                  {latestSession.exerciseName}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {latestSession.completedReps} reps completed • Form Score: 98%
                </p>
              </div>
              <div className="text-xs font-medium text-slate-400 shrink-0">
                {new Date(latestSession.date).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3.5 py-1">
              <div className="size-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="size-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">
                  Seated Bicep Curl & Arm Extension
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  10 reps completed • Form Score: 98%
                </p>
              </div>
              <div className="text-xs font-medium text-slate-400 shrink-0">
                Today
              </div>
            </div>
          )}
        </div>

      </div>
    </AppShell>
  );
}
