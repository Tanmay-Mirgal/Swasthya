"use client";

import { AlertTriangle, CheckCircle2, Info, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { Authorship, Button, TickRow } from "@/components/ui";
import type { FeedbackMessage } from "@/lib/exercises/types";
import type { TrackingState } from "@/lib/pose/trackingState";
import { cn } from "@/lib/utils";
import { useVoiceCoach } from "./useVoiceCoach";

export interface LivePanelProps {
  completedReps: number;
  targetReps: number;
  feedback: FeedbackMessage;
  issueCode?: string;
  tracking: TrackingState;
  paused: boolean;
  stepIndex: number;
  totalSteps: number;
  stepTitle: string;
  stepInstruction?: string;
  phase?: string;
  angle: number;
  rom: number;
  tempo: number;
  onTogglePause: () => void;
  onFinish: () => void;
  onOpenGuide: () => void;
  /** Prescribed sessions: which set this is, for example "Set 2 of 3". Shown above the rep count. */
  contextLabel?: string;
  /** Prescribed sessions: reps already saved for this set before this chunk. */
  contextDetail?: string;
  pauseLabel?: string;
  endLabel?: string;
  reachedLabel?: string;
}

const FEEDBACK_ICON = { success: CheckCircle2, warning: AlertTriangle, camera: AlertTriangle, info: Info } as const;

/**
 * Live exercise controls, in the order a person needs them while moving:
 * rep count → what to do now → tracking confidence → controls; detail sits underneath.
 */
export default function LivePanel(p: LivePanelProps) {
  const { voiceEnabled, toggleVoice } = useVoiceCoach(p.paused ? "" : p.feedback.message, p.issueCode);
  const reached = p.completedReps >= p.targetReps;
  const Icon = FEEDBACK_ICON[p.feedback.type] ?? Info;
  const trackingOk = p.tracking.kind === "ready";

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      <div aria-live="off">
        {p.contextLabel ? (
          <>
            <p className="text-base font-bold text-slate-900">{p.contextLabel}</p>
            {p.contextDetail && <p className="text-sm text-slate-700">{p.contextDetail}</p>}
          </>
        ) : null}
        <p className="mt-1 text-sm font-semibold text-slate-600">Repetition</p>
        <p className="font-mono tabular text-slate-900">
          <span className="text-6xl font-bold leading-none sm:text-7xl">{p.completedReps}</span>
          <span className="text-2xl font-semibold text-slate-500"> / {p.targetReps}</span>
        </p>
        <div className="mt-2.5">
          <TickRow total={p.targetReps} done={p.completedReps} size={p.targetReps > 12 ? 16 : 20} label={`${p.completedReps} of ${p.targetReps} reps done`} />
        </div>
      </div>

      <div
        role="status"
        aria-live="polite"
        className={cn(
          "rounded-lg border px-3.5 py-3",
          p.paused
            ? "border-slate-300 bg-slate-50"
            : p.feedback.type === "success"
            ? "border-emerald-300 bg-emerald-50"
            : p.feedback.type === "warning"
            ? "border-amber-400 bg-amber-50"
            : "border-slate-300 bg-white"
        )}
      >
        <div className="flex items-start gap-2.5">
          <Icon className="mt-0.5 size-5 shrink-0 text-slate-800" aria-hidden="true" />
          <p className="flex-1 text-lg font-semibold leading-snug text-slate-900">{p.paused ? "Paused. Tap Resume when you’re ready." : p.feedback.message}</p>
          <button
            type="button"
            onClick={toggleVoice}
            aria-label={voiceEnabled ? "Mute voice coach" : "Turn on voice coach"}
            aria-pressed={voiceEnabled}
            className="-m-1 rounded-md p-1.5 text-slate-700 hover:bg-slate-100"
          >
            {voiceEnabled ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
          </button>
        </div>
        <div className="mt-1.5 pl-[30px]">
          <Authorship by="automated" />
        </div>
      </div>

      <div className="flex items-start gap-2.5 text-sm" role="status" aria-live="polite">
        {trackingOk ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" />
        ) : (
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" />
        )}
        <p className="text-slate-800">
          <span className="font-semibold">{p.tracking.title}.</span> {trackingOk ? "" : p.tracking.detail}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button size="lg" variant={reached ? "primary" : "secondary"} onClick={p.onFinish}>
          {reached ? (p.reachedLabel ?? "Finish and save") : (p.endLabel ?? "End session")}
        </Button>
        <Button size="lg" variant="outline" onClick={p.onTogglePause}>
          {p.paused ? <Play className="size-4 fill-current" aria-hidden="true" /> : <Pause className="size-4" aria-hidden="true" />}
          {p.paused ? "Resume" : (p.pauseLabel ?? "Pause")}
        </Button>
      </div>

      <details className="group border-t border-slate-300 pt-3" open>
        <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900 marker:hidden">
          Step {Math.min(p.stepIndex + 1, Math.max(1, p.totalSteps))} of {Math.max(1, p.totalSteps)}: {p.stepTitle}
        </summary>
        {p.stepInstruction && <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{p.stepInstruction}</p>}
        <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-slate-600">Angle</dt>
            <dd className="font-mono text-lg font-semibold tabular">{Math.round(p.angle)}°</dd>
          </div>
          <div>
            <dt className="text-slate-600">Range</dt>
            <dd className="font-mono text-lg font-semibold tabular">{Math.round(p.rom)}°</dd>
          </div>
          <div>
            <dt className="text-slate-600">Tempo</dt>
            <dd className="font-mono text-lg font-semibold tabular">{p.tempo > 0 ? `${p.tempo.toFixed(1)}s` : "—"}</dd>
          </div>
        </dl>
        <button type="button" onClick={p.onOpenGuide} className="mt-3 text-sm font-semibold text-emerald-700 underline underline-offset-4">
          Open exercise guide
        </button>
      </details>
    </div>
  );
}
