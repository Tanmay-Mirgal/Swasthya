"use client";

import Link from "next/link";
import { Camera, Check } from "lucide-react";
import { Button, Notice, PageHeader, SectionHeading, SetsGrid, StatusMark } from "@/components/ui";
import type { ExerciseProgress } from "@/lib/rehab/schedule";
import { cn } from "@/lib/utils";
import SessionReportCard from "@/components/reports/SessionReportCard";
import ProgressRing from "./ProgressRing";
import { PartyPopperIcon } from "./Celebration";
import { routineLines, sessionHighlight, sessionSummaryLines, type DaySummary, type SessionFacts } from "@/lib/rehab/milestones";

export const DISCOMFORT_LEVELS = [
  { id: "none", label: "No discomfort" },
  { id: "mild", label: "Mild" },
  { id: "moderate", label: "Moderate" },
  { id: "severe", label: "Severe" },
] as const;

interface IntroProps {
  name: string;
  progress: ExerciseProgress;
  doctorName?: string;
  instructions?: string;
  modifications?: string;
  /** The recording question is shown instead of the start button until it is answered. */
  askRecording: boolean;
  recordingOn: boolean;
  reviewRecordingChosen: boolean;
  onChooseRecording: (record: boolean) => void;
  onStart: () => void;
  /** Carry on without the camera: the patient counts their own reps. */
  onManual: () => void;
  /** Plain steps for doing the exercise, shown before the camera starts. */
  steps?: string[];
  /** How last time went, only when earlier judged sessions make it true. */
  lastTime?: string | null;
}

