/* eslint-disable react-hooks/immutability */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { getAggregateStats, getLatestSession } from "@/lib/session/sessionStore";
import { SessionRecord } from "@/lib/exercises/types";
import { getExerciseById } from "@/lib/exercises/registry";
import {
  ChevronRight,
  CheckCircle2,
  User,
  Loader2,
  AlertCircle,
  Camera,
  Activity,
  ShieldCheck,
  Video,
  Play,
  Check,
  Flame,
  ArrowUpRight,
  Target,
  CalendarCheck
} from "lucide-react";
import { useAuth, useUser } from "@clerk/react";
import SplashScreen from "@/components/splash/SplashScreen";

interface ExerciseItem {
  id: string;
  name: string;
  primaryJoint?: string;
  movement?: string;
  category?: string;
  description?: string;
}

interface DashboardData {
  profile?: { concerns?: string[] };
  assignment?: { status: string };
  therapist?: { professionalName: string; clerkUserId: string; specialization?: string };
  pendingRequest?: boolean;
  requestedTherapist?: { professionalName: string };
  exerciseAssignments?: { exerciseId: string; targetReps: number; targetSets: number }[];
  activeConsultation?: { _id: string; issue: string };
  consultationDoctor?: { professionalName: string };
  recommendation?: {
    exercise: ExerciseItem;
    targetReps: number;
    targetSets: number;
    matchType: string;
    matchedConcern: string;
    clinicalRationale: string;
  };
  stats?: { totalSessions: number; totalReps: number; avgRom: number };
  latestSession?: SessionRecord;
  isTherapist?: boolean;
  redirect?: string;
}

