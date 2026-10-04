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

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-[70vh] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-emerald-600" />
        </div>
      </AppShell>
    );
  }

  if (!therapist) {
    return (
      <AppShell>
        <div className="p-8 text-center max-w-md mx-auto space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Doctor Profile Not Found</h2>
          <p className="text-sm text-slate-500">The requested doctor is not currently listed.</p>
          <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Link href="/discover">Return to Doctor Discovery</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell hideHeader>
      <div className="max-w-2xl mx-auto flex flex-col space-y-4 pb-32 sm:pb-16 pt-2 px-1">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between px-1 py-1">
          <Link
            href="/discover"
            className="size-9 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-700 hover:bg-slate-50 active:scale-95 transition-all shadow-2xs"
          >
            <ArrowLeft className="size-4.5" />
          </Link>
          <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/80 flex items-center gap-1">
            <ShieldCheck className="size-3.5 text-emerald-600" />
            Verified Practitioner
          </span>
        </div>

        {/* Doctor Hero Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-[0_2px_12px_rgba(15,23,42,0.04)] relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-5">
            {/* Avatar with live Clerk image support */}
            <DoctorAvatar
              src={therapist.avatarUrl}
              name={therapist.professionalName}
              size="lg"
              isOnline={therapist.isOnline}
              className="rounded-3xl"
            />

            {/* Main Info */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
                <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-slate-900 leading-snug">
                  {therapist.professionalName}
                </h1>
                <Award className="size-5 text-emerald-600 shrink-0" />
              </div>

              <p className="text-xs sm:text-sm font-semibold text-emerald-700">
                {therapist.specialization}
              </p>

              <p className="text-xs text-slate-500">
                {therapist.qualification}
              </p>

              <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs text-slate-600 pt-0.5">
                <Building2 className="size-3.5 text-slate-400" />
                <span className="truncate">{therapist.clinicName}</span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-4 gap-2 mt-5 pt-4 border-t border-slate-100 text-center">
            <div className="bg-slate-50/90 rounded-2xl p-2 sm:p-2.5">
              <div className="flex items-center justify-center gap-1 text-slate-900 font-bold text-xs sm:text-sm">
                <Star className="size-3 fill-amber-400 text-amber-400" />
                <span>{therapist.rating}</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">
                {therapist.reviewCount} Reviews
              </span>
            </div>

            <div className="bg-slate-50/90 rounded-2xl p-2 sm:p-2.5">
              <div className="text-slate-900 font-bold text-xs sm:text-sm">
                {therapist.yearsOfExperience}
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Experience</span>
            </div>

            <div className="bg-slate-50/90 rounded-2xl p-2 sm:p-2.5">
              <div className="text-slate-900 font-bold text-xs sm:text-sm text-emerald-700">
                ₹{therapist.consultationFee}
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Per Session</span>
            </div>

            <div className="bg-slate-50/90 rounded-2xl p-2 sm:p-2.5">
              <div className="text-slate-900 font-bold text-xs sm:text-sm flex items-center justify-center gap-1">
                <Languages className="size-3 text-slate-500" />
                <span>{therapist.languages?.length || 2}</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Languages</span>
            </div>
          </div>
        </div>

        {/* Live Availability Banner */}
        <div className="bg-emerald-50/90 border border-emerald-200/80 rounded-2xl p-3.5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2.5">
            <span className="size-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
            <div>
              <p className="text-xs font-bold text-emerald-950">
                {therapist.availability || "Available Today • Instant Video & Chat"}
              </p>
              <p className="text-[11px] text-emerald-800">
                Average connect time: &lt; 2 minutes
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-emerald-800 bg-white border border-emerald-200/80 px-2 py-0.5 rounded-lg shrink-0">
            Active Now
          </span>
        </div>

        {/* Supported Conditions / Specializations */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-2.5 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-emerald-600" />
            <span>Supported Conditions & Focus Areas</span>
          </h2>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {(therapist.supportedConditions || [
              "Knee Pain",
              "Knee Rehabilitation",
              "Sports Injury",
              "Lower-limb rehabilitation",
              "Mobility Issues",
            ]).map((cond: string) => (
              <span
                key={cond}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs px-2.5 py-1 rounded-xl font-medium flex items-center gap-1.5"
              >
                <CheckCircle2 className="size-3 text-emerald-600" />
                <span>{cond}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Professional Clinical Bio */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-2.5 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            About the Doctor
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {therapist.bio}
          </p>

          <div className="pt-2 flex flex-wrap gap-4 text-[11px] text-slate-500 border-t border-slate-100">
            <div className="flex items-center gap-1">
              <Clock className="size-3.5 text-slate-400" />
              <span>Consultation duration: ~25 mins</span>
            </div>
            <div className="flex items-center gap-1">
              <Languages className="size-3.5 text-slate-400" />
              <span>Languages: {therapist.languages?.join(", ") || "English, Hindi"}</span>
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="pt-1">
          <Button
            onClick={handleStartConsultation}
            disabled={startingConsultation}
            className="w-full h-12 sm:h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm sm:text-base shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] transition-transform"
          >
            {startingConsultation ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Connecting to Doctor...</span>
              </>
            ) : (
              <>
                <Video className="size-4.5" />
                <span>Start Video Consultation</span>
                <span className="text-emerald-200 text-xs font-normal">• Instant Call</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
