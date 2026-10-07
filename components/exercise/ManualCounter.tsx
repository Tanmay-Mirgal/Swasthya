"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui";

interface Props {
  name: string;
  setLabel: string;
  /** Reps counted so far in this part of the set. */
  count: number;
  /** Reps still needed in this part of the set. */
  target: number;
  instruction: string;
  paused: boolean;
  onAdd: () => void;
  onUndo: () => void;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
}

/**
 * Doing the exercise without the camera: the patient taps each rep. Nothing here judges movement, so the screen says
 * so plainly and the reps are stored as counted by hand. Same big number, same set flow, same plain buttons.
 */
export default function ManualCounter({ name, setLabel, count, target, instruction, paused, onAdd, onUndo, onPause, onResume, onFinish }: Props) {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 pt-2">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{name}</h1>
        <p className="text-base text-slate-800">{setLabel}</p>
      </div>
      <p className="text-lg leading-relaxed text-slate-900">{instruction}</p>
      <div role="status" aria-live="polite" className="border-y-2 border-slate-900 py-5 text-center">
        <p className="font-mono text-8xl font-bold leading-none text-slate-900 tabular">
          {count}
          <span className="text-4xl font-semibold text-slate-600"> / {target}</span>
        </p>
        <p className="mt-2 text-base text-slate-800">{paused ? "Paused. Your reps are saved." : count >= target ? "Set complete." : `${target - count} to go`}</p>
      </div>
      {paused ? (
        <div className="grid gap-2">
          <Button size="lg" onClick={onResume}>Resume</Button>
        </div>
      ) : (
        <div className="grid gap-3">
          <Button size="lg" className="h-16 text-xl" onClick={onAdd} disabled={count >= target}>
            <Plus className="size-6" aria-hidden="true" /> I did one
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button size="lg" variant="outline" onClick={onUndo} disabled={count <= 0}>
              <Minus className="size-5" aria-hidden="true" /> Undo last
            </Button>
            <Button size="lg" variant="outline" onClick={onPause}>Pause and rest</Button>
          </div>
          <Button size="lg" variant="secondary" onClick={onFinish} disabled={count <= 0}>Finish set</Button>
        </div>
      )}
      <p className="text-sm text-slate-700">The camera is off, so form isn’t checked. Your reps are saved as counted by you.</p>
    </div>
  );
}
