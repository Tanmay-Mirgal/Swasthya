/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "@/components/navigation/AppShell";
import {
  Stethoscope,
  Video,
  MessageSquare,
  Clock,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Star,
  Loader2,
  AlertCircle,
  FileText,
  User,
  Search,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth, useUser } from "@clerk/react";
import DoctorAvatar from "@/components/ui/DoctorAvatar";

export default function PatientAppointmentsPage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    // If user is a therapist, redirect to therapist appointments
    if (user?.publicMetadata?.role === "therapist") {
      router.replace("/therapist?tab=appointments");
      return;
    }

    fetchAppointments();
  }, [user]);

  const fetchAppointments = async () => {
    try {
      setIsLoading(true);
      const token = await getToken();
      if (!token) return;

      const res = await fetch("/api/patient/appointments", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error || "Failed to load appointments");
      }
    } catch (err: any) {
      setError("An error occurred while loading your appointments.");
    } finally {
      setIsLoading(false);
    }
  };

  const {
    connectedTherapist,
    pendingRequest,
    activeConsultation,
    consultations = [],
    latestPrescription,
  } = data || {};

  return (
    <AppShell hideHeader>
      <div className="w-full max-w-2xl mx-auto flex flex-col space-y-4 pb-28 sm:pb-16 pt-1 px-0.5 sm:px-1 overflow-x-hidden">
        
        {/* ── 1. Top Header ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-2 px-1 pt-1 w-full">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                Clinical Care
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
              My Doctor & Appointments
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Track your connected specialist and clinical consultations
            </p>
          </div>

          <Button
            asChild
            variant="outline"
            className="h-9 text-xs font-semibold rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs shrink-0"
          >
            <Link href="/discover" className="flex items-center gap-1.5">
              <Search className="size-3.5" />
              <span>Find Doctor</span>
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="flex flex-col h-[50vh] items-center justify-center space-y-3">
            <Loader2 className="size-8 animate-spin text-emerald-600" />
            <p className="text-xs font-semibold text-slate-500">Loading your doctor & appointments...</p>
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl bg-white border border-red-200 text-center space-y-3">
            <AlertCircle className="size-8 text-red-500 mx-auto" />
            <p className="text-sm font-semibold text-slate-900">{error}</p>
            <Button onClick={fetchAppointments} variant="outline" className="text-xs h-9">
              Try Again
            </Button>
          </div>
        ) : (
          <>
            {/* ── 2. KONSE DOCTOR SE APPOINTMENT LE RAHE HAIN ──────────── */}
            <div className="space-y-2 w-full">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Your Connected Doctor
                </h2>
                {connectedTherapist && (
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                    Active Specialist
                  </span>
                )}
              </div>

              {connectedTherapist ? (
                <div className="bg-white rounded-2xl border border-emerald-200/80 p-4 sm:p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)] relative overflow-hidden w-full">
                  <div className="flex items-start gap-3.5 w-full">
                    <DoctorAvatar
                      src={connectedTherapist.avatarUrl}
                      name={connectedTherapist.professionalName}
                      size="md"
                      isOnline={connectedTherapist.isOnline ?? true}
                      className="size-14 sm:size-16 shrink-0"
                    />

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug truncate">
                          {connectedTherapist.professionalName}
                        </h3>
                        <ShieldCheck className="size-4 text-emerald-600 shrink-0" />
                        <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded">
                          Verified
                        </span>
                      </div>

                      <p className="text-xs font-semibold text-emerald-700 truncate">
                        {connectedTherapist.specialization || "Orthopedic Physical Therapy"}
                      </p>

                      <p className="text-[11px] text-slate-500 truncate">
                        {connectedTherapist.qualification || "MPT, Certified Specialist"} • {connectedTherapist.yearsOfExperience || "8+ years"} exp
                      </p>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 pt-0.5">
                        <div className="flex items-center gap-1 font-bold text-slate-900">
                          <Star className="size-3 fill-amber-400 text-amber-400" />
                          <span>{connectedTherapist.rating || 4.9}</span>
                        </div>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-500 truncate max-w-[120px] sm:max-w-none">
                          {connectedTherapist.clinicName || "Swasthya Partner Center"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Doctor actions: Chat, Video, Profile */}
                  <div className="grid grid-cols-3 gap-2 pt-3.5 mt-3 border-t border-slate-100 w-full">
                    <Button
                      asChild
                      variant="outline"
                      className="h-9 text-xs font-semibold rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      <Link href={`/chat/${connectedTherapist.clerkUserId}`} className="flex items-center justify-center gap-1.5 truncate">
                        <MessageSquare className="size-3.5 text-slate-500 shrink-0" />
                        <span className="truncate">Message</span>
                      </Link>
                    </Button>

                    <Button
                      asChild
                      variant="outline"
                      className="h-9 text-xs font-semibold rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      <Link href={`/therapist-profile/${connectedTherapist.clerkUserId}`} className="truncate text-center">
                        Profile
                      </Link>
                    </Button>

                    {activeConsultation ? (
                      <Button
                        asChild
                        className="h-9 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                      >
                        <Link href={`/consultation/${activeConsultation._id}`} className="flex items-center justify-center gap-1 truncate">
                          <Video className="size-3.5 shrink-0" />
                          <span className="truncate">Join Call</span>
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        asChild
                        className="h-9 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                      >
                        <Link href={`/therapist-profile/${connectedTherapist.clerkUserId}`} className="flex items-center justify-center gap-1 truncate">
                          <Video className="size-3.5 shrink-0" />
                          <span className="truncate">Book Call</span>
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              ) : pendingRequest ? (
                /* Pending Request state */
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 space-y-2.5 w-full">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                      <Clock className="size-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-amber-900">Appointment Request Under Review</h3>
                      <p className="text-[11px] text-amber-700">
                        Sent to <strong>{pendingRequest.therapist?.professionalName || "Doctor"}</strong>
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    The therapist has been notified and will confirm your consultation shortly.
                  </p>
                </div>
              ) : (
                /* No doctor connected state */
                <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center space-y-3 shadow-2xs w-full">
                  <div className="size-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                    <Stethoscope className="size-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">No Doctor Assigned Yet</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Connect with a certified physiotherapist matched to your condition for live video guidance and personalized recovery plans.
                    </p>
                  </div>
                  <Button asChild className="h-10 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 shadow-xs">
                    <Link href="/discover" className="inline-flex items-center gap-2">
                      <Sparkles className="size-3.5" />
                      <span>Browse Available Doctors</span>
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                </div>
              )}
            </div>

            {/* ── 3. ACTIVE CONSULTATION CALL CARD (If available) ─────── */}
            {activeConsultation && (
              <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-2xl p-4 shadow-md space-y-3 w-full">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-white animate-ping" />
                    <span className="text-xs font-bold uppercase tracking-wide">
                      {activeConsultation.status === "COMPLETED" ? "Prescription Active" : "Consultation Room Ready"}
                    </span>
                  </div>
                  <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full font-semibold">
                    Room #{activeConsultation._id.slice(-6)}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <p className="text-sm font-bold">
                      {activeConsultation.doctor?.professionalName || connectedTherapist?.professionalName || "Consultation with Specialist"}
                    </p>
                    <p className="text-xs text-emerald-100">
                      Focus: {activeConsultation.issue || "Rehabilitation & Pose Correction"}
                    </p>
                  </div>

                  <Button asChild className="bg-white hover:bg-emerald-50 text-emerald-900 font-bold text-xs h-9 px-3.5 rounded-xl shadow-xs shrink-0">
                    <Link href={`/consultation/${activeConsultation._id}`} className="flex items-center gap-1">
                      <Video className="size-3.5" />
                      <span>Enter Room</span>
                      <ChevronRight className="size-3.5 ml-0.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            )}

            {/* ── 4. DOCTOR'S RECOVERY PLAN & PRESCRIPTION ─────────────── */}
            {latestPrescription && (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs space-y-3 w-full">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                      <FileText className="size-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Doctor's Prescription
                      </h3>
                      <p className="text-xs font-bold text-slate-900">
                        By {latestPrescription.doctorName || "Dr. Physiotherapist"}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md">
                    Valid & Active
                  </span>
                </div>

                {latestPrescription.doctorNotes && (
                  <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-700 border border-slate-100 leading-relaxed">
                    <p className="font-semibold text-slate-900 mb-0.5">Doctor's Clinical Advice:</p>
                    "{latestPrescription.doctorNotes}"
                  </div>
                )}

                {latestPrescription.exercises && latestPrescription.exercises.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Prescribed Exercises ({latestPrescription.exercises.length})
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {latestPrescription.exercises.map((ex: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/70 text-xs">
                          <span className="font-semibold text-slate-900">{ex.name}</span>
                          <span className="text-[11px] text-slate-500">{ex.sets} sets × {ex.reps} reps</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── 5. CONSULTATION HISTORY ─────────────────────────────── */}
            <div className="space-y-2.5 w-full pt-1">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Consultation History ({consultations.length})
                </h2>
              </div>

              {consultations.length === 0 ? (
                <div className="p-6 bg-white rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
                  No previous consultation records.
                </div>
              ) : (
                <div className="space-y-2">
                  {consultations.map((c: any) => (
                    <div
                      key={c._id}
                      className="bg-white rounded-xl border border-slate-200/80 p-3 flex items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                          <Stethoscope className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {c.doctor?.professionalName || "Consultation with Specialist"}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {new Date(c.createdAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}{" "}
                            • {c.issue || "General Care"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            c.status === "COMPLETED"
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200/60"
                              : "bg-blue-50 text-blue-800 border border-blue-200/60"
                          }`}
                        >
                          {c.status}
                        </span>
                        <Button asChild variant="outline" className="h-8 text-xs px-2.5 rounded-lg border-slate-200">
                          <Link href={`/consultation/${c._id}`}>View</Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── 6. Second Opinion / Browse Specialists Banner ──────── */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 flex items-center justify-between gap-3 w-full">
              <div>
                <p className="text-xs font-bold text-slate-900">Need a different specialist?</p>
                <p className="text-[11px] text-slate-500">Explore specialists for cervical spine, knees, and sports injuries</p>
              </div>
              <Button asChild variant="outline" className="h-8 text-xs font-semibold rounded-xl border-slate-200 bg-white shadow-2xs shrink-0">
                <Link href="/discover">Browse Doctors</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
