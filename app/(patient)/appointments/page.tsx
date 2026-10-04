/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import {
  Calendar,
  Clock,
  MessageSquare,
  Search,
  ArrowRight,
  Loader2,
  AlertCircle,
  FileText,
  Video,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth, useUser } from "@clerk/react";
import DoctorAvatar from "@/components/ui/DoctorAvatar";
import { AppointmentDoctor } from "@/types/appointment";
import { PrescriptionData, PrescriptionExercise } from "@/types/consultation";

interface AppointmentItem {
  _id: string;
  appointmentId: string;
  consultationId?: string;
  patientId: string;
  therapistId: string;
  status: string;
  scheduledAt: string;
  requestedTime?: string;
  duration: number;
  patientNote?: string;
  doctor: AppointmentDoctor;
  timeStatus: string;
  canJoin: boolean;
}

interface PendingRequestItem {
  _id: string;
  patientId: string;
  therapistId: string;
  status: string;
  requestedDate?: string;
  requestedTime?: string;
  scheduledAt?: string;
  patientNote?: string;
  doctor: AppointmentDoctor;
}

interface PastConsultationItem {
  _id: string;
  doctorId: string;
  issue: string;
  status: string;
  scheduledAt?: string;
  endedAt?: string;
  createdAt: string;
  doctorNotes?: string;
  doctor: AppointmentDoctor;
}

interface AppointmentsData {
  careTeam: AppointmentDoctor | null;
  upcomingAppointments: AppointmentItem[];
  pendingRequests: PendingRequestItem[];
  pastConsultations: PastConsultationItem[];
  activeConsultation: {
    _id: string;
    appointmentId?: string;
    issue: string;
    scheduledAt?: string;
    doctor?: AppointmentDoctor;
  } | null;
  latestPrescription?: PrescriptionData;
}

