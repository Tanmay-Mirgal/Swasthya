"use client";

import { ConfidenceBadge } from "@/components/movement/ConfidenceBadge";
import { Button, TickBox } from "@/components/ui";
import type { MovementUi } from "@/hooks/useMovementSession";
import { JOINT_OK } from "@/lib/movement/types";

interface Props {
  ui: Pick<MovementUi, "tracking" | "confidence" | "advice" | "joints">;
  /** The exercise's own placement hint, e.g. "Sit side-on to the camera". */
  hint: string;
  onReady: () => void;
  onManual: () => void;
}

/** True when the camera can see everything the exercise needs and has nothing to advise. */
export const isCameraReady = (ui: Pick<MovementUi, "tracking" | "confidence" | "advice">): boolean => ui.tracking && ui.confidence !== "LOW" && !ui.advice;

/** "Let's get you ready": one plain instruction at a time, and the way forward only when the camera is happy. */
export default function ReadyCheck({ ui, hint, onReady, onManual }: Props) {
  const ready = isCameraReady(ui);
  const headline = !ui.tracking ? "I can’t see you yet" : ui.advice ? ui.advice.message : ready ? "I can see you well" : "I can’t see everything yet";
  const detail = ready ? "You’re ready when you are." : ui.advice ? "Adjust your position and I’ll check again." : hint;
  return (
    <div className="flex flex-col gap-5 p-4 sm:p-5">
      <div>
        <h2 className="text-xl font-bold leading-snug text-slate-900">Let’s get you ready</h2>
        <p className="mt-1 text-base leading-relaxed text-slate-800">{hint}</p>
      </div>
      <div role="status" aria-live="polite" className="flex flex-col gap-1.5">
        <p className="text-lg font-semibold text-slate-900">{headline}</p>
        <p className="text-base text-slate-800">{detail}</p>
        <ConfidenceBadge level={ui.confidence} tracking={ui.tracking} />
      </div>
      <ul className="flex flex-col gap-2" aria-label="Body parts the camera can see">
        {ui.joints.map((j) => {
          const ok = j.state === JOINT_OK;
          return (
            <li key={j.label} className="flex items-center gap-2.5 text-base font-medium text-slate-900">
              <TickBox state={ok ? "done" : "todo"} size={22} animate={ok} />
              {j.label}
              <span className="sr-only">{ok ? " is visible" : " is not visible yet"}</span>
              <span aria-hidden="true" className="text-sm font-normal text-slate-700">{ok ? "Visible" : "Not visible yet"}</span>
            </li>
          );
        })}
      </ul>
      <div className="grid gap-2">
        <Button size="lg" disabled={!ready} onClick={onReady}>I’m ready</Button>
        {!ready && <p className="text-sm text-slate-700">This turns on when the camera can see everything it needs.</p>}
        <Button size="lg" variant="ghost" onClick={onManual}>Continue without the camera</Button>
      </div>
    </div>
  );
}
