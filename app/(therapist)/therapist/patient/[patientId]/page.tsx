/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/react";
import { MessageSquare, Pencil } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Authorship, Button, EmptyState, Notice, PageLoading, SectionHeading, Select, StatusMark, TickRow } from "@/components/ui";
import PatientAvatar from "@/components/therapist/PatientAvatar";
import PlanSection, { type PlanData, type PlanHistoryItem } from "@/components/therapist/PlanSection";
import QualityTrend from "@/components/progress/QualityTrend";
import { buildTrends } from "@/lib/movement/analytics/trends";
import { SessionReportDisclosure } from "@/components/reports/SessionReportCard";
import SessionReviewDialog, { ASSESSMENT_LABEL, type Assessment } from "@/components/therapist/SessionReviewDialog";
import RomChart from "@/components/progress/RomChart";
import AdherenceGrid from "@/components/progress/AdherenceGrid";
import { dayKey } from "@/components/progress/dates";
import { getPatientStatus, relativeDay, type TherapistPatientItem } from "@/components/therapist/types";

interface PlanItem {
  _id: string;
  exerciseId: string;
  targetSets: number;
  targetReps: number;
  type: string;
  targetRom?: number;
  holdSeconds?: number;
  tempoSeconds?: number;
  frequency?: string;
  instructions?: string;
  modifications?: string;
}

interface PatientSession {
  id: string;
  exerciseId: string;
  exerciseName: string;
  date: string;
  completedReps: number;
  targetReps: number;
  rom: number;
  durationSeconds: number;
  therapistNote?: string;
  therapistAssessment?: Assessment;
  reviewedAt?: string;
  romUnit?: "deg" | "pct";
  avgRepSeconds?: number;
  quality?: {
    validReps: number;
    invalidReps: number;
    partialReps: number;
    correctionAttempts?: number;
    correctionsSucceeded?: number;
    avgConfidence?: number;
    errors: { code: string; label: string; reps: number; severity: "minor" | "moderate" | "major" }[];
    observations: { code: string; label: string; repsAffected: number; ofReps: number }[];
  } | null;
}

interface PatientDetailData {
  user?: { firstName?: string; lastName?: string; email?: string; imageUrl?: string };
  profile?: { concerns?: string[] };
  exerciseAssignments: PlanItem[];
  plan: PlanData | null;
  planHistory: PlanHistoryItem[];
  sessions: PatientSession[];
  unreadMessages: number;
}

