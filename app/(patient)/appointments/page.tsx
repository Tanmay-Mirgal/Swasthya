/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { MessageSquare, Search, Video } from "lucide-react";
import { Authorship, Button, EmptyState, Notice, PageHeader, PageLoading, SectionHeading, StatusMark } from "@/components/ui";
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
      const res = await fetch("/api/patient/appointments", { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.success && json.data) setData(json.data);
      else setError(json.error || "We couldn’t load your appointments.");
    } catch {
      setError("We couldn’t reach Swasthya. Check your connection and try again.");
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

  const nextAppointment = upcomingAppointments[0] ?? null;
  const dateOf = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  return (
    <AppShell title="Appointments">
      <div className="mx-auto w-full max-w-3xl">
        <PageHeader
          title="Appointments"
          description="Your consultations, requests waiting for a reply, and your physiotherapist."
          actions={
            <Button asChild variant="outline">
              <Link href="/discover">
                <Search className="size-4" aria-hidden="true" /> Find a physiotherapist
              </Link>
            </Button>
          }
        />

        {isLoading ? (
          <PageLoading label="Loading your appointments" />
        ) : error ? (
          <Notice
            tone="danger"
            title="We couldn’t load your appointments"
            action={<Button size="sm" variant="secondary" onClick={() => { setIsLoading(true); void fetchAppointments(); }}>Try again</Button>}
          >
            {error}
          </Notice>
        ) : (
          <div className="space-y-10">
            {activeConsultation && (
              <Notice
                tone="warning"
                title={`Your consultation with ${activeConsultation.doctor?.professionalName || "your physiotherapist"} is open`}
                action={
                  <Button asChild size="sm" variant="highlight">
                    <Link href={`/consultation/${activeConsultation._id}`}>
                      <Video className="size-4" aria-hidden="true" /> Join
                    </Link>
                  </Button>
                }
              >
                Focus: {activeConsultation.issue}
              </Notice>
            )}

            <section aria-label="Upcoming consultations">
              <SectionHeading title="Upcoming" description={upcomingAppointments.length ? `${upcomingAppointments.length} confirmed` : undefined} />
              {upcomingAppointments.length === 0 ? (
                <EmptyState
                  className="mt-3"
                  title="No consultations scheduled"
                  action={<Button asChild size="sm" variant="outline"><Link href="/discover">Request an appointment</Link></Button>}
                >
                  When a physiotherapist confirms a time, it appears here and the room opens ten minutes before.
                </EmptyState>
              ) : (
                <ul>
                  {upcomingAppointments.map((app) => {
                    const sched = new Date(app.scheduledAt);
                    const time = app.requestedTime || sched.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                    return (
                      <li key={app._id} className="flex flex-col gap-3 border-b border-slate-300 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-lg font-bold text-slate-900">
                            <time dateTime={sched.toISOString()}>{dateOf(app.scheduledAt)} · {time}</time>
                          </p>
                          <p className="text-sm text-slate-700">
                            {app.doctor?.professionalName || "Physiotherapist"} · {app.duration} minutes
                          </p>
                          {app.patientNote && <p className="mt-0.5 max-w-prose truncate text-sm text-slate-600">Reason: {app.patientNote}</p>}
                          <div className="mt-1"><StatusMark kind="done">Confirmed</StatusMark></div>
                        </div>
                        <div className="flex items-center gap-2">
                          {app.canJoin && app.consultationId ? (
                            <Button asChild>
                              <Link href={`/consultation/${app.consultationId}`}>
                                <Video className="size-4" aria-hidden="true" /> Join consultation
                              </Link>
                            </Button>
                          ) : (
                            <span className="text-sm text-slate-600">Opens 10 minutes before</span>
                          )}
                          {app.consultationId && (
                            <Button asChild variant="outline">
                              <Link href={`/consultation/${app.consultationId}`}>Details</Link>
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {pendingRequests.length > 0 && (
              <section aria-label="Requests waiting for a reply">
                <SectionHeading title="Waiting for a reply" description="These requests haven’t been confirmed yet." />
                <ul>
                  {pendingRequests.map((req) => (
                    <li key={req._id} className="border-b border-slate-300 py-4">
                      <p className="font-semibold text-slate-900">{req.doctor?.professionalName || "Physiotherapist"}</p>
                      <p className="text-sm text-slate-700">
                        Requested for {req.requestedDate ? dateOf(req.requestedDate) : "a date to be confirmed"}
                        {req.requestedTime ? ` at ${req.requestedTime}` : ""}
                      </p>
                      {req.patientNote && <p className="mt-0.5 max-w-prose truncate text-sm text-slate-600">Reason: {req.patientNote}</p>}
                      <div className="mt-1"><StatusMark kind="pending">Awaiting their response</StatusMark></div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section aria-label="Your physiotherapist">
              <SectionHeading title="Your physiotherapist" />
              {careTeam ? (
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    <DoctorAvatar src={careTeam.avatarUrl} name={careTeam.professionalName} size="md" className="size-14 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-lg font-bold leading-snug text-slate-900">{careTeam.professionalName}</p>
                      {careTeam.specialization && <p className="text-sm text-slate-700">{careTeam.specialization}</p>}
                      {(careTeam.qualification || careTeam.clinicName) && (
                        <p className="text-sm text-slate-600">{[careTeam.qualification, careTeam.clinicName].filter(Boolean).join(" · ")}</p>
                      )}
                      {nextAppointment && (
                        <p className="mt-1 text-sm text-slate-800">
                          Next consultation: <span className="font-semibold">{dateOf(nextAppointment.scheduledAt)}{nextAppointment.requestedTime ? ` · ${nextAppointment.requestedTime}` : ""}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild variant="secondary">
                      <Link href={`/chat/${careTeam.clerkUserId}`}>
                        <MessageSquare className="size-4" aria-hidden="true" /> Message
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href={`/therapist-profile/${careTeam.clerkUserId}`}>Profile</Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <EmptyState
                  className="mt-3"
                  title="No physiotherapist yet"
                  action={<Button asChild size="sm"><Link href="/discover">Find a physiotherapist</Link></Button>}
                >
                  A physiotherapist can prescribe exercises, see your sessions and hold video consultations with you.
                </EmptyState>
              )}
            </section>

            {latestPrescription && (
              <section aria-label="Current prescription">
                <SectionHeading title="Current prescription" action={<Authorship by="therapist" name={latestPrescription.doctorName} />} />
                {latestPrescription.doctorNotes && <p className="hand mt-3 max-w-prose">“{latestPrescription.doctorNotes}”</p>}
                {latestPrescription.exercises && latestPrescription.exercises.length > 0 && (
                  <ul className="mt-3">
                    {latestPrescription.exercises.map((ex: PrescriptionExercise, idx: number) => (
                      <li key={idx} className="flex items-baseline justify-between gap-3 border-b border-slate-200 py-2">
                        <span className="font-semibold text-slate-900">{ex.name}</span>
                        <span className="font-mono text-sm tabular text-slate-700">{ex.sets} × {ex.reps}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            <section aria-label="Past consultations">
              <SectionHeading title="Past consultations" />
              {pastConsultations.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">Completed consultations will be listed here.</p>
              ) : (
                <ul>
                  {pastConsultations.map((c) => (
                    <li key={c._id} className="flex items-center justify-between gap-3 border-b border-slate-300 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{c.doctor?.professionalName || "Physiotherapist"}</p>
                        <p className="truncate text-sm text-slate-600">
                          {new Date(c.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                          {c.issue ? ` · ${c.issue}` : ""}
                        </p>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/consultation/${c._id}`}>View summary</Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