/** What the patient sees before a set: the dose they were prescribed, where they are, and (on review day) the recording choice. */
export function SessionIntro({ name, progress, doctorName, instructions, modifications, askRecording, recordingOn, reviewRecordingChosen, onChooseRecording, onStart, onManual, steps, lastTime }: IntroProps) {
  const set = progress.currentSetIndex !== null ? progress.sets[progress.currentSetIndex] : null;
  const started = progress.completedReps > 0;
  return (
    <div className="mx-auto max-w-xl space-y-6 pt-4">
      <PageHeader title={name} description={`${progress.targetSets} sets × ${progress.targetReps} reps, prescribed by ${doctorName || "your therapist"}.`} />
      <div>
        <SetsGrid sets={progress.targetSets} reps={progress.targetReps} completedReps={progress.completedReps} size={progress.targetReps > 12 ? 14 : 18} />
        {set && (
          <p className="mt-3 text-base text-slate-800">
            {started ? <>Next: <span className="font-semibold">set {set.index + 1}</span>, <span className="tabular">{set.remainingReps}</span> {set.remainingReps === 1 ? "rep" : "reps"} to go.</> : <>Start with <span className="font-semibold">set 1</span>: {set.targetReps} reps.</>}
          </p>
        )}
        <p className="mt-2 max-w-prose text-sm text-slate-700">Only good repetitions count toward your target: the whole movement, done with care. A movement that isn’t counted never changes your target, and you can simply try it again. If {progress.targetReps} in a row is too many, you can pause and rest part-way through a set.</p>
        {lastTime && <p className="mt-3 max-w-prose text-lg font-semibold text-slate-900">{lastTime}</p>}
        {instructions && <p className="hand mt-3 max-w-prose">“{instructions}”</p>}
        {modifications && <p className="mt-2 text-sm text-slate-700"><span className="font-semibold">For you:</span> {modifications}</p>}
      </div>

      {steps && steps.length > 0 && (
        <section aria-label="How to do it">
          <h2 className="text-lg font-bold text-slate-900">Here’s how to do it</h2>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-base leading-relaxed text-slate-800">
            {steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
          <p className="mt-2 text-base font-semibold text-slate-900">Stop if you feel sharp pain.</p>
        </section>
      )}

      {askRecording ? (
        <div className="border-t-2 border-slate-900 pt-4" role="group" aria-labelledby="rec-title">
          <h2 id="rec-title" className="text-lg font-bold text-slate-900">Record this exercise for your therapist?</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>Your therapist asked for a short clip for this week’s review.</li>
            <li>It records your camera for up to 90 seconds, only once you start the set.</li>
            <li>Only you and {doctorName || "your therapist"} can watch it. You can delete it before it is reviewed.</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="lg" onClick={() => onChooseRecording(true)}><Camera className="size-4" aria-hidden="true" /> Record and share</Button>
            <Button size="lg" variant="outline" onClick={() => onChooseRecording(false)}>Continue without recording</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={onStart}>{started ? `Continue set ${set ? set.index + 1 : ""}`.trim() : "Start set 1"}</Button>
          <Button asChild size="lg" variant="ghost"><Link href="/">Not now</Link></Button>
          <Button size="lg" variant="ghost" onClick={onManual}>Continue without the camera</Button>
          {recordingOn && <StatusMark kind="info">Recording on</StatusMark>}
        </div>
      )}
      <p className="text-xs text-slate-600">Uses your camera. Movement is analysed on your device and the video is not uploaded{reviewRecordingChosen && recordingOn ? ", except the clip you chose to share" : ""}.</p>
    </div>
  );
}

interface DoneProps {
  progress: ExerciseProgress;
  bestRom: number;
  discomfort: string | null;
  onDiscomfort: (id: string) => void;
  recording?: { state: "idle" | "recording" | "ready" | "uploading" | "sent" | "failed"; error: string | null; onRetry: () => void } | null;
  saveNotice: string | null;
  next?: { href: string; name: string } | null;
  /** Unit the best range of motion is measured in. */
  romUnit?: "deg" | "pct";
  /** The saved session this summary is about; when present a performance summary is shown. */
  sessionId?: string | null;
  /** Recorded facts about this exercise today. Absent when the last save is still queued (offline). */
  facts?: SessionFacts | null;
  /** Set when this exercise finished today's whole routine. */
  routine?: { summary: DaySummary; weekLine: string | null; nextLine: string | null } | null;
  /** Comparisons with earlier sessions that cleared the evidence bar, best first. Preferred over the single-session highlight. */
  highlights?: string[];
  /** The finish was just celebrated (not a revisit of an exercise done earlier), so the party popper is shown. */
  celebrate?: boolean;
}

const CheckLines = ({ lines }: { lines: string[] }) => (
  <ul className="mt-3 space-y-2">
    {lines.map((l) => (
      <li key={l} className="flex items-center gap-2.5 text-lg text-slate-900">
        <Check className="size-5 shrink-0 text-emerald-700" aria-hidden="true" /> {l}
      </li>
    ))}
  </ul>
);

/** The end of an exercise: the sets as they were really done, an optional "how did that feel", and what to do next. */
export function SessionDone({ progress, bestRom, discomfort, onDiscomfort, recording, saveNotice, next, romUnit = "deg", sessionId, facts, routine, highlights, celebrate }: DoneProps) {
  const complete = progress.status === "complete";
  const highlight = complete ? (highlights?.[0] ?? (facts ? sessionHighlight(facts) : null)) : null;
  const lines = facts ? sessionSummaryLines(facts) : [`${progress.completedSets} ${progress.completedSets === 1 ? "set" : "sets"} completed`, `${progress.completedReps} ${progress.completedReps === 1 ? "rep" : "reps"} counted`];
  return (
    <div className="mx-auto max-w-xl space-y-7 pt-2">
      {complete ? (
        <section aria-label="Exercise complete" className="flex items-start gap-4">
          <ProgressRing value={1} size={88} stroke={8} drawIn className="shrink-0">
            <Check className="size-10 text-emerald-700" aria-hidden="true" />
          </ProgressRing>
          <div className="min-w-0">
            <h1 className="text-3xl font-bold leading-tight text-slate-900">Exercise complete</h1>
            <p className="text-lg text-slate-800">{progress.name}</p>
          </div>
          {celebrate && <PartyPopperIcon popping className="ml-auto size-16 shrink-0" />}
        </section>
      ) : (
        <PageHeader title={progress.name} description={`${progress.completedSets} of ${progress.targetSets} sets completed. Your reps are saved.`} />
      )}

      {complete && <section aria-label="This exercise"><CheckLines lines={lines} /></section>}

      {routine && (
        <section aria-label="Today’s routine complete" className="border-y-2 border-slate-900 py-5">
          <h2 className="text-2xl font-bold text-slate-900">Today’s routine complete</h2>
          <CheckLines lines={routineLines(routine.summary)} />
          {routine.weekLine && <p className="mt-4 text-lg text-slate-900">{routine.weekLine}</p>}
          {routine.nextLine && <p className="mt-1 text-lg text-slate-800">{routine.nextLine}</p>}
        </section>
      )}

      {highlight && (
        <section aria-label="Today’s highlight">
          <h2 className="text-lg font-bold text-slate-900">Today’s highlight</h2>
          <p className="mt-1 text-lg text-slate-900">{highlight}</p>
        </section>
      )}
      <section aria-label="Your sets">
        <SetsGrid sets={progress.targetSets} reps={progress.targetReps} completedReps={progress.completedReps} size={progress.targetReps > 12 ? 14 : 18} />
        <ul className="mt-3 border-t border-slate-900">
          {progress.sets.map((s) => (
            <li key={s.index} className="flex items-center justify-between border-b border-slate-300 py-2 text-sm">
              <span className="font-semibold text-slate-900">Set {s.index + 1}</span>
              <span className="tabular text-slate-800">{s.completedReps} of {s.targetReps} reps</span>
            </li>
          ))}
        </ul>
        {bestRom > 0 && <p className="mt-3 text-sm text-slate-700">Best range of motion this visit: <span className="font-mono font-semibold tabular">{bestRom}{romUnit === "pct" ? "%" : "°"}</span> <span className="text-slate-500">(measured by the camera)</span></p>}
      </section>

      {progress.status === "complete" && sessionId && (
        <section aria-label="Your session summary">
          <SectionHeading title="Your session summary" description="Made from what the camera recorded today." />
          <div className="mt-3">
            <SessionReportCard sessionId={sessionId} audience="patient" />
          </div>
        </section>
      )}

      {progress.status === "complete" && (
        <section aria-label="How did that feel?">
          <SectionHeading title="How did that feel?" description="Optional. Your therapist sees this in your weekly report." />
          <div role="radiogroup" aria-label="Discomfort during this exercise" className="mt-3 flex flex-wrap gap-2">
            {DISCOMFORT_LEVELS.map((d) => (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={discomfort === d.id}
                onClick={() => onDiscomfort(d.id)}
                className={cn("min-h-11 rounded-md border px-3.5 text-sm font-semibold", discomfort === d.id ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-slate-300 text-slate-800 hover:bg-slate-50")}
              >
                {d.label}
              </button>
            ))}
          </div>
          {(discomfort === "moderate" || discomfort === "severe") && (
            <Notice className="mt-3" tone="warning" title="Tell your therapist">If the discomfort is more than you expected, stop and message them before your next session. Swasthya can’t assess pain.</Notice>
          )}
        </section>
      )}

      {recording && (
        <section aria-label="Review recording" aria-live="polite">
          {recording.state === "uploading" && <Notice tone="info" title="Sending your recording…" />}
          {recording.state === "sent" && <Notice tone="success" title="Recording sent to your therapist" />}
          {recording.state === "failed" && <Notice tone="danger" title="Your recording wasn’t sent" action={<Button size="sm" variant="secondary" onClick={recording.onRetry}>Try again</Button>}>{recording.error}</Notice>}
          {recording.state === "idle" && <Notice tone="info" title="No recording was kept">The clip was too short to send. You can record again from Today.</Notice>}
        </section>
      )}

      {saveNotice && <Notice tone="warning" title="Not saved yet">{saveNotice}</Notice>}

      <div className="flex flex-wrap gap-2">
        {next && <Button asChild size="lg"><Link href={next.href}>Next: {next.name}</Link></Button>}
        <Button asChild size="lg" variant={next ? "outline" : "primary"}><Link href="/">Back to today’s plan</Link></Button>
      </div>
    </div>
  );
}