export default function PatientAppointmentsPage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AppointmentsData | null>(null);

  const fetchAppointments = useCallback(async () => {
    try {
      setError(null);
      const token = await getToken();
      if (!token) return;

      const res = await fetch("/api/patient/appointments", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();

      if (json.success && json.data) {
        setData(json.data);
      } else {
        setError(json.error || "Failed to load appointments.");
      }
    } catch {
      setError("An error occurred while loading your appointments.");
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (user?.publicMetadata?.role === "therapist") {
      router.replace("/therapist?tab=appointments");
      return;
    }

    void fetchAppointments();
  }, [user, router, fetchAppointments]);

  const {
    careTeam,
    upcomingAppointments = [],
    pendingRequests = [],
    pastConsultations = [],
    activeConsultation,
    latestPrescription,
  } = data || {};

  const nextAppointment = upcomingAppointments.length > 0 ? upcomingAppointments[0] : null;

  return (
    <AppShell hideHeader>
      <div className="max-w-3xl mx-auto w-full space-y-8 pb-16 pt-2 px-3 sm:px-0">
        
        {/* ── 1. EDITORIAL PAGE HEADER ───────────────────────────────── */}
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pt-1">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
              Appointments
            </h1>
            <p className="text-sm text-slate-500 mt-1 max-w-md">
              Manage your clinical consultations, scheduled sessions, and care team communications.
            </p>
          </div>

          <Button
            asChild
            variant="outline"
            className="h-10 text-xs font-medium rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs shrink-0 self-start sm:self-auto"
          >
            <Link href="/discover" className="flex items-center gap-1.5">
              <Search className="size-3.5 text-slate-400" />
              <span>Find Specialist</span>
            </Link>
          </Button>
        </header>

        {isLoading ? (
          <div className="flex flex-col h-[40vh] items-center justify-center space-y-3">
            <Loader2 className="size-7 animate-spin text-slate-400" />
            <p className="text-xs text-slate-400 font-medium">Loading your appointments...</p>
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl bg-white border border-slate-200 text-center space-y-3 shadow-2xs">
            <AlertCircle className="size-7 text-slate-400 mx-auto" />
            <p className="text-sm font-semibold text-slate-900">{error}</p>
            <Button
              onClick={() => {
                setIsLoading(true);
                void fetchAppointments();
              }}
              variant="outline"
              className="text-xs h-9 rounded-xl"
            >
              Retry
            </Button>
          </div>
        ) : (
          <>
            {/* ── 2. LIVE CONSULTATION CALLOUT (ONLY WHEN WINDOW IS OPEN) ── */}
            {activeConsultation && (
              <section aria-label="Live Consultation Room">
                <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
                        Consultation Room Open
                      </span>
                    </div>
                    <h2 className="text-base sm:text-lg font-semibold">
                      Session with {activeConsultation.doctor?.professionalName || "Physiotherapist"}
                    </h2>
                    <p className="text-xs text-slate-300">
                      Focus: {activeConsultation.issue}
                    </p>
                  </div>

                  <Link
                    href={`/consultation/${activeConsultation._id}`}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold shadow-xs transition-colors shrink-0"
                  >
                    <Video className="size-3.5" />
                    <span>Enter Consultation Room</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </section>
            )}

            {/* ── 3. CARE TEAM / PHYSIOTHERAPIST ───────────────────────── */}
            <section aria-labelledby="care-team-heading" className="space-y-3">
              <h2
                id="care-team-heading"
                className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-0.5"
              >
                Your Physiotherapist
              </h2>

              {careTeam ? (
                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.03)]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <DoctorAvatar
                        src={careTeam.avatarUrl}
                        name={careTeam.professionalName}
                        size="md"
                        isOnline={false}
                        className="size-14 sm:size-16 rounded-xl shrink-0"
                      />

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-base font-semibold text-slate-900 leading-snug">
                            {careTeam.professionalName}
                          </h3>
                          <ShieldCheck className="size-4 text-slate-400 shrink-0" />
                        </div>

                        <p className="text-xs text-slate-600 font-medium">
                          {careTeam.specialization || "Orthopedic Physical Therapy"}
                        </p>

                        <p className="text-[11px] text-slate-400">
                          {careTeam.qualification || "MPT, Certified Specialist"} • {careTeam.clinicName || "Swasthya Partner Center"}
                        </p>

                        {nextAppointment && (
                          <p className="text-xs text-slate-700 font-medium pt-1 flex items-center gap-1.5">
                            <Clock className="size-3.5 text-slate-400" />
                            <span>
                              Next consultation:{" "}
                              <strong>
                                {new Date(nextAppointment.scheduledAt).toLocaleDateString(undefined, {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                })}
                                {nextAppointment.requestedTime ? ` · ${nextAppointment.requestedTime}` : ""}
                              </strong>
                            </span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions: Direct Chat & View Profile */}
                    <div className="flex items-center gap-2 self-start sm:self-center shrink-0 pt-2 sm:pt-0">
                      <Button
                        asChild
                        variant="outline"
                        className="h-9 px-3.5 text-xs font-semibold rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
                      >
                        <Link href={`/chat/${careTeam.clerkUserId}`} className="flex items-center gap-1.5">
                          <MessageSquare className="size-3.5 text-slate-500" />
                          <span>Message</span>
                        </Link>
                      </Button>

                      <Button
                        asChild
                        variant="outline"
                        className="h-9 px-3.5 text-xs font-semibold rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
                      >
                        <Link href={`/therapist-profile/${careTeam.clerkUserId}`}>
                          Profile
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-6 text-center space-y-3 shadow-xs">
                  <p className="text-sm font-semibold text-slate-900">No Specialist Assigned Yet</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Connect with a certified physiotherapist matched to your condition for live video guidance and tailored exercise plans.
                  </p>
                  <Button asChild className="h-9 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-4">
                    <Link href="/discover">Browse Specialists</Link>
                  </Button>
                </div>
              )}
            </section>

            {/* ── 4. UPCOMING APPOINTMENTS ──────────────────────────────── */}
            <section aria-labelledby="upcoming-heading" className="space-y-3">
              <div className="flex items-center justify-between px-0.5">
                <h2
                  id="upcoming-heading"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-400"
                >
                  Upcoming Consultations ({upcomingAppointments.length})
                </h2>
              </div>

              {upcomingAppointments.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-6 text-center text-xs text-slate-400 shadow-2xs">
                  No upcoming consultations scheduled.
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.03)] divide-y divide-slate-100 overflow-hidden">
                  {upcomingAppointments.map((app) => {
                    const sched = new Date(app.scheduledAt);
                    const formattedDate = sched.toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    });
                    const formattedTime =
                      app.requestedTime ||
                      sched.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

                    return (
                      <div
                        key={app._id}
                        className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                      >
                        <div className="flex items-start gap-3.5">
                          <div className="size-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                            <Calendar className="size-5" />
                          </div>

                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm sm:text-base font-semibold text-slate-900 leading-snug">
                                {app.doctor?.professionalName || "Physiotherapist"}
                              </h3>
                              <span className="text-[10px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                                Confirmed
                              </span>
                            </div>

                            <p className="text-xs text-slate-600">
                              {formattedDate} · {formattedTime} ({app.duration} mins)
                            </p>

                            {app.patientNote && (
                              <p className="text-[11px] text-slate-400 truncate max-w-md">
                                Focus: {app.patientNote}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* CTA: Only joinable inside valid consultation window */}
                        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                          {app.canJoin && app.consultationId ? (
                            <Button asChild className="h-9 text-xs font-semibold bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl shadow-xs">
                              <Link href={`/consultation/${app.consultationId}`} className="flex items-center gap-1.5">
                                <Video className="size-3.5" />
                                <span>Join Consultation</span>
                              </Link>
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-400 font-medium">
                              Opens 10m before start
                            </span>
                          )}

                          {app.consultationId && (
                            <Button asChild variant="outline" className="h-9 text-xs font-medium border-slate-200 text-slate-700 rounded-xl">
                              <Link href={`/consultation/${app.consultationId}`}>Details</Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── 5. PENDING REQUESTS ──────────────────────────────────── */}
            {pendingRequests.length > 0 && (
              <section aria-labelledby="pending-heading" className="space-y-3">
                <h2
                  id="pending-heading"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-0.5"
                >
                  Pending Requests ({pendingRequests.length})
                </h2>

                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs divide-y divide-slate-100 overflow-hidden">
                  {pendingRequests.map((req) => (
                    <div key={req._id} className="p-4 sm:p-5 flex items-center justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-slate-900">
                            {req.doctor?.professionalName || "Doctor"}
                          </h3>
                          <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-md">
                            Pending Doctor Review
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          Requested for{" "}
                          {req.requestedDate
                            ? new Date(req.requestedDate).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })
                            : "upcoming date"}{" "}
                          at {req.requestedTime || "10:00 AM"}
                        </p>
                        {req.patientNote && (
                          <p className="text-[11px] text-slate-400 truncate max-w-sm">
                            Note: {req.patientNote}
                          </p>
                        )}
                      </div>

                      <span className="text-xs text-slate-400 shrink-0">
                        Awaiting response
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── 6. LATEST PRESCRIPTION (IF ACTIVE) ───────────────────── */}
            {latestPrescription && (
              <section aria-labelledby="rx-heading" className="space-y-3">
                <h2
                  id="rx-heading"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-0.5"
                >
                  Current Prescription
                </h2>

                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="size-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                        <FileText className="size-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-900">
                          Prescription by {latestPrescription.doctorName || "Physiotherapist"}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Active clinical recovery plan
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                      Active
                    </span>
                  </div>

                  {latestPrescription.doctorNotes && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
                      &ldquo;{latestPrescription.doctorNotes}&rdquo;
                    </p>
                  )}

                  {latestPrescription.exercises && latestPrescription.exercises.length > 0 && (
                    <div className="pt-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                        Prescribed Exercises ({latestPrescription.exercises.length})
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {latestPrescription.exercises.map((ex: PrescriptionExercise, idx: number) => (
                          <div key={idx} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/70 text-xs flex justify-between items-center">
                            <span className="font-semibold text-slate-900">{ex.name}</span>
                            <span className="text-[11px] text-slate-500">{ex.sets} sets × {ex.reps} reps</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ── 7. PAST CONSULTATIONS ─────────────────────────────────── */}
            <section aria-labelledby="past-heading" className="space-y-3">
              <h2
                id="past-heading"
                className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-0.5"
              >
                Past Consultations ({pastConsultations.length})
              </h2>

              {pastConsultations.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 text-center text-xs text-slate-400 shadow-2xs">
                  No completed consultation records yet.
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs divide-y divide-slate-100 overflow-hidden">
                  {pastConsultations.map((c) => (
                    <div
                      key={c._id}
                      className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-xs font-semibold text-slate-900 truncate">
                          {c.doctor?.professionalName || "Consultation with Specialist"}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {new Date(c.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}{" "}
                          • Focus: {c.issue || "General Care"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                          Completed
                        </span>
                        <Button asChild variant="outline" className="h-8 text-xs px-2.5 rounded-lg border-slate-200 text-slate-700">
                          <Link href={`/consultation/${c._id}`}>View Summary</Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
