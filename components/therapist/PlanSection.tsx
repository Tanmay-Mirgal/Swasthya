"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@clerk/react";
import { Pause, Pencil, Play } from "lucide-react";
import { Authorship, Button, Dialog, EmptyState, SectionHeading, StatusMark, useToast } from "@/components/ui";
import { formatDateKey } from "@/lib/rehab/dates";
import { getPrescribableExercise } from "@/lib/rehab/exerciseCatalog";

export interface PlanData {
  id: string;
  version: number;
  status: "active" | "paused" | string;
  startDate: string;
  endDate: string;
  durationDays: number;
  frequency: "daily" | "alternate" | "weekdays";
  instructions?: string;
  doctorNotes?: string;
  weeklyReview: { enabled: boolean; cycleDay: number; requireRecording: boolean };
  exercises: { key: string; exerciseId: string; name: string; sets: number; reps: number; holdSeconds?: number; targetRom?: number; tempoSeconds?: number; modifications?: string; instructions?: string }[];
  medicines?: { name: string; dosage?: string; frequency?: string; duration?: string; instructions?: string }[];
  adherence?: { dayNumber: number; totalDays: number; adherence7d: number | null; missedDays7d: number; completedToday: boolean } | null;
  weeklyReviews?: { id: string; weekNumber: number; dueDate: string; status: string; recordingRequired: boolean; recordingAttached: boolean; adherencePercent: number | null }[];
}

export interface PlanHistoryItem {
  id: string;
  version: number;
  status: string;
  startDate: string;
  endDate: string;
  exerciseCount: number;
  closedReason?: string;
}

const FREQ = { daily: "Every day", alternate: "Every other day", weekdays: "Weekdays only" } as const;
const REASON: Record<string, string> = { superseded: "Replaced by a newer version", duration_elapsed: "Reached its end date", manual: "Ended by you", cancelled: "Cancelled" };

interface Props {
  patientId: string;
  patientName: string;
  plan: PlanData | null;
  history: PlanHistoryItem[];
  onChanged: () => void;
}

