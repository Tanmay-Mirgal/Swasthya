"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "@/components/navigation/AppShell";
import {
  ArrowLeft,
  Loader2,
  Star,
  CheckCircle2,
  Sparkles,
  Video,
  ChevronRight,
  ShieldCheck,
  Stethoscope,
  User as UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth, useUser } from "@clerk/react";
import DoctorAvatar from "@/components/ui/DoctorAvatar";

export default function DiscoverTherapistsPage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [startingConsultationId, setStartingConsultationId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.publicMetadata?.role === "therapist") {
      router.replace("/therapist");
      return;
    }

    const fetchData = async () => {
      const token = await getToken();
      try {
        const res = await fetch("/api/patient/discover/", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await res.json();
        if (json.success) setData(json.data);
      } catch (err) {
        console.error("Error fetching discover data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [getToken, user, router]);

  const handleStartConsultation = async (doctorId: string, primaryIssue?: string) => {
    try {
      setStartingConsultationId(doctorId);
      const token = await getToken();
      const res = await fetch("/api/consultation/start/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          doctorId,
          issue: primaryIssue || concerns[0] || "Knee Pain",
        }),
      });

      const json = await res.json();
      if (json.success && json.data?.consultation?._id) {
        router.push(`/consultation/${json.data.consultation._id}`);
      } else {
        router.push(`/therapist-profile/${doctorId}`);
      }
    } catch (err) {
      console.error("Error starting consultation:", err);
      router.push(`/therapist-profile/${doctorId}`);
    } finally {
      setStartingConsultationId(null);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex flex-col h-[70vh] items-center justify-center space-y-4">
          <div className="relative">
            <div className="size-14 rounded-full border-2 border-emerald-500/20 border-t-emerald-600 animate-spin" />
            <Stethoscope className="size-6 text-emerald-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-xs font-semibold text-slate-600">
            Matching clinical specialists with your recovery profile...
          </p>
        </div>
      </AppShell>
    );
  }

  const { concerns = [], therapists = [] } = data || {};

  return (
    <AppShell hideHeader>
      {/* Mobile-first viewport container with safe bottom padding for BottomNav */}
      <div className="w-full max-w-2xl mx-auto flex flex-col space-y-3.5 pb-28 sm:pb-16 pt-1 px-0 sm:px-1">
        
        {/* ── 1. CLEAN APPLE HEALTH HEADER ──────────────────────────── */}
        <div className="flex items-center justify-between gap-2 px-0.5 py-1 w-full">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Link
              href="/"
              className="size-9 shrink-0 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-700 hover:bg-slate-50 active:scale-95 transition-all shadow-2xs"
            >
              <ArrowLeft className="size-4.5" />
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-xl font-bold tracking-tight text-slate-900 leading-tight truncate">
                Doctor Consultation
              </h1>
              <p className="text-[11px] text-slate-500 font-medium truncate">
                Clinical matching based on your health profile
              </p>
            </div>
          </div>

          {/* User Profile Avatar */}
          <Link href="/profile" className="shrink-0 group">
            <div className="size-9 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
              {user?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.imageUrl}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserIcon className="size-4.5 text-slate-600" />
              )}
            </div>
          </Link>
        </div>

        {/* ── 2. ONBOARDING PROFILE MATCHING BANNER (Uncramped Mobile Layout) ── */}
        <div className="bg-gradient-to-br from-emerald-50/90 via-teal-50/40 to-white border border-emerald-200/80 rounded-2xl p-3 sm:p-3.5 shadow-2xs space-y-2 w-full">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <Sparkles className="size-3.5 text-emerald-600 shrink-0" />
              <span className="text-xs font-bold text-emerald-950 truncate">
                Matched from Your Recovery Profile
              </span>
            </div>
            <Link
              href="/setup"
              className="text-[11px] font-semibold text-emerald-800 hover:text-emerald-900 bg-white border border-emerald-200/90 px-2.5 py-0.5 rounded-full shrink-0 shadow-2xs active:scale-95 transition-all whitespace-nowrap"
            >
              Edit issues
            </Link>
          </div>

          <p className="text-[11px] text-slate-600 leading-relaxed">
            Doctors below are prioritized by compatibility with your reported condition:
          </p>

          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {concerns.length > 0 ? (
              concerns.map((concern: string) => (
                <span
                  key={concern}
                  className="bg-white border border-emerald-200/80 text-emerald-900 px-2 py-0.5 text-xs rounded-xl font-medium shadow-2xs flex items-center gap-1"
                >
                  <CheckCircle2 className="size-3 text-emerald-600 shrink-0" />
                  <span className="truncate">{concern}</span>
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-500">General Rehabilitation</span>
            )}
          </div>
        </div>

        {/* ── 3. COMPATIBLE SPECIALISTS SECTION ──────────────────────── */}
        <div className="space-y-3 pt-1 w-full">
          <div className="flex items-center justify-between gap-2 px-0.5 w-full">
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight truncate">
              Compatible Specialists ({therapists.length})
            </h2>
            <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 shrink-0">
              Verified Faculty
            </span>
          </div>

          {therapists.length === 0 ? (
            <div className="text-center py-12 px-4 bg-white rounded-2xl border border-slate-200 w-full">
              <p className="text-slate-600 font-medium">No doctors found matching your concerns.</p>
              <p className="text-xs text-slate-400 mt-1">Please update your recovery focus areas.</p>
            </div>
          ) : (
            <div className="space-y-3 w-full">
              {therapists.map((doc: any) => {
                const isStarting = startingConsultationId === doc.clerkUserId;

                return (
                  <div
                    key={doc.clerkUserId}
                    className={`bg-white rounded-2xl border transition-all duration-200 p-3 sm:p-4.5 relative shadow-[0_2px_12px_rgba(15,23,42,0.04)] w-full overflow-hidden ${
                      doc.isRecommended
                        ? "border-emerald-300 ring-1 ring-emerald-500/20"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {/* Recommendation Badge */}
                    {doc.isRecommended && (
                      <div className="flex items-center gap-1.5 mb-2.5 bg-emerald-50 border border-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-xl text-[10px] sm:text-[11px] font-semibold overflow-hidden">
                        <Sparkles className="size-3 text-emerald-600 shrink-0" />
                        <span className="font-bold shrink-0">Recommended for you</span>
                        <span className="text-emerald-400 font-normal shrink-0">•</span>
                        <span className="truncate font-medium text-emerald-800">
                          {doc.recommendationReason}
                        </span>
                      </div>
                    )}

                    {/* Top Row: Avatar & Main Doctor Info */}
                    <div className="flex items-start gap-2.5 sm:gap-3.5 w-full">
                      {/* Doctor Avatar with Clerk profile image & fallback */}
                      <DoctorAvatar
                        src={doc.avatarUrl}
                        name={doc.professionalName}
                        size="md"
                        isOnline={doc.isOnline}
                        className="size-12 sm:size-14 shrink-0"
                      />

                      {/* Doctor Details */}
                      <div className="flex-1 min-w-0 space-y-0.5 sm:space-y-1">
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <h3 className="text-xs sm:text-base font-bold text-slate-900 leading-snug truncate">
                                {doc.professionalName}
                              </h3>
                              <ShieldCheck className="size-3.5 sm:size-4 text-emerald-600 shrink-0" />
                            </div>
                            <p className="text-[11px] sm:text-xs font-semibold text-emerald-700 truncate">
                              {doc.specialization}
                            </p>
                          </div>

                          {/* Match Score Badge */}
                          <span className="shrink-0 inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            {doc.matchScore}% Match
                          </span>
                        </div>

                        <p className="text-[10px] sm:text-[11px] text-slate-500 truncate">
                          {doc.qualification} • {doc.yearsOfExperience}
                        </p>

                        {/* Rating, Clinic & Fee Bar */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-600 pt-0.5">
                          <div className="flex items-center gap-0.5 font-bold text-slate-900 shrink-0">
                            <Star className="size-3 fill-amber-400 text-amber-400" />
                            <span>{doc.rating}</span>
                            <span className="text-slate-400 font-normal">({doc.reviewCount})</span>
                          </div>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-500 truncate max-w-[85px] sm:max-w-none">
                            {doc.clinicName}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="font-bold text-slate-900 shrink-0">₹{doc.consultationFee}</span>
                        </div>
                      </div>
                    </div>

                    {/* Supported Conditions Pills */}
                    {doc.supportedConditions && doc.supportedConditions.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-2 sm:pt-2.5">
                        {doc.supportedConditions.slice(0, 3).map((cond: string) => {
                          const isMatch = concerns.some(
                            (c: string) =>
                              c.toLowerCase() === cond.toLowerCase() ||
                              cond.toLowerCase().includes(c.toLowerCase())
                          );
                          return (
                            <span
                              key={cond}
                              className={`text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-md font-medium truncate max-w-[140px] ${
                                isMatch
                                  ? "bg-emerald-100/90 text-emerald-950 font-bold border border-emerald-200"
                                  : "bg-slate-50 text-slate-600 border border-slate-200/60"
                              }`}
                            >
                              {cond}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Live Availability Line */}
                    <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-emerald-800 font-semibold pt-2">
                      <span className="size-1.5 sm:size-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span className="truncate">{doc.availability || "Available Today • Instant Video & Chat"}</span>
                    </div>

                    {/* Mobile Action Buttons (Side by Side 2 Columns) */}
                    <div className="grid grid-cols-2 gap-2 pt-2.5 mt-2 border-t border-slate-100 w-full">
                      <Button
                        asChild
                        variant="outline"
                        className="h-9 sm:h-10 text-xs font-semibold rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-all px-1.5"
                      >
                        <Link href={`/therapist-profile/${doc.clerkUserId}`} className="truncate text-center">
                          View Profile
                        </Link>
                      </Button>

                      <Button
                        onClick={() => handleStartConsultation(doc.clerkUserId, concerns[0])}
                        disabled={isStarting}
                        className="h-9 sm:h-10 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center justify-center gap-1 sm:gap-1.5 active:scale-[0.98] transition-all px-1.5"
                      >
                        {isStarting ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <>
                            <Video className="size-3.5 shrink-0" />
                            <span className="truncate">Consult Now</span>
                            <ChevronRight className="size-3 shrink-0 opacity-70 hidden sm:inline-block" />
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
