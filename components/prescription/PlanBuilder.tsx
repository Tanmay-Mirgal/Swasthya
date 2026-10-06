"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button, Field, Input, Notice, SectionHeading, SetsGrid, Select, Switch, Textarea, useToast } from "@/components/ui";
import { ExercisePicker } from "./ExercisePicker";
import type { CatalogExercise } from "@/lib/rehab/exerciseCatalog";
import { getPrescribableExercises } from "@/lib/rehab/exerciseCatalog";
import { addDays, dateKeyInTimezone, formatDateKey, isDateKey } from "@/lib/rehab/dates";
import { endDateFor } from "@/lib/rehab/schedule";
import { cn } from "@/lib/utils";

export interface ExistingPlan {
  id: string;
  version: number;
  frequency: "daily" | "alternate" | "weekdays";
  durationDays: number;
  instructions?: string;
  doctorNotes?: string;
  weeklyReview: { enabled: boolean; cycleDay: number; requireRecording: boolean; recordingExerciseKey?: string };
  exercises: { key: string; exerciseId: string; sets: number; reps: number; holdSeconds?: number; targetRom?: number; tempoSeconds?: number; modifications?: string; instructions?: string }[];
  medicines?: { name: string; dosage?: string; frequency?: string; duration?: string; instructions?: string; startDate?: string; endDate?: string }[];
}

interface DraftExercise {
  uid: string;
  exerciseId: string;
  name: string;
  sets: string;
  reps: string;
  holdSeconds: string;
  targetRom: string;
  tempoSeconds: string;
  modifications: string;
  instructions: string;
}