export default function PlanSection({ patientId, patientName, plan, history, onChanged }: Props) {
  const { getToken } = useAuth();
  const toast = useToast();
  const [confirm, setConfirm] = useState<"pause" | "end" | null>(null);
  const [busy, setBusy] = useState(false);
  const first = patientName.split(" ")[0] || "the patient";

  async function change(status: "paused" | "active" | "completed") {
    if (!plan) return;
    setBusy(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/prescriptions/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "change");
      toast(status === "paused" ? `${first}’s plan is paused.` : status === "active" ? `${first}’s plan is active again.` : "The plan has ended.", "success");
      setConfirm(null);
      onChanged();
    } catch (e) {
      toast(e instanceof Error && e.message !== "change" ? e.message : "We couldn’t change the plan. Please try again.", "danger");
    } finally {
      setBusy(false);
    }
  }

  const prescribeHref = `/therapist/patient/${patientId}/prescribe`;

  return (
    <section aria-label="Rehabilitation plan">
      <SectionHeading
        title="Rehabilitation plan"
        action={<Authorship by="therapist" />}
        description="What you prescribed. The patient sees today’s exercises, sets and reminders from this."
      />

      {!plan ? (
        <EmptyState className="mt-3" title="No active plan" action={<Button asChild size="sm"><Link href={prescribeHref}>Create rehabilitation plan</Link></Button>}>
          Create a plan to give {first} a daily sheet, reminders and a weekly review.
        </EmptyState>
      ) : (
        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <StatusMark kind={plan.status === "paused" ? "attention" : "done"}>{plan.status === "paused" ? "Paused" : "Active"}</StatusMark>
            <span className="text-sm text-slate-700">Version {plan.version} · <span className="tabular">{formatDateKey(plan.startDate)} to {formatDateKey(plan.endDate)}</span> · {FREQ[plan.frequency]}</span>
          </div>
          {plan.adherence && (
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              <div><dt className="text-sm text-slate-600">Plan day</dt><dd className="font-mono text-xl font-bold tabular">{Math.max(1, plan.adherence.dayNumber)} of {plan.adherence.totalDays}</dd></div>
              <div><dt className="text-sm text-slate-600">Last 7 days</dt><dd className="font-mono text-xl font-bold tabular">{plan.adherence.adherence7d === null ? "None due" : `${plan.adherence.adherence7d}%`}</dd></div>
              <div><dt className="text-sm text-slate-600">Missed days</dt><dd className="font-mono text-xl font-bold tabular">{plan.adherence.missedDays7d}</dd></div>
              <div><dt className="text-sm text-slate-600">Today</dt><dd className="text-base font-semibold text-slate-900">{plan.adherence.completedToday ? "Done" : "Not finished"}</dd></div>
            </dl>
          )}

          <ol className="mt-4 border-t border-slate-900">
            {plan.exercises.map((e, i) => {
              const bits = [e.targetRom && `target range ${e.targetRom}°`, e.holdSeconds ? `hold ${e.holdSeconds}s` : null, e.tempoSeconds ? `${e.tempoSeconds}s per rep` : null].filter(Boolean);
              return (
                <li key={e.key} className="flex gap-3 border-b border-slate-300 py-4">
                  <span className="w-6 shrink-0 text-right font-mono text-lg font-semibold text-slate-500" aria-hidden="true">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-slate-900">{getPrescribableExercise(e.exerciseId)?.name ?? e.name}</p>
                    <p className="text-sm text-slate-700"><span className="font-semibold tabular">{e.sets} sets × {e.reps} reps</span>{bits.length ? ` · ${bits.join(" · ")}` : ""}</p>
                    {e.instructions && <p className="hand mt-1.5 max-w-prose">“{e.instructions}”</p>}
                    {e.modifications && <p className="mt-1 text-sm text-slate-700"><span className="font-semibold">Modification:</span> {e.modifications}</p>}
                  </div>
                </li>
              );
            })}
          </ol>

          {(plan.instructions || plan.doctorNotes) && (
            <div className="mt-4 space-y-2">
              {plan.instructions && <p className="max-w-prose text-sm text-slate-800"><span className="font-semibold">Instructions: </span>{plan.instructions}</p>}
              {plan.doctorNotes && <p className="hand max-w-prose">“{plan.doctorNotes}”</p>}
            </div>
          )}

          {plan.weeklyReview.enabled && (
            <p className="mt-4 text-sm text-slate-800">
              <span className="font-semibold">Weekly review:</span> day {plan.weeklyReview.cycleDay} of each week{plan.weeklyReview.requireRecording ? ", with a recording" : ""}.
            </p>
          )}

          {plan.medicines && plan.medicines.length > 0 && (
            <div className="mt-5">
              <h3 className="text-sm font-bold text-slate-900">Medication you recorded</h3>
              <ul className="mt-1 border-t border-slate-300">
                {plan.medicines.map((m, i) => (
                  <li key={i} className="border-b border-slate-300 py-2 text-sm">
                    <span className="font-semibold text-slate-900">{m.name}</span>
                    <span className="text-slate-700">{[m.dosage, m.frequency, m.duration].filter(Boolean).length ? ` · ${[m.dosage, m.frequency, m.duration].filter(Boolean).join(" · ")}` : ""}</span>
                    {m.instructions && <span className="block text-slate-600">{m.instructions}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild><Link href={prescribeHref}><Pencil className="size-4" aria-hidden="true" /> Revise plan</Link></Button>
            {plan.status === "paused" ? (
              <Button variant="secondary" onClick={() => void change("active")} disabled={busy}><Play className="size-4" aria-hidden="true" /> Resume</Button>
            ) : (
              <Button variant="secondary" onClick={() => setConfirm("pause")} disabled={busy}><Pause className="size-4" aria-hidden="true" /> Pause</Button>
            )}
            <Button variant="outline" onClick={() => setConfirm("end")} disabled={busy}>End plan</Button>
          </div>
        </div>
      )}

      {plan?.weeklyReviews && plan.weeklyReviews.length > 0 && (
        <div className="mt-8">
          <SectionHeading title="Weekly reviews" as="h3" />
          <ul className="mt-2 border-t border-slate-900">
            {plan.weeklyReviews.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 py-2.5 text-sm">
                <span><span className="font-semibold text-slate-900">Week {r.weekNumber}</span> <span className="text-slate-600">· {formatDateKey(r.dueDate)}</span>{r.adherencePercent !== null ? <span className="tabular text-slate-800"> · {r.adherencePercent}%</span> : null}</span>
                <span className="flex items-center gap-3">
                  <StatusMark kind={r.status === "reviewed" ? "done" : r.status === "report_ready" ? "attention" : "pending"}>{r.status === "reviewed" ? "Reviewed" : r.status === "report_ready" ? "Report ready" : r.status === "recording_due" ? "Recording due" : "Upcoming"}</StatusMark>
                  {(r.status === "report_ready" || r.status === "reviewed") && <Button asChild size="sm" variant="outline"><Link href={`/therapist/reviews/${r.id}`}>Open<span className="sr-only"> week {r.weekNumber}</span></Link></Button>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {history.length > 1 && (
        <div className="mt-8">
          <SectionHeading title="Plan history" description="Every version is kept. Sessions stay attached to the version they were done under." as="h3" />
          <ol className="mt-2 border-t border-slate-900">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-slate-300 py-2 text-sm">
                <span className="font-semibold text-slate-900">Version {h.version} <span className="font-normal text-slate-600">· {h.exerciseCount} {h.exerciseCount === 1 ? "exercise" : "exercises"}</span></span>
                <span className="tabular text-slate-700">{formatDateKey(h.startDate)} to {formatDateKey(h.endDate)} · {h.status === "active" ? "Active" : h.status === "paused" ? "Paused" : (h.closedReason && REASON[h.closedReason]) || "Ended"}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <Dialog
        open={confirm === "pause"}
        onClose={() => setConfirm(null)}
        title={`Pause ${first}’s plan?`}
        description="They will see that you paused it and won’t get reminders. You can resume at any time."
        footer={<><Button variant="outline" onClick={() => setConfirm(null)}>Keep it active</Button><Button onClick={() => void change("paused")} disabled={busy}>{busy ? "Pausing…" : "Pause plan"}</Button></>}
      >
        <p className="text-sm text-slate-700">Sets already completed stay on record.</p>
      </Dialog>
      <Dialog
        open={confirm === "end"}
        onClose={() => setConfirm(null)}
        title={`End ${first}’s plan?`}
        description="This stops the plan today. It stays in their history, and you can write a new one afterwards."
        footer={<><Button variant="outline" onClick={() => setConfirm(null)}>Keep it</Button><Button variant="danger" onClick={() => void change("completed")} disabled={busy}>{busy ? "Ending…" : "End plan"}</Button></>}
      >
        <p className="text-sm text-slate-700">Ending a plan can’t be undone.</p>
      </Dialog>
    </section>
  );
}
