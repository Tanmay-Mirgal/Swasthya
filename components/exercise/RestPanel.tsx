"use client";

import type { CSSProperties } from "react";
import { Check } from "lucide-react";
import { Button, Notice, SetsGrid } from "@/components/ui";
import ProgressRing from "./ProgressRing";
import { PartyPopperIcon } from "./Celebration";
import type { SetCelebration } from "@/lib/rehab/milestones";

interface Props {
  /** The set just finished, 1-based. */
  setDone: number;
  totalSets: number;
  nextSetReps: number;
  targetReps: number;
  completedReps: number;
  restSeconds: number;
  saveNotice?: string | null;
  /** What the set just finished earned. Milestones are listed only when the data verified them. */
  celebration?: SetCelebration | null;
  onStartNext: () => void;
  onStop: () => void;
}

/** Between sets: a clear checkpoint, a rest with no pressure, and one large button to carry on when ready. */
export default function RestPanel({ setDone, totalSets, nextSetReps, targetReps, completedReps, restSeconds, saveNotice, celebration, onStartNext, onStop }: Props) {
  const milestones = (celebration?.milestones ?? []).slice(0, 2);
  return (
    <div className="flex flex-col gap-5 p-4 sm:p-5">
      <div>
        <div className="flex items-center gap-3">
          <ProgressRing value={1} size={56} stroke={6} drawIn>
            <Check className="size-7 text-emerald-700" aria-hidden="true" />
          </ProgressRing>
          <p className="text-xl font-bold text-slate-900">Set {setDone} complete</p>
          {celebration && <PartyPopperIcon popping className="ml-auto size-12 shrink-0" />}
        </div>
        {milestones.length > 0 && (
          <ul role="status" aria-label="Milestones reached" className="mt-3 space-y-2">
            {milestones.map((m, i) => (
              <li key={m.id} style={{ "--mi-delay": `${200 + i * 140}ms` } as CSSProperties} className="milestone-in flex items-start gap-3 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2.5">
                <Check className="mt-0.5 size-6 shrink-0 text-emerald-700" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-lg font-bold leading-snug text-slate-900">{m.title}</p>
                  <p className="text-base text-slate-800">{m.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-base text-slate-800">Take a short rest. There’s no rush.</p>
        <p className="mt-3 font-mono text-4xl font-bold tabular text-slate-900" role="timer" aria-label={`Rested ${restSeconds} seconds`}>
          {Math.floor(restSeconds / 60)}:{String(restSeconds % 60).padStart(2, "0")}
        </p>
        <p className="text-sm text-slate-700">Time resting so far. Nothing is counting down.</p>
      </div>
      {saveNotice && <Notice tone="warning" title="Not saved yet">{saveNotice}</Notice>}
      <SetsGrid sets={totalSets} reps={targetReps} completedReps={completedReps} size={targetReps > 12 ? 14 : 18} />
      <div>
        <p className="text-lg font-bold text-slate-900">Ready for set {setDone + 1}?</p>
        <p className="mb-3 text-base text-slate-800">{nextSetReps} {nextSetReps === 1 ? "rep" : "reps"} this set.</p>
        <div className="grid gap-2">
          <Button size="lg" onClick={onStartNext}>Start set {setDone + 1}</Button>
          <Button size="lg" variant="outline" onClick={onStop}>Stop for now</Button>
        </div>
      </div>
    </div>
  );
}