interface DraftMedicine {
  uid: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

const FREQUENCIES = [
  { id: "daily", label: "Every day" },
  { id: "alternate", label: "Every other day" },
  { id: "weekdays", label: "Weekdays only" },
] as const;

const DURATION_PRESETS = [14, 30, 60, 90];
let counter = 0;
const uid = () => `d${++counter}`;

const fromCatalog = (ex: CatalogExercise): DraftExercise => ({
  uid: uid(), exerciseId: ex.id, name: ex.name, sets: "3", reps: String(ex.defaultReps),
  holdSeconds: "", targetRom: "", tempoSeconds: "", modifications: "", instructions: "",
});

interface Props {
  patientId: string;
  patientName: string;
  consultationId?: string;
  existing?: ExistingPlan | null;
  backHref: string;
}

/**
 * The prescription builder. Everything the patient later sees (today's sheet, sets,
 * reminders, the weekly review) comes from what is saved here, so nothing is pre-filled
 * clinically: an empty plan stays empty until the therapist adds to it.
 */
export function PlanBuilder({ patientId, patientName, consultationId, existing, backHref }: Props) {
  const router = useRouter();
  const { getToken } = useAuth();
  const toast = useToast();
  const catalog = useMemo(() => getPrescribableExercises(), []);
  const firstName = patientName.split(" ")[0] || "the patient";
  const todayKey = useMemo(() => dateKeyInTimezone(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone), []);

  const [exercises, setExercises] = useState<DraftExercise[]>(() =>
    (existing?.exercises ?? []).map((e) => ({
      uid: uid(), exerciseId: e.exerciseId, name: catalog.find((c) => c.id === e.exerciseId)?.name ?? e.exerciseId,
      sets: String(e.sets), reps: String(e.reps), holdSeconds: e.holdSeconds ? String(e.holdSeconds) : "",
      targetRom: e.targetRom ? String(e.targetRom) : "", tempoSeconds: e.tempoSeconds ? String(e.tempoSeconds) : "",
      modifications: e.modifications ?? "", instructions: e.instructions ?? "",
    }))
  );
  const [frequency, setFrequency] = useState<"daily" | "alternate" | "weekdays">(existing?.frequency ?? "daily");
  const [durationDays, setDurationDays] = useState(String(existing?.durationDays ?? 30));
  const [startDate, setStartDate] = useState(todayKey);
  const [reviewOn, setReviewOn] = useState(existing?.weeklyReview.enabled ?? false);
  const [cycleDay, setCycleDay] = useState(String(existing?.weeklyReview.cycleDay ?? 6));
  const [needRecording, setNeedRecording] = useState(existing?.weeklyReview.requireRecording ?? false);
  const [recordingExerciseId, setRecordingExerciseId] = useState(
    () => existing?.exercises.find((e) => e.key === existing.weeklyReview.recordingExerciseKey)?.exerciseId ?? ""
  );
  const [instructions, setInstructions] = useState(existing?.instructions ?? "");
  const [notes, setNotes] = useState(existing?.doctorNotes ?? "");
  const [revisionNote, setRevisionNote] = useState("");
  const [medicines, setMedicines] = useState<DraftMedicine[]>(() =>
    (existing?.medicines ?? []).map((m) => ({ uid: uid(), name: m.name, dosage: m.dosage ?? "", frequency: m.frequency ?? "", duration: m.duration ?? "", instructions: m.instructions ?? "" }))
  );
  const [showMeds, setShowMeds] = useState((existing?.medicines?.length ?? 0) > 0);
  const [adding, setAdding] = useState(exercises.length === 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const days = Math.max(1, Math.min(365, Math.round(Number(durationDays)) || 1));
  const startValid = isDateKey(startDate) && startDate >= addDays(todayKey, -1);
  const endDate = startValid ? endDateFor(startDate, days) : null;
  const reviewDay = Math.max(1, Math.min(7, Number(cycleDay) || 6));
  const reviewTooLate = reviewOn && reviewDay > days;
  const effectiveRecordingId = recordingExerciseId && exercises.some((e) => e.exerciseId === recordingExerciseId) ? recordingExerciseId : exercises[0]?.exerciseId ?? "";

  const patch = (id: string, next: Partial<DraftExercise>) => setExercises((list) => list.map((e) => (e.uid === id ? { ...e, ...next } : e)));
  const move = (i: number, dir: -1 | 1) =>
    setExercises((list) => {
      const j = i + dir;
      if (j < 0 || j >= list.length) return list;
      const copy = [...list];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  const problems: string[] = [];
  if (exercises.length === 0) problems.push("Add at least one exercise.");
  if (!startValid) problems.push("Choose a start date that is today or later.");
  if (reviewTooLate) problems.push(`Day ${reviewDay} of the week is after the plan ends. Lengthen the plan or choose an earlier review day.`);
  for (const e of exercises) {
    const s = Number(e.sets), r = Number(e.reps);
    if (!(s >= 1 && s <= 10) || !(r >= 1 && r <= 50)) problems.push(`${e.name}: sets must be 1 to 10 and reps 1 to 50.`);
  }

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    if (problems.length) {
      setError(problems[0]);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      const num = (v: string) => (v.trim() ? Number(v) : undefined);
      const res = await fetch("/api/prescriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          patientId,
          consultationId,
          startDate,
          durationDays: days,
          frequency,
          exercises: exercises.map((e) => ({
            exerciseId: e.exerciseId, sets: Number(e.sets), reps: Number(e.reps), holdSeconds: num(e.holdSeconds),
            targetRom: num(e.targetRom), tempoSeconds: num(e.tempoSeconds), modifications: e.modifications, instructions: e.instructions,
          })),
          weeklyReview: { enabled: reviewOn, cycleDay: reviewDay, requireRecording: reviewOn && needRecording, recordingExerciseId: effectiveRecordingId },
          instructions,
          doctorNotes: notes,
          medicines: medicines.filter((m) => m.name.trim()).map((m) => ({ name: m.name, dosage: m.dosage, frequency: m.frequency, duration: m.duration, instructions: m.instructions })),
          revisionNote,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "save");
      toast(existing ? "A new version of the plan is saved and active." : "The plan is saved. Your patient has been notified.", "success");
      router.push(backHref);
    } catch (err) {
      setError(err instanceof Error && err.message !== "save" ? err.message : "We couldn’t save the plan. Check your connection and try again.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]" noValidate>
      <div className="min-w-0 space-y-10">
        {existing && (
          <Notice tone="info" title={`This creates version ${existing.version + 1}`}>
            The current plan is kept in the patient’s history and stops when this one starts. Past sessions stay attached to the version they were done under.
          </Notice>
        )}

        <section aria-labelledby="b-exercises">
          <SectionHeading title="1. Exercises" as="h2" />
          <span id="b-exercises" className="sr-only">Exercises</span>
          {exercises.length > 0 && (
            <ol className="mt-1 border-t border-slate-900">
              {exercises.map((e, i) => (
                <li key={e.uid} className="border-b border-slate-300 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-bold text-slate-900"><span className="tabular text-slate-500">{i + 1}.</span> {e.name}</p>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button type="button" size="icon" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${e.name} up`}><ArrowUp className="size-4" /></Button>
                      <Button type="button" size="icon" variant="ghost" onClick={() => move(i, 1)} disabled={i === exercises.length - 1} aria-label={`Move ${e.name} down`}><ArrowDown className="size-4" /></Button>
                      <Button type="button" size="icon" variant="ghost" onClick={() => setExercises((l) => l.filter((x) => x.uid !== e.uid))} aria-label={`Remove ${e.name}`}><Trash2 className="size-4" /></Button>
                    </div>
                  </div>
                  <div className="mt-3 grid max-w-md grid-cols-2 gap-4">
                    <Field label="Sets" htmlFor={`sets-${e.uid}`}><Input id={`sets-${e.uid}`} type="number" min={1} max={10} inputMode="numeric" value={e.sets} onChange={(ev) => patch(e.uid, { sets: ev.target.value })} /></Field>
                    <Field label="Reps per set" htmlFor={`reps-${e.uid}`}><Input id={`reps-${e.uid}`} type="number" min={1} max={50} inputMode="numeric" value={e.reps} onChange={(ev) => patch(e.uid, { reps: ev.target.value })} /></Field>
                  </div>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-semibold text-emerald-700">More for this exercise (optional)</summary>
                    <div className="mt-3 space-y-4">
                      <div className="grid max-w-xl gap-4 sm:grid-cols-3">
                        <Field label="Hold (seconds)" htmlFor={`hold-${e.uid}`}><Input id={`hold-${e.uid}`} type="number" min={0} max={120} inputMode="numeric" value={e.holdSeconds} onChange={(ev) => patch(e.uid, { holdSeconds: ev.target.value })} /></Field>
                        <Field label="Target range (°)" htmlFor={`rom-${e.uid}`}><Input id={`rom-${e.uid}`} type="number" min={1} max={180} inputMode="numeric" value={e.targetRom} onChange={(ev) => patch(e.uid, { targetRom: ev.target.value })} /></Field>
                        <Field label="Seconds per rep" htmlFor={`tempo-${e.uid}`}><Input id={`tempo-${e.uid}`} type="number" min={1} max={20} inputMode="numeric" value={e.tempoSeconds} onChange={(ev) => patch(e.uid, { tempoSeconds: ev.target.value })} /></Field>
                      </div>
                      <Field label="Instructions for the patient" htmlFor={`ins-${e.uid}`}><Textarea id={`ins-${e.uid}`} rows={2} maxLength={1000} value={e.instructions} onChange={(ev) => patch(e.uid, { instructions: ev.target.value })} /></Field>
                      <Field label="Modifications" htmlFor={`mod-${e.uid}`} hint="For example: limit range to 90°, use a chair with arm rests."><Textarea id={`mod-${e.uid}`} rows={2} maxLength={1000} value={e.modifications} onChange={(ev) => patch(e.uid, { modifications: ev.target.value })} /></Field>
                    </div>
                  </details>
                </li>
              ))}
            </ol>
          )}

          {adding ? (
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-slate-900">Add an exercise</h3>
                {exercises.length > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>Done adding</Button>}
              </div>
              <ExercisePicker selectedIds={exercises.map((e) => e.exerciseId)} onAdd={(ex) => setExercises((l) => [...l, fromCatalog(ex)])} />
            </div>
          ) : (
            <Button type="button" variant="outline" className="mt-4" onClick={() => setAdding(true)}><Plus className="size-4" aria-hidden="true" /> Add an exercise</Button>
          )}
        </section>

        <section aria-labelledby="b-schedule">
          <SectionHeading title="2. Schedule" />
          <span id="b-schedule" className="sr-only">Schedule</span>
          <div className="mt-4 max-w-xl space-y-5">
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-slate-900">How often</legend>
              <div role="radiogroup" aria-label="How often" className="flex flex-wrap gap-2">
                {FREQUENCIES.map((f) => (
                  <label key={f.id} className={cn("cursor-pointer rounded-md border px-3 py-2 text-sm font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-emerald-600", frequency === f.id ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-slate-300 text-slate-800 hover:bg-slate-50")}>
                    <input type="radio" name="frequency" value={f.id} checked={frequency === f.id} onChange={() => setFrequency(f.id)} className="sr-only" />
                    {f.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Number of days" htmlFor="b-days">
                <Input id="b-days" type="number" min={1} max={365} inputMode="numeric" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
                <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Common durations">
                  {DURATION_PRESETS.map((d) => <button key={d} type="button" onClick={() => setDurationDays(String(d))} className={cn("rounded border px-2 py-1 text-xs font-semibold", days === d ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-slate-300 text-slate-700 hover:bg-slate-50")}>{d} days</button>)}
                </div>
              </Field>
              <Field label="Start date" htmlFor="b-start" error={startValid ? null : "Choose today or a later date."}>
                <Input id="b-start" type="date" min={addDays(todayKey, -1)} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </Field>
            </div>
            <p className="text-sm text-slate-700" aria-live="polite">
              {endDate ? <>Ends <span className="font-semibold text-slate-900">{formatDateKey(endDate, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span> · {days} {days === 1 ? "day" : "days"}</> : "Choose a valid start date to see the end date."}
            </p>
          </div>
        </section>

        <section aria-labelledby="b-review">
          <SectionHeading title="3. Weekly review" description="A day each week when the patient’s progress is summarised for you." />
          <span id="b-review" className="sr-only">Weekly review</span>
          <div className="mt-4 max-w-xl space-y-4">
            <Switch id="b-review-on" checked={reviewOn} onChange={setReviewOn} label="Weekly review" description="Creates a report from the sets the patient completes." />
            {reviewOn && (
              <div className="space-y-4 border-l-2 border-slate-300 pl-4">
                <Field label="Review day" htmlFor="b-review-day" hint="The nth day of each seven-day cycle, counted from the start date." error={reviewTooLate ? "This day falls after the plan ends." : null}>
                  <Select id="b-review-day" value={cycleDay} onChange={(e) => setCycleDay(e.target.value)} className="max-w-[12rem]">
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>Day {n}</option>)}
                  </Select>
                </Field>
                <Switch id="b-rec" checked={needRecording} onChange={setNeedRecording} label="Ask for a short recording" description="The patient records one exercise on review day. Nothing is recorded or uploaded unless they start it." />
                {needRecording && (
                  <Field label="Exercise to record" htmlFor="b-rec-ex">
                    <Select id="b-rec-ex" value={effectiveRecordingId} onChange={(e) => setRecordingExerciseId(e.target.value)} disabled={exercises.length === 0}>
                      {exercises.length === 0 && <option value="">Add an exercise first</option>}
                      {exercises.map((e) => <option key={e.uid} value={e.exerciseId}>{e.name}</option>)}
                    </Select>
                  </Field>
                )}
              </div>
            )}
          </div>
        </section>

        <section aria-labelledby="b-notes">
          <SectionHeading title="4. Instructions and notes" />
          <span id="b-notes" className="sr-only">Instructions and notes</span>
          <div className="mt-4 max-w-xl space-y-4">
            <Field label="Instructions for the patient" htmlFor="b-ins" hint="Shown on their plan."><Textarea id="b-ins" rows={3} maxLength={2000} value={instructions} onChange={(e) => setInstructions(e.target.value)} /></Field>
            <Field label="Your notes" htmlFor="b-notes-text" hint="Shown to the patient with your name."><Textarea id="b-notes-text" rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            {existing && <Field label="Why you are changing the plan" htmlFor="b-rev" hint="Kept in the plan’s history."><Input id="b-rev" maxLength={500} value={revisionNote} onChange={(e) => setRevisionNote(e.target.value)} /></Field>}
          </div>
        </section>

        <section aria-labelledby="b-meds">
          <SectionHeading title="5. Medication" description="Optional. Only what you are prescribing yourself." />
          <span id="b-meds" className="sr-only">Medication</span>
          {!showMeds ? (
            <Button type="button" variant="outline" className="mt-3" onClick={() => { setShowMeds(true); if (medicines.length === 0) setMedicines([{ uid: uid(), name: "", dosage: "", frequency: "", duration: "", instructions: "" }]); }}>
              <Plus className="size-4" aria-hidden="true" /> Add a medication record
            </Button>
          ) : (
            <div className="mt-3 max-w-xl space-y-4">
              <Notice tone="info">This is a record of your own professional instructions. Swasthya never suggests or generates medication, and the patient sees it exactly as you write it.</Notice>
              {medicines.map((m, i) => (
                <fieldset key={m.uid} className="space-y-3 border-t border-slate-300 pt-4">
                  <legend className="sr-only">Medication {i + 1}</legend>
                  <div className="flex items-end gap-3">
                    <Field label="Medicine" htmlFor={`med-${m.uid}`} className="flex-1"><Input id={`med-${m.uid}`} maxLength={200} value={m.name} onChange={(e) => setMedicines((l) => l.map((x) => (x.uid === m.uid ? { ...x, name: e.target.value } : x)))} /></Field>
                    <Button type="button" size="icon" variant="ghost" onClick={() => setMedicines((l) => l.filter((x) => x.uid !== m.uid))} aria-label={`Remove medication ${i + 1}`}><Trash2 className="size-4" /></Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Dosage" htmlFor={`dose-${m.uid}`}><Input id={`dose-${m.uid}`} maxLength={200} value={m.dosage} onChange={(e) => setMedicines((l) => l.map((x) => (x.uid === m.uid ? { ...x, dosage: e.target.value } : x)))} /></Field>
                    <Field label="How often" htmlFor={`mf-${m.uid}`}><Input id={`mf-${m.uid}`} maxLength={200} value={m.frequency} onChange={(e) => setMedicines((l) => l.map((x) => (x.uid === m.uid ? { ...x, frequency: e.target.value } : x)))} /></Field>
                    <Field label="For how long" htmlFor={`md-${m.uid}`}><Input id={`md-${m.uid}`} maxLength={200} value={m.duration} onChange={(e) => setMedicines((l) => l.map((x) => (x.uid === m.uid ? { ...x, duration: e.target.value } : x)))} /></Field>
                  </div>
                  <Field label="Additional instructions" htmlFor={`mi-${m.uid}`}><Input id={`mi-${m.uid}`} maxLength={1000} value={m.instructions} onChange={(e) => setMedicines((l) => l.map((x) => (x.uid === m.uid ? { ...x, instructions: e.target.value } : x)))} /></Field>
                </fieldset>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setMedicines((l) => [...l, { uid: uid(), name: "", dosage: "", frequency: "", duration: "", instructions: "" }])}><Plus className="size-4" aria-hidden="true" /> Add another</Button>
            </div>
          )}
        </section>

        {error && <Notice tone="danger" title={error} />}
        <div className="flex flex-wrap gap-2 border-t border-slate-900 pt-5">
          <Button type="submit" size="lg" disabled={saving}>{saving ? "Saving…" : existing ? "Save as a new version" : "Save plan"}</Button>
          <Button type="button" size="lg" variant="outline" onClick={() => router.push(backHref)} disabled={saving}>Cancel</Button>
        </div>
      </div>

      <aside aria-label="What the patient will see" className="min-w-0 lg:sticky lg:top-6 lg:self-start">
        <SectionHeading title={`What ${firstName} will see`} />
        <div className="mt-3 border border-slate-900 bg-white p-4">
          {exercises.length === 0 ? (
            <p className="text-sm text-slate-600">Their sheet is empty until you add an exercise.</p>
          ) : (
            <ul className="space-y-4">
              {exercises.map((e) => {
                const s = Math.max(1, Math.min(10, Number(e.sets) || 1));
                const r = Math.max(1, Math.min(50, Number(e.reps) || 1));
                return (
                  <li key={e.uid}>
                    <p className="font-bold text-slate-900">{e.name}</p>
                    <p className="text-sm text-slate-700"><span className="tabular font-semibold">{s} sets × {r} reps</span>{e.holdSeconds ? ` · hold ${e.holdSeconds}s` : ""}</p>
                    <div className="mt-2"><SetsGrid sets={s} reps={r} completedReps={0} size={r > 12 ? 12 : 16} /></div>
                    {e.instructions && <p className="hand mt-2">“{e.instructions}”</p>}
                  </li>
                );
              })}
            </ul>
          )}
          <dl className="mt-4 space-y-1 border-t border-slate-300 pt-3 text-sm text-slate-700">
            <div className="flex justify-between gap-3"><dt>Schedule</dt><dd className="text-right font-semibold text-slate-900">{FREQUENCIES.find((f) => f.id === frequency)?.label}, {days} {days === 1 ? "day" : "days"}</dd></div>
            {endDate && <div className="flex justify-between gap-3"><dt>Dates</dt><dd className="text-right font-semibold text-slate-900 tabular">{formatDateKey(startDate)} to {formatDateKey(endDate)}</dd></div>}
            {reviewOn && <div className="flex justify-between gap-3"><dt>Weekly review</dt><dd className="text-right font-semibold text-slate-900">Day {reviewDay}{needRecording ? " + recording" : ""}</dd></div>}
          </dl>
          {notes && <p className="hand mt-3">“{notes}”</p>}
        </div>
      </aside>
    </form>
  );
}
