/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "@/components/navigation/AppShell";
import {
  ArrowLeft,
  Loader2,
  Star,
  ShieldCheck,
  Video,
  Clock,
  Building2,
  Languages,
  CheckCircle2,
  Sparkles,
  Award,
  Users,
  MessageSquare,
  Lock,
  Calendar,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@clerk/react";
import DoctorAvatar from "@/components/ui/DoctorAvatar";

export default function TherapistProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const therapistId = resolvedParams.id;
  const router = useRouter();

  const { getToken } = useAuth();
  const [therapist, setTherapist] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [startingConsultation, setStartingConsultation] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchTherapist = async () => {
      const token = await getToken();
      try {
        const res = await fetch(`/api/therapist/public-profile/${therapistId}/`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await res.json();
        if (json.success) setTherapist(json.data);
      } catch (err) {
        console.error("Error fetching therapist:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTherapist();
  }, [therapistId, getToken]);

  const handleStartConsultation = async () => {
    setStartingConsultation(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/consultation/start/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          doctorId: therapistId,
          issue: therapist?.specialization || "Knee Rehabilitation",
        }),
      });

      const json = await res.json();
      if (json.success && json.data?.consultation?._id) {
        router.push(`/consultation/${json.data.consultation._id}`);
      } else {
        alert(json.error || "Unable to start consultation right now.");
      }
    } catch (err) {
      console.error("Error launching consultation:", err);
    } finally {
      setStartingConsultation(false);
    }
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <AppShell hideHeader hideNav>
        <div className="flex flex-col h-[70vh] items-center justify-center space-y-3">
          <Loader2 className="size-8 animate-spin text-emerald-600" />
          <p className="text-xs font-semibold text-slate-500">Loading doctor profile...</p>
        </div>
      </AppShell>
    );
  }

  if (!therapist) {
    return (
      <AppShell hideHeader hideNav>
        <div className="p-8 text-center max-w-md mx-auto space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Doctor Profile Not Found</h2>
          <p className="text-sm text-slate-500">The requested doctor is not currently listed.</p>
          <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">
            <Link href="/discover">Return to Doctor Discovery</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell hideHeader hideNav>
      <div className="w-full max-w-2xl mx-auto flex flex-col space-y-3 pb-28 pt-1 px-0.5 sm:px-1 overflow-x-hidden">
        
        {/* ── 1. Top App Header Bar ───────────────────────────────────── */}
        <div className="sticky top-0 z-30 bg-[#F8FAFC]/95 backdrop-blur-md flex items-center justify-between py-2 px-1 w-full border-b border-slate-200/60">
          <div className="flex items-center gap-2">
            <Link
              href="/discover"
              className="size-9 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-700 hover:bg-slate-50 active:scale-95 transition-all shadow-2xs"
            >
              <ArrowLeft className="size-4.5" />
            </Link>
            <span className="text-sm font-bold text-slate-900 truncate">
              Doctor Details
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/80 flex items-center gap-1">
              <ShieldCheck className="size-3.5 text-emerald-600" />
              <span>Verified</span>
            </span>

            <button
              onClick={handleShare}
              className="size-9 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-600 hover:bg-slate-50 active:scale-95 transition-all shadow-2xs"
              title="Share profile link"
            >
              <Share2 className="size-4" />
            </button>
          </div>
        </div>

        {copied && (
          <div className="bg-slate-900 text-white text-xs py-1.5 px-3 rounded-xl text-center shadow-lg animate-in fade-in duration-200">
            Profile link copied to clipboard!
          </div>
        )}

        {/* ── 2. Doctor Primary Hero Card (Horizontal Mobile First) ───── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)] w-full overflow-hidden">
          <div className="flex items-start gap-3 sm:gap-4 w-full">
            {/* Avatar */}
            <DoctorAvatar
              src={therapist.avatarUrl}
              name={therapist.professionalName}
              size="lg"
              isOnline={therapist.isOnline ?? true}
              className="size-16 sm:size-20 rounded-2xl shrink-0"
            />

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-0.5 sm:space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-base sm:text-xl font-bold tracking-tight text-slate-900 leading-snug truncate">
                  {therapist.professionalName}
                </h1>
                <Award className="size-4 text-emerald-600 shrink-0" />
              </div>

              <p className="text-xs sm:text-sm font-semibold text-emerald-700 truncate">
                {therapist.specialization}
              </p>

              <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                {therapist.qualification}
              </p>

              <div className="flex items-center gap-1 text-[11px] text-slate-500 pt-0.5 truncate">
                <Building2 className="size-3 text-slate-400 shrink-0" />
                <span className="truncate">{therapist.clinicName || "Swasthya Partner Institute"}</span>
              </div>
            </div>
          </div>

          {/* 4 Clinical Stats Matrix (Optimized 4-column compact badges) */}
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mt-4 pt-3 border-t border-slate-100 text-center w-full">
            <div className="bg-slate-50 rounded-xl p-1.5 sm:p-2">
              <div className="flex items-center justify-center gap-0.5 text-slate-900 font-bold text-xs sm:text-sm">
                <Star className="size-3 fill-amber-400 text-amber-400" />
                <span>{therapist.rating || 4.9}</span>
              </div>
              <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium block truncate">
                {therapist.reviewCount || 84} Reviews
              </span>
            </div>

            <div className="bg-slate-50 rounded-xl p-1.5 sm:p-2">
              <div className="text-slate-900 font-bold text-xs sm:text-sm truncate">
                {therapist.yearsOfExperience || "8+ yrs"}
              </div>
              <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium block truncate">
                Experience
              </span>
            </div>

            <div className="bg-slate-50 rounded-xl p-1.5 sm:p-2">
              <div className="text-emerald-700 font-bold text-xs sm:text-sm truncate">
                ₹{therapist.consultationFee || 499}
              </div>
              <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium block truncate">
                Per Call
              </span>
            </div>

            <div className="bg-slate-50 rounded-xl p-1.5 sm:p-2">
              <div className="text-slate-900 font-bold text-xs sm:text-sm flex items-center justify-center gap-0.5">
                <Languages className="size-3 text-slate-400" />
                <span>{therapist.languages?.length || 2}</span>
              </div>
              <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium block truncate">
                Languages
              </span>
            </div>
          </div>
        </div>

        {/* ── 3. Live Telehealth Status ───────────────────────────────── */}
        <div className="bg-emerald-50/90 border border-emerald-200/80 rounded-2xl p-3 flex items-center justify-between shadow-2xs w-full">
          <div className="flex items-center gap-2 min-w-0">
            <span className="size-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-emerald-950 truncate">
                {therapist.availability || "Available Today • Instant Video & Chat"}
              </p>
              <p className="text-[10px] text-emerald-700">
                Average wait time: &lt; 2 minutes
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-emerald-800 bg-white border border-emerald-200/80 px-2 py-0.5 rounded-lg shrink-0">
            Instant Join
          </span>
        </div>

        {/* ── 4. Supported Conditions & Clinical Areas ────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 space-y-2 shadow-[0_2px_12px_rgba(15,23,42,0.04)] w-full">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-emerald-600" />
            <span>Specialties & Conditions Treated</span>
          </h2>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {(therapist.supportedConditions || [
              "Neck Pain",
              "Back Pain",
              "Posture Correction",
              "Knee Pain",
              "Knee Rehabilitation",
              "Sports Injury",
              "Mobility Issues",
            ]).map((cond: string) => (
              <span
                key={cond}
                className="bg-slate-50 border border-slate-200/80 text-slate-800 text-[11px] px-2.5 py-1 rounded-xl font-medium flex items-center gap-1 shadow-2xs"
              >
                <CheckCircle2 className="size-3 text-emerald-600 shrink-0" />
                <span>{cond}</span>
              </span>
            ))}
          </div>
        </div>

        {/* ── 5. About the Doctor & Practice ───────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 space-y-2 shadow-[0_2px_12px_rgba(15,23,42,0.04)] w-full">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            About the Practitioner
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {therapist.bio ||
              `${therapist.professionalName} is a licensed physical therapy specialist focusing on precision musculoskeletal recovery, exercise rehabilitation, and posture correction.`}
          </p>

          <div className="pt-2 flex flex-wrap gap-3 text-[11px] text-slate-500 border-t border-slate-100">
            <div className="flex items-center gap-1">
              <Clock className="size-3 text-slate-400" />
              <span>Session: ~25 mins</span>
            </div>
            <div className="flex items-center gap-1">
              <Languages className="size-3 text-slate-400" />
              <span>Languages: {therapist.languages?.join(", ") || "English, Hindi"}</span>
            </div>
          </div>
        </div>

        {/* ── 6. Clinical Trust & HIPAA Badges ────────────────────────── */}
        <div className="bg-slate-50/80 rounded-2xl border border-slate-200/70 p-3 flex items-center justify-between gap-2 text-[11px] text-slate-500 w-full">
          <div className="flex items-center gap-2">
            <Lock className="size-3.5 text-emerald-600 shrink-0" />
            <span>Encrypted video calls • Doctor-guided therapy only</span>
          </div>
          <span className="text-[10px] font-bold text-slate-600">HIPAA Compliant</span>
        </div>

      </div>

      {/* ── 7. STICKY BOTTOM DOCK (Mobile App Standard) ────────────────── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-[0_-4px_16px_rgba(15,23,42,0.06)]"
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom, 0px), 8px)",
        }}
      >
        <div className="max-w-2xl mx-auto px-3 py-2 flex items-center justify-between gap-3">
          {/* Fee & Duration */}
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-extrabold text-slate-900">
                ₹{therapist.consultationFee || 499}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">/ session</span>
            </div>
            <p className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span>Available Now</span>
            </p>
          </div>

          {/* Action CTA */}
          <div className="flex items-center gap-2 flex-1 justify-end max-w-xs">
            <Button
              asChild
              variant="outline"
              className="h-11 px-3 text-xs font-semibold rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs shrink-0"
            >
              <Link href={`/chat/${therapist.clerkUserId}`}>
                <MessageSquare className="size-4" />
              </Link>
            </Button>

            <Button
              onClick={handleStartConsultation}
              disabled={startingConsultation}
              className="h-11 flex-1 text-xs sm:text-sm font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer"
            >
              {startingConsultation ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <Video className="size-4 shrink-0" />
                  <span>Start Consultation</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
