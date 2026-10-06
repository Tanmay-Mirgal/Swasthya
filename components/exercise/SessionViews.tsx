"use client";

import Link from "next/link";
import { Camera } from "lucide-react";
import { Button, Notice, PageHeader, SectionHeading, SetsGrid, StatusMark } from "@/components/ui";
import type { ExerciseProgress } from "@/lib/rehab/schedule";
import { cn } from "@/lib/utils";

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
}

/** What the patient sees before a set: the dose they were prescribed, where they are, and (on review day) the recording choice. */
export function SessionIntro({ name, progress, doctorName, instructions, modifications, askRecording, recordingOn, reviewRecordingChosen, onChooseRecording, onStart }: IntroProps) {
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
        <p className="mt-2 max-w-prose text-sm text-slate-700">If {progress.targetReps} in a row is too many, you can pause and rest part-way through a set. Your reps are added together, and the target your therapist set stays the same.</p>
        {instructions && <p className="hand mt-3 max-w-prose">“{instructions}”</p>}
        {modifications && <p className="mt-2 text-sm text-slate-700"><span className="font-semibold">For you:</span> {modifications}</p>}
      </div>

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
}

/** The end of an exercise: the sets as they were really done, an optional "how did that feel", and what to do next. */
export function SessionDone({ progress, bestRom, discomfort, onDiscomfort, recording, saveNotice, next }: DoneProps) {
  return (
    <div className="mx-auto max-w-xl space-y-7 pt-2">
      <PageHeader title={progress.status === "complete" ? `${progress.name} is done for today` : progress.name} description={`${progress.completedSets} of ${progress.targetSets} sets completed.`} />
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
        {bestRom > 0 && <p className="mt-3 text-sm text-slate-700">Best range of motion this visit: <span className="font-mono font-semibold tabular">{bestRom}°</span> <span className="text-slate-500">(measured by the camera)</span></p>}
      </section>

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