export default function PatientDetailPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = use(params);
  const { getToken } = useAuth();

  const [data, setData] = useState<PatientDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<PatientSession | null>(null);
  const [romExercise, setRomExercise] = useState("");
  const [now] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`/api/therapist/patient/${patientId}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const json = await res.json();
      if (json.success) {
        setData(json.data as PatientDetailData);
        setError(null);
      } else {
        setError(json.error || "We couldn’t load this patient.");
      }
    } catch {
      setError("We couldn’t reach Swasthya. Check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }, [getToken, patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveReview = async (assessment: Assessment | undefined, note: string): Promise<string | null> => {
    if (!reviewing) return null;
    try {
      const token = await getToken();
      const res = await fetch(`/api/therapist/patient/${patientId}/sessions/${reviewing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ assessment, note }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) return json.error || "We couldn’t save your assessment. Try again.";
      await load();
      return null;
    } catch {
      return "We couldn’t reach Swasthya. Check your connection and try again.";
    }
  };

  const sessions = useMemo(() => data?.sessions ?? [], [data]);
  const exercisesDone = useMemo(() => {
    const m = new Map<string, string>();
    sessions.forEach((s) => m.set(s.exerciseId, s.exerciseName));
    return [...m.entries()];
  }, [sessions]);
  const activeRomExercise = exercisesDone.some(([id]) => id === romExercise) ? romExercise : exercisesDone[0]?.[0] ?? "";
  const romPoints = useMemo(
    () => sessions.filter((s) => s.exerciseId === activeRomExercise && s.rom > 0).map((s) => ({ date: new Date(s.date), rom: Math.round(s.rom) })).sort((a, b) => a.date.getTime() - b.date.getTime()),
    [sessions, activeRomExercise]
  );
  const doneKeys = useMemo(() => new Set(sessions.map((s) => dayKey(new Date(s.date)))), [sessions]);
  const trend = useMemo(
    () =>
      buildTrends(
        sessions.filter((s) => s.exerciseId === activeRomExercise).map((s) => ({
          id: s.id,
          date: s.date,
          exerciseId: s.exerciseId,
          exerciseName: s.exerciseName,
          completedReps: s.completedReps,
          targetReps: s.targetReps,
          rom: s.rom,
          unit: s.romUnit,
          judged: Boolean(s.quality),
          validReps: s.quality?.validReps,
          invalidReps: s.quality?.invalidReps,
          partialReps: s.quality?.partialReps,
          correctionAttempts: s.quality?.correctionAttempts,
          correctionsSucceeded: s.quality?.correctionsSucceeded,
          avgConfidence: s.quality?.avgConfidence,
          avgRepSeconds: s.avgRepSeconds,
          errors: s.quality?.errors.map((e) => ({ code: e.code, label: e.label, reps: e.reps })),
        }))
      ).find((t) => t.exerciseId === activeRomExercise),
    [sessions, activeRomExercise]
  );

  if (isLoading) {
    return (
      <AppShell title="Patient" showBackNav backHref="/therapist?tab=patients">
        <PageLoading label="Loading patient" />
      </AppShell>
    );
  }
  if (error || !data) {
    return (
      <AppShell title="Patient" showBackNav backHref="/therapist?tab=patients">
        <Notice tone="danger" title="We couldn’t load this patient" action={<Button size="sm" variant="secondary" onClick={() => { setIsLoading(true); void load(); }}>Try again</Button>}>
          {error || "Patient not found."}
        </Notice>
      </AppShell>
    );
  }

  const name = `${data.user?.firstName || ""} ${data.user?.lastName || ""}`.trim() || "Patient";
  const concerns = data.profile?.concerns ?? [];
  const week = sessions.filter((s) => now - new Date(s.date).getTime() < 7 * 86_400_000);
  const asItem: TherapistPatientItem = {
    exerciseAssignments: data.exerciseAssignments,
    activity: {
      lastSessionAt: sessions[0]?.date ?? null,
      totalSessions: sessions.length,
      sessionsLast7Days: week.length,
      activeDaysLast7: new Set(week.map((s) => dayKey(new Date(s.date)))).size,
      unreadMessages: data.unreadMessages,
    },
  };
  const status = getPatientStatus(asItem);
  const reviewedBadge = (a?: Assessment) => (a === "on_track" ? "done" : a === "concern" ? "attention" : "partial");

  return (
    <AppShell title={name} showBackNav backHref="/therapist?tab=patients" maxWidth="wide">
      <header className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <PatientAvatar name={name} src={data.user?.imageUrl} className="size-14" />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{name}</h1>
            {data.user?.email && <p className="text-sm text-slate-600">{data.user.email}</p>}
            {concerns.length > 0 && <p className="mt-1 text-sm text-slate-800">Reported concerns: <span className="font-medium">{concerns.join(", ")}</span></p>}
            <p className="mt-2 text-sm">
              <StatusMark kind={status.kind === "active" ? "done" : status.needsAttention ? "attention" : "pending"}>{status.label}</StatusMark>
              <span className="text-slate-700"> · {status.reason}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant={data.unreadMessages ? "highlight" : "secondary"}>
            <Link href={`/chat/${patientId}`}><MessageSquare className="size-4" aria-hidden="true" /> Message{data.unreadMessages ? ` (${data.unreadMessages})` : ""}</Link>
          </Button>
          <Button asChild><Link href={`/therapist/patient/${patientId}/prescribe`}><Pencil className="size-4" aria-hidden="true" /> {data.plan ? "Revise plan" : "Create plan"}</Link></Button>
        </div>
      </header>

      <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="min-w-0 space-y-10">
          <PlanSection patientId={patientId} patientName={name} plan={data.plan} history={data.planHistory ?? []} onChanged={() => void load()} />

          <section aria-label="Sessions">
            <SectionHeading title="Sessions" description="Camera measurements are automated. Add your own assessment beside them." />
            {sessions.length === 0 ? (
              <EmptyState className="mt-3" title="No sessions recorded yet">When this patient finishes an exercise, the session and its measurements appear here for your review.</EmptyState>
            ) : (
              <ul>
                {sessions.slice(0, 20).map((s) => (
                  <li key={s.id} className="border-b border-slate-300 py-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-bold text-slate-900">{s.exerciseName}</p>
                      <time dateTime={s.date} className="text-sm text-slate-600">
                        {new Date(s.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {new Date(s.date).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                      </time>
                    </div>

                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      <div>
                        <Authorship by="automated" />
                        <div className="mt-1.5"><TickRow total={Math.min(s.targetReps, 20)} done={Math.min(s.completedReps, 20)} size={14} label={`${s.completedReps} of ${s.targetReps} reps`} /></div>
                        <p className="mt-1 text-sm text-slate-800">
                          <span className="font-mono font-semibold tabular">{s.completedReps}/{s.targetReps}</span> reps
                          {s.rom > 0 && <> · <span className="font-mono font-semibold tabular">{Math.round(s.rom)}{s.romUnit === "pct" ? "%" : "°"}</span> range</>}
                          {s.durationSeconds > 0 && <> · <span className="font-mono tabular">{Math.floor(s.durationSeconds / 60)}:{String(s.durationSeconds % 60).padStart(2, "0")}</span></>}
                        </p>
                        {s.quality && (
                          <p className="mt-1 text-sm text-slate-800">
                            <span className="font-mono font-semibold tabular">{s.quality.validReps}</span> met the form checks
                            {s.quality.invalidReps > 0 && <>, <span className="font-mono font-semibold tabular">{s.quality.invalidReps}</span> counted with a note</>}
                            {s.quality.partialReps > 0 && <>, <span className="font-mono font-semibold tabular">{s.quality.partialReps}</span> partial</>}
                            {s.quality.errors[0] && <> · most often: {s.quality.errors[0].label.toLowerCase()} ({s.quality.errors[0].reps})</>}
                          </p>
                        )}
                        {s.quality?.observations.map((o) => (
                          <p key={o.code} className="mt-1 text-sm font-semibold text-amber-900">
                            <span className="bg-amber-100 px-1">Repeated: {o.label.toLowerCase()} in {o.repsAffected} of {o.ofReps} reps</span>
                          </p>
                        ))}
                        {s.quality && <SessionReportDisclosure sessionId={s.id} audience="therapist" />}
                      </div>
                      <div>
                        <Authorship by="therapist" name="you" />
                        {s.therapistAssessment || s.therapistNote ? (
                          <div className="mt-1.5">
                            {s.therapistAssessment && <StatusMark kind={reviewedBadge(s.therapistAssessment)}>{ASSESSMENT_LABEL[s.therapistAssessment]}</StatusMark>}
                            {s.therapistNote && <p className="hand mt-1">“{s.therapistNote}”</p>}
                            <button type="button" onClick={() => setReviewing(s)} className="mt-1 text-sm font-semibold text-emerald-700 underline underline-offset-4">Edit assessment</button>
                          </div>
                        ) : (
                          <div className="mt-1.5">
                            <p className="text-sm text-slate-600">Not reviewed yet.</p>
                            <Button size="sm" variant="outline" className="mt-1.5" onClick={() => setReviewing(s)}>Add assessment</Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="min-w-0 space-y-10">
          <section aria-label="Adherence">
            <SectionHeading title="Last 28 days" description="Days with at least one tracked session." />
            <div className="mt-4"><AdherenceGrid days={28} doneKeys={doneKeys} /></div>
            <p className="mt-3 text-sm text-slate-700">Last session: <span className="font-semibold">{relativeDay(sessions[0]?.date)}</span></p>
          </section>

          <section aria-label="Range of motion">
            <SectionHeading title="Range of motion" description="Measured by the camera, not a clinical measurement." />
            {exercisesDone.length > 1 && (
              <div className="mt-3">
                <Select aria-label="Exercise" value={activeRomExercise} onChange={(e) => setRomExercise(e.target.value)} className="h-9 w-auto">
                  {exercisesDone.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
                </Select>
              </div>
            )}
            <div className="mt-3">
              {romPoints.length === 0 ? <EmptyState title="No readings yet">Range-of-motion readings appear after tracked sessions.</EmptyState> : <RomChart points={romPoints} unit={trend?.unit === "pct" ? "%" : "°"} />}
            </div>
          </section>

          {trend && <QualityTrend trend={trend} />}
        </aside>
      </div>

      {reviewing && (
        <SessionReviewDialog
          key={reviewing.id}
          open
          onClose={() => setReviewing(null)}
          exerciseName={reviewing.exerciseName}
          initialAssessment={reviewing.therapistAssessment}
          initialNote={reviewing.therapistNote}
          onSave={saveReview}
        />
      )}
    </AppShell>
  );
}
