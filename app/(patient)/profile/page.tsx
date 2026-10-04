"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  User,
  ShieldCheck,
  Stethoscope,
  Bell,
  Volume2,
  Lock,
  LogOut,
  ChevronRight,
  Flame,
  Loader2,
} from "lucide-react";
import { useUser, useClerk, useAuth } from "@clerk/react";
import AppShell from "@/components/layout/AppShell";
import { getAggregateStats } from "@/lib/session/sessionStore";

export default function ProfilePage() {
  const router = useRouter();
  const { user } = useUser();
  const { getToken } = useAuth();
  const { signOut } = useClerk();

  // Settings toggles
  const [audioFeedback, setAudioFeedback] = useState(true);
  const [dailyReminders, setDailyReminders] = useState(true);

  // DB Data states
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [stats, setStats] = useState({ totalSessions: 0, totalReps: 0, avgRom: 0 });

  useEffect(() => {
    if (user?.publicMetadata?.role === "therapist") {
      router.replace("/therapist?tab=profile");
      return;
    }

    // Initial local stats
    const localStats = getAggregateStats();
    setStats(localStats);

    fetchProfileData();
  }, [user, router]);

  const fetchProfileData = async () => {
    try {
      setIsLoading(true);
      const token = await getToken();
      if (!token) return;

      const res = await fetch("/api/patient/dashboard", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setDashboardData(json.data);
          if (json.data.stats && (json.data.stats.totalSessions > 0 || stats.totalSessions === 0)) {
            setStats(json.data.stats);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load profile data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const profile = dashboardData?.profile;
  const therapist = dashboardData?.therapist;
  const assignment = dashboardData?.assignment;
  const concerns =
    profile?.concerns && profile.concerns.length > 0
      ? profile.concerns
      : ["Neck", "Lower Back", "Shoulder Mobility", "Knee Rehabilitation"];

  return (
    <AppShell title="Profile" showBackNav backHref="/" hideHeader>
      <div className="flex flex-col space-y-5 pb-10 pt-2 px-2 sm:px-0 bg-[#F8FAFC]">
        
        {/* ── Top Header with Back button ──────────────────────────────── */}
        <div className="flex items-center justify-between pt-1">
          <Link
            href="/"
            className="size-9 rounded-full bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors"
          >
            <ChevronLeft className="size-5" />
          </Link>
          <h1 className="text-lg font-bold text-slate-900">Health Profile</h1>
          <div className="size-9" /> {/* Spacer */}
        </div>

        {/* ── Patient Identity Card ─────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)] flex items-center gap-4">
          <div className="relative size-16 rounded-full bg-slate-100 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center shrink-0">
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User className="size-8 text-slate-400" />
            )}
            <span className="absolute bottom-0 right-0 size-3 rounded-full bg-emerald-500 border-2 border-white" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 truncate">
                {user?.fullName || user?.firstName || "Patient"}
              </h2>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded">
                Verified
              </span>
            </div>
            <p className="text-xs text-slate-500 truncate mt-0.5">
              {user?.primaryEmailAddress?.emailAddress || "patient@swasthya.health"}
            </p>
            <p className="text-[11px] font-medium text-slate-400 mt-1">
              Member ID: #SW-9482 • Active Plan
            </p>
          </div>
        </div>

        {/* ── Quick Health Snapshot (4 Metrics from DB) ───────────────── */}
        <div className="grid grid-cols-4 gap-2 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(15,23,42,0.04)] text-center">
          <div>
            <span className="text-lg font-extrabold text-slate-900">{stats.totalSessions}</span>
            <span className="text-[10px] text-slate-400 block font-medium">Sessions</span>
          </div>
          <div className="border-l border-slate-100">
            <span className="text-lg font-extrabold text-slate-900">{stats.totalReps}</span>
            <span className="text-[10px] text-slate-400 block font-medium">Reps</span>
          </div>
          <div className="border-l border-slate-100">
            <span className="text-lg font-extrabold text-slate-900">{stats.avgRom}&deg;</span>
            <span className="text-[10px] text-slate-400 block font-medium">Avg ROM</span>
          </div>
          <div className="border-l border-slate-100 flex flex-col items-center">
            <span className="text-lg font-extrabold text-amber-900 flex items-center gap-0.5">
              5 <Flame className="size-3.5 fill-amber-500 text-amber-500" />
            </span>
            <span className="text-[10px] text-slate-400 block font-medium">Streak</span>
          </div>
        </div>

        {/* ── Active Care Plan & Specialist (from DB) ───────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)] flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Stethoscope className="size-4" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Connected Specialist
              </h3>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/50">
              {therapist ? "Care Active" : "Available"}
            </span>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div>
              <p className="text-sm font-bold text-slate-900">
                {therapist?.professionalName || "No specialist connected yet"}
              </p>
              <p className="text-xs text-slate-500">
                {therapist?.specialization || "Connect with a doctor for a personalized plan"}
              </p>
            </div>
            <Link
              href="/discover"
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              <span>{therapist ? "Manage" : "Browse"}</span>
              <ChevronRight className="size-3.5" />
            </Link>
          </div>
        </div>

        {/* ── Recovery Focus Areas / Reported Concerns ─────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)] flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Recovery Focus Areas
            </h3>
            <span className="text-[11px] font-medium text-slate-400">4 Active</span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {concerns.map((item: string) => (
              <span
                key={item}
                className="text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/60"
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* ── App Preferences & Camera Settings ─────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)] flex flex-col gap-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Therapy Preferences
          </h3>

          {/* Toggle 1: Voice Guidance */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                <Volume2 className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Voice Rep Guidance</p>
                <p className="text-[11px] text-slate-500">Audio cues for form correction</p>
              </div>
            </div>
            <button
              onClick={() => setAudioFeedback(!audioFeedback)}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                audioFeedback ? "bg-emerald-600" : "bg-slate-300"
              }`}
            >
              <div
                className={`size-5 rounded-full bg-white shadow-xs transition-transform ${
                  audioFeedback ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Toggle 2: Daily Reminders */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                <Bell className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Session Reminders</p>
                <p className="text-[11px] text-slate-500">Daily notification at 9:00 AM</p>
              </div>
            </div>
            <button
              onClick={() => setDailyReminders(!dailyReminders)}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                dailyReminders ? "bg-emerald-600" : "bg-slate-300"
              }`}
            >
              <div
                className={`size-5 rounded-full bg-white shadow-xs transition-transform ${
                  dailyReminders ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {/* ── Privacy & Medical Security ───────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <ShieldCheck className="size-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">HIPAA Compliant & Encrypted</p>
              <p className="text-[11px] text-slate-500">Camera data processed on-device</p>
            </div>
          </div>
          <Lock className="size-4 text-slate-400" />
        </div>

        {/* ── Sign Out Button ──────────────────────────────────────────── */}
        <div className="pt-2">
          <button
            onClick={handleSignOut}
            className="w-full h-12 rounded-xl flex items-center justify-center gap-2 font-semibold text-red-600 text-sm bg-red-50/70 hover:bg-red-100/70 border border-red-200/60 active:scale-[0.98] transition-all cursor-pointer"
          >
            <LogOut className="size-4" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* App Version Info */}
        <p className="text-center text-[11px] text-slate-400 pt-2">
          Swasthya v1.0 • Clinical Motion Intelligence
        </p>

      </div>
    </AppShell>
  );
}