export default function HomePage() {
  const router = useRouter();
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();

  const [stats, setStats] = useState({ totalSessions: 0, totalReps: 0, avgRom: 0 });
  const [latestSession, setLatestSession] = useState<SessionRecord | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
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

  if (isLoaded && !isSignedIn) {
    return <SplashScreen launchHref="/onboarding" signInHref="/sign-in" />;
  }

  if (isLoading) {
    return (
      <AppShell hideHeader>
        <div className="flex h-screen items-center justify-center bg-[#F6F8F7]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <p className="text-sm font-medium text-slate-500">Calibrating recovery telemetry...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell hideHeader>
        <div className="flex flex-col h-screen items-center justify-center p-6 text-center bg-[#F6F8F7]">
          <AlertCircle className="w-10 h-10 text-rose-500 mb-4" />
          <h2 className="text-xl font-bold text-slate-900">Unable to load dashboard</h2>
          <p className="text-slate-500 mt-2">{error}</p>
        </div>
      </AppShell>
    );
  }

  const {
    assignment,
    therapist,
    pendingRequest,
    requestedTherapist,
    exerciseAssignments,
    activeConsultation,
    consultationDoctor,
    recommendation,
  } = dashboardData || {};

  const enrichedAssignments =
    exerciseAssignments
      ?.map((ea) => {
        const ex = getExerciseById(ea.exerciseId);
        return {
          ...ea,
          exercise: ex,
        };
      })
      .filter((ea) => ea.exercise) || [];

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

  const currentExercise =
    featuredAssignment?.exercise ||
    getExerciseById("neck-rotation") ||
    getExerciseById("seated-knee-extension") || {
      id: "neck-rotation",
      name: "Neck Rotation",
      category: "Cervical Spine",
      primaryJoint: "neck",
      movement: "rotation",
      description: "Gentle cervical rotation to restore mobility and alleviate tension.",
    };

  const exerciseId = currentExercise.id || "neck-rotation";
  const exerciseName = currentExercise.name || "Neck Rotation";
  const targetReps = featuredAssignment?.targetReps || 15;
  const targetSets = featuredAssignment?.targetSets || 3;
  const targetJoint =
    currentExercise.primaryJoint
      ? currentExercise.primaryJoint.charAt(0).toUpperCase() + currentExercise.primaryJoint.slice(1)
      : "Cervical Spine";
  const movementType =
    currentExercise.movement
      ? currentExercise.movement.charAt(0).toUpperCase() + currentExercise.movement.slice(1)
      : "Rotation";

  const clinicalRationale =
    featuredAssignment && "clinicalRationale" in featuredAssignment && featuredAssignment.clinicalRationale
      ? featuredAssignment.clinicalRationale
      : "Prescribed to restore rotational flexibility, decompress cervical facet joints, and correct compensatory shoulder elevation.";

  const weekDays = [
    { label: "M", completed: true },
    { label: "T", completed: true },
    { label: "W", completed: true },
    { label: "T", completed: false, isToday: true },
    { label: "F", completed: false },
    { label: "S", completed: false },
    { label: "S", completed: false },
  ];

  return (
    <AppShell hideHeader maxWidth="wide">
      <main className="w-full min-h-screen bg-[#F6F8F7] font-sans pb-24 text-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">

          {/* ACTIVE CONSULTATION / TELEHEALTH CALLOUT (When active) */}
          {activeConsultation && (
            <section className="mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white px-6 sm:px-8 py-4 sm:py-5 rounded-2xl shadow-xl shadow-slate-900/10 border border-teal-800/40">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex h-3.5 w-3.5 relative shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-300 bg-emerald-950/70 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                      Telehealth Active
                    </span>
                    <span className="text-base font-semibold text-white">
                      {consultationDoctor?.professionalName || "Dr. Sarah Jenkins"}
                    </span>
                  </div>
                  <span className="text-slate-500 hidden sm:inline">•</span>
                  <span className="text-sm text-teal-200/90 font-medium">
                    {activeConsultation.issue || "Rehabilitation Focus Session"}
                  </span>
                </div>
                <Link
                  href={`/consultation/${activeConsultation._id}`}
                  className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-emerald-950 bg-emerald-400 hover:bg-emerald-300 px-5 py-2.5 rounded-xl transition-all shadow-sm shrink-0"
                >
                  <Video className="w-4 h-4" />
                  Join Consultation
                </Link>
              </div>
            </section>
          )}

          {/* PATIENT HEADER & STATUS MASTHEAD */}
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-4 pb-8 border-b border-slate-200/70 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full">
                  <Activity className="w-3.5 h-3.5 text-emerald-700" />
                  Active Recovery Protocol
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  Week 3 of 6 • Cervical & Upper Body
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900">
                {getGreeting()}, {user?.firstName || "Aditya"}
              </h1>
              <p className="text-slate-600 mt-2 text-base font-medium max-w-xl">
                Your computer vision calibration is ready. Complete today&apos;s prescribed movement to maintain your range of motion trajectory.
              </p>
            </div>

            {/* Quick Readiness Card */}
            <div className="flex items-center gap-4 bg-white px-5 py-3.5 rounded-2xl border border-slate-200/80 shadow-sm shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Vision System</span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">Pose Tracker Calibrated (60fps)</p>
                </div>
              </div>
            </div>
          </header>

          {/* PRIMARY WORKSPACE: THE GUIDED SESSION HERO (FOCAL POINT) */}
          <section className="mb-10">
            <div className="bg-white rounded-[2rem] border border-slate-200/80 shadow-[0_20px_50px_-20px_rgba(15,81,50,0.08)] overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-12">
                
                {/* Left Side: Clinical Prescription & Primary Action */}
                <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-between">
                  <div>
                    {/* Badge & Mode */}
                    <div className="flex flex-wrap items-center gap-2.5 mb-6">
                      <span className="inline-flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-bold tracking-wide uppercase px-3 py-1 rounded-full shadow-sm">
                        <Flame className="w-3.5 h-3.5" />
                        Today&apos;s Prescribed Session
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 bg-slate-100 px-3 py-1 rounded-full">
                        <Target className="w-3.5 h-3.5 text-slate-600" />
                        Target: {targetJoint} ({movementType})
                      </span>
                    </div>

                    {/* Exercise Title */}
                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight mb-4">
                      {exerciseName}
                    </h2>

                    {/* Prescribed Dose Metrics */}
                    <div className="grid grid-cols-3 gap-3 sm:gap-4 my-6 py-4 border-y border-slate-100">
                      <div>
                        <span className="text-xs font-semibold text-slate-500 block uppercase tracking-wider">Volume</span>
                        <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-0.5">
                          {targetSets} <span className="text-sm font-semibold text-slate-500">sets</span>
                        </div>
                        <span className="text-xs text-slate-500 font-medium">{targetReps} reps per set</span>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-slate-500 block uppercase tracking-wider">Estimated</span>
                        <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-0.5">
                          8 <span className="text-sm font-semibold text-slate-500">mins</span>
                        </div>
                        <span className="text-xs text-slate-500 font-medium">Guided cadence</span>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-slate-500 block uppercase tracking-wider">Target ROM</span>
                        <div className="text-2xl sm:text-3xl font-black text-emerald-600 mt-0.5">
                          85° <span className="text-sm font-semibold text-slate-500">arc</span>
                        </div>
                        <span className="text-xs text-slate-500 font-medium">Axis precision</span>
                      </div>
                    </div>

                    {/* Clinical Rationale Box */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/60 border border-emerald-100 mb-8">
                      <div className="flex items-center gap-2 mb-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-700" />
                        <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                          Clinical Prescription Rationale
                        </span>
                      </div>
                      <p className="text-sm font-medium text-emerald-950 leading-relaxed">
                        {clinicalRationale}
                      </p>
                    </div>
                  </div>

                  {/* Primary Call to Action */}
                  <div className="pt-2">
                    <Link
                      href={`/exercise/${exerciseId}/setup`}
                      className="group w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg px-8 py-5 rounded-2xl shadow-lg shadow-emerald-700/20 hover:shadow-xl hover:shadow-emerald-700/30 transition-all duration-200 transform hover:-translate-y-0.5"
                    >
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/80 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Play className="w-4 h-4 fill-white text-white translate-x-0.5" />
                      </div>
                      <span>Begin Guided Session</span>
                      <ChevronRight className="w-5 h-5 text-emerald-200 group-hover:translate-x-1 transition-transform" />
                    </Link>
                    <p className="text-xs text-slate-500 font-medium mt-3 flex items-center gap-2">
                      <Camera className="w-3.5 h-3.5 text-slate-500" />
                      Requires camera access • Real-time computer vision joint feedback
                    </p>
                  </div>
                </div>

                {/* Right Side: Biomechanical Computer Vision Console & Pose Wireframe */}
                <div className="lg:col-span-5 bg-gradient-to-br from-[#0B1E19] via-[#081714] to-[#0A1815] p-6 sm:p-8 lg:p-10 flex flex-col justify-between text-white border-t lg:border-t-0 lg:border-l border-emerald-900/30 relative overflow-hidden">
                  
                  {/* Subtle Background Glow */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

                  {/* Console Header */}
                  <div className="flex items-center justify-between z-10 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                        Pose Mesh Telemetry
                      </span>
                    </div>
                    <span className="text-xs font-mono text-emerald-400/80 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/20">
                      60 FPS • 33 Keypoints
                    </span>
                  </div>

                  {/* Bespoke Biomechanical Posture & Angle Wireframe SVG */}
                  <div className="relative py-4 flex items-center justify-center z-10">
                    <svg className="w-full max-w-[280px] h-[220px]" viewBox="0 0 280 220" fill="none">
                      {/* Grid crosshair guides */}
                      <circle cx="140" cy="110" r="95" stroke="#059669" strokeWidth="1" strokeDasharray="3 4" opacity="0.25" />
                      <line x1="140" y1="15" x2="140" y2="205" stroke="#059669" strokeWidth="1" strokeDasharray="2 4" opacity="0.3" />
                      <line x1="45" y1="110" x2="235" y2="110" stroke="#059669" strokeWidth="1" strokeDasharray="2 4" opacity="0.3" />

                      {/* Head Landmark Node */}
                      <circle cx="140" cy="45" r="14" stroke="#34D399" strokeWidth="2" fill="#064E3B" fillOpacity="0.6" />
                      <circle cx="140" cy="45" r="4" fill="#34D399" />

                      {/* Cervical Axis Line */}
                      <line x1="140" y1="59" x2="140" y2="82" stroke="#34D399" strokeWidth="3" />

                      {/* Clavicle & Shoulder Span */}
                      <line x1="90" y1="85" x2="190" y2="85" stroke="#10B981" strokeWidth="3" strokeLinecap="round" />
                      
                      {/* Shoulder Joints */}
                      <circle cx="90" cy="85" r="6" fill="#10B981" />
                      <circle cx="90" cy="85" r="10" stroke="#10B981" strokeWidth="1.5" opacity="0.5" />
                      <circle cx="190" cy="85" r="6" fill="#10B981" />
                      <circle cx="190" cy="85" r="10" stroke="#10B981" strokeWidth="1.5" opacity="0.5" />

                      {/* Spine Axis */}
                      <line x1="140" y1="85" x2="140" y2="165" stroke="#059669" strokeWidth="3" strokeDasharray="4 2" />

                      {/* Thoracic / Arm vectors */}
                      <line x1="90" y1="85" x2="70" y2="140" stroke="#059669" strokeWidth="2.5" opacity="0.8" />
                      <line x1="190" y1="85" x2="210" y2="140" stroke="#059669" strokeWidth="2.5" opacity="0.8" />
                      <circle cx="70" cy="140" r="4.5" fill="#34D399" />
                      <circle cx="210" cy="140" r="4.5" fill="#34D399" />

                      {/* Hip Nexus */}
                      <line x1="110" y1="165" x2="170" y2="165" stroke="#10B981" strokeWidth="2.5" />
                      <circle cx="110" cy="165" r="4" fill="#10B981" />
                      <circle cx="170" cy="165" r="4" fill="#10B981" />

                      {/* Dynamic Range of Motion Arc at Cervical Joint */}
                      <path
                        d="M 140 45 A 50 50 0 0 1 182 62"
                        stroke="#F59E0B"
                        strokeWidth="3"
                        strokeLinecap="round"
                        fill="none"
                      />
                      <circle cx="182" cy="62" r="3.5" fill="#F59E0B" />

                      {/* Biomechanical Telemetry Overlay Labels */}
                      <rect x="180" y="30" width="70" height="24" rx="6" fill="#0B2E24" stroke="#10B981" strokeWidth="1" />
                      <text x="215" y="46" fill="#34D399" fontSize="11" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                        78° ROM
                      </text>

                      <rect x="25" y="165" width="85" height="24" rx="6" fill="#0B2E24" stroke="#059669" strokeWidth="1" />
                      <text x="67" y="181" fill="#A7F3D0" fontSize="10" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
                        FORM: 98%
                      </text>
                    </svg>
                  </div>

                  {/* Telemetry Footer Status */}
                  <div className="z-10 bg-emerald-950/60 rounded-xl p-3.5 border border-emerald-500/20">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-300 font-medium">Neural Pose Latency</span>
                      <span className="font-mono text-emerald-300 font-bold">11.4 ms</span>
                    </div>
                    <div className="w-full bg-emerald-900/60 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-400 h-full rounded-full w-[94%]" />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 font-medium">
                      <span>Live Edge Tracking</span>
                      <span className="text-emerald-300">Target Range 85° Active</span>
                    </div>
                  </div>

                </div>

              </div>
            </div>
          </section>

          {/* SECONDARY FOCAL POINT: RECOVERY TRAJECTORY & CLINICAL BIOMETRICS */}
          <section className="mb-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Radial Mobility & Range of Motion Target */}
              <div className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">Recovery Trajectory</h3>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">Mobility index vs clinical protocol</p>
                    </div>
                    <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/70 px-2.5 py-1 rounded-full">
                      On Track
                    </span>
                  </div>

                  {/* Circular Arc Visual */}
                  <div className="relative w-44 h-44 mx-auto my-4">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="transparent"
                        className="text-slate-100"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="#059669"
                        strokeWidth="8"
                        fill="transparent"
                        strokeDasharray="251.2"
                        strokeDashoffset={251.2 * (1 - 0.75)}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-4xl font-black text-slate-900 tracking-tight">75%</span>
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                        Mobility Target
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 font-medium">Trajectory Progress</span>
                    <span className="font-bold text-slate-900">+12% vs Baseline</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Cervical rotational arc expanded from 55° to 78° over the last 14 days.
                  </p>
                </div>
              </div>

              {/* Weekly Rhythm & Telemetry Cards */}
              <div className="lg:col-span-7 flex flex-col gap-6">
                
                {/* 7-Day Rehabilitation Rhythm */}
                <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <CalendarCheck className="w-4 h-4 text-emerald-700" />
                      <h4 className="text-base font-bold text-slate-900">Rehabilitation Cadence</h4>
                    </div>
                    <span className="text-xs font-semibold text-slate-500">4 of 5 sessions completed</span>
                  </div>

                  <div className="grid grid-cols-7 gap-2">
                    {weekDays.map((day, idx) => (
                      <div
                        key={idx}
                        className={`flex flex-col items-center justify-center py-3 rounded-2xl transition-all ${
                          day.completed
                            ? "bg-emerald-50 border border-emerald-200/80 text-emerald-900"
                            : day.isToday
                            ? "bg-slate-900 text-white shadow-md"
                            : "bg-[#F8FAF9] border border-slate-100 text-slate-400"
                        }`}
                      >
                        <span className="text-xs font-bold">{day.label}</span>
                        <div className="mt-1">
                          {day.completed ? (
                            <Check className="w-3.5 h-3.5 text-emerald-700" strokeWidth={3} />
                          ) : day.isToday ? (
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse block" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 block" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3 Detailed Biometric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
                  
                  {/* Form Precision */}
                  <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
                    <div>
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                        Form Accuracy
                      </span>
                      <div className="text-3xl font-black text-slate-900 mt-2">
                        94<span className="text-lg text-emerald-600">%</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> High precision
                      </span>
                    </div>
                  </div>

                  {/* Active Time */}
                  <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
                    <div>
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                        Active Time
                      </span>
                      <div className="text-3xl font-black text-slate-900 mt-2">
                        18<span className="text-sm font-semibold text-slate-500"> / 30m</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <span className="text-xs text-slate-500 font-medium">Daily target: 30 mins</span>
                    </div>
                  </div>

                  {/* Completed Sessions */}
                  <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
                    <div>
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                        Total Sessions
                      </span>
                      <div className="text-3xl font-black text-slate-900 mt-2">
                        {stats.totalSessions}
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <span className="text-xs text-slate-500 font-medium">
                        {stats.totalReps} total tracked reps
                      </span>
                    </div>
                  </div>

                </div>

              </div>

            </div>
          </section>

          {/* TERTIARY SECTION: VERIFIED RECENT ACTIVITY & CARE TEAM */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Recent Verified Activity */}
            <article className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Verified Activity</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Recorded biomechanical telemetry</p>
                </div>
                <Link
                  href="/exercise"
                  className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1"
                >
                  Exercise Library <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {latestSession ? (
                <div className="p-5 rounded-2xl bg-[#F8FAF9] border border-slate-100 hover:border-slate-200 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-base">{latestSession.exerciseName}</h4>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          {latestSession.completedReps} repetitions completed • {latestSession.rom || 78}° ROM recorded
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-400 shrink-0">
                      {new Date(latestSession.date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-200/60">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                      <Check className="w-3 h-3 text-emerald-700" /> 98% Form Accuracy
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Zero compensatory drift detected
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-8 rounded-2xl bg-[#F8FAF9] border border-slate-100 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <Activity className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-800">No recorded sessions yet</p>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
                    Complete your first prescribed session above to establish your personal baseline.
                  </p>
                </div>
              )}
            </article>

            {/* Care Team Supervision */}
            <article className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Care Team Supervision</h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Clinical guidance & prescription</p>
                  </div>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                    Direct Liaison
                  </span>
                </div>

                {assignment && assignment.status === "active" ? (
                  <div className="p-5 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-sm">
                        <User className="w-7 h-7" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-emerald-950 text-lg">
                            {therapist?.professionalName || "Dr. Sarah Jenkins"}
                          </h4>
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        </div>
                        <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                          {therapist?.specialization || "Orthopedic Physical Therapist"}
                        </p>
                        <p className="text-xs text-emerald-900/80 font-medium mt-1">
                          Reviewing your movement telemetry weekly
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mt-5 pt-4 border-t border-emerald-200/60">
                      <Link
                        href={`/chat/${therapist?.clerkUserId}`}
                        className="text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 px-4 py-2 rounded-xl transition-all shadow-sm"
                      >
                        Message Therapist
                      </Link>
                      <Link
                        href={`/therapist-profile/${therapist?.clerkUserId}`}
                        className="text-xs font-bold text-emerald-800 hover:text-emerald-950 px-3 py-2 transition-colors"
                      >
                        View Profile
                      </Link>
                    </div>
                  </div>
                ) : pendingRequest ? (
                  <div className="p-6 rounded-2xl bg-[#F8FAF9] border border-slate-100">
                    <h4 className="font-bold text-slate-900 text-base">Referral Pending</h4>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      Your rehabilitation request has been routed to {requestedTherapist?.professionalName || "the specialist"}.
                    </p>
                    <Link
                      href="/requests"
                      className="inline-flex items-center gap-1.5 mt-4 text-xs font-bold text-emerald-800 hover:text-emerald-950"
                    >
                      View referral status <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl bg-[#F8FAF9] border border-slate-100 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-base mb-1">Need 1-on-1 Clinical Supervision?</h4>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed">
                        Connect with specialized physical therapists who can review your computer vision pose telemetry and adjust prescriptions.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-200/60">
                      <Link
                        href="/discover"
                        className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-950"
                      >
                        Browse Certified Specialists <ArrowUpRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </article>

          </section>

        </div>
      </main>
    </AppShell>
  );
}
