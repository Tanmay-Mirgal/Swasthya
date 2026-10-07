"use client";

import { AlertTriangle, BookOpen, CheckCircle2, Info, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { Authorship, Button, TickBox } from "@/components/ui";
import { ConfidenceBadge } from "@/components/movement/ConfidenceBadge";
import CoachLanguageSwitch from "./CoachLanguageSwitch";
import { JointStatusStrip } from "@/components/movement/JointStatusStrip";
import type { MovementUi } from "@/hooks/useMovementSession";
import { cn } from "@/lib/utils";

export interface LivePanelProps {
  ui: MovementUi;
  paused: boolean;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  onTogglePause: () => void;
  onFinish: () => void;
  onOpenGuide: () => void;
  /** Offered after several attempts in a row that did not count: save what was done and stop for today. */
  onFinishEarly?: () => void;
  /** Prescribed sessions: which set this is, for example "Set 2 of 3". Shown above the rep count. */
  contextLabel?: string;
  /** Prescribed sessions: reps already saved for this set before this chunk. */
  contextDetail?: string;
  /** Reps counted before this chunk in the same set, so the big number is the whole set. */
  repsBefore?: number;
  /** Reps in the whole set (prescribed). Defaults to this chunk's target. */
  setTarget?: number;
  pauseLabel?: string;
  endLabel?: string;
  reachedLabel?: string;
}

const TONE: Record<MovementUi["cueTone"], { box: string; icon: typeof Info }> = {
  default: { box: "border-slate-300 bg-white", icon: Info },
  setup: { box: "border-emerald-300 bg-emerald-50", icon: CheckCircle2 },
  praise: { box: "border-emerald-300 bg-emerald-50", icon: CheckCircle2 },
  correction: { box: "border-amber-400 bg-amber-50", icon: AlertTriangle },
  camera: { box: "border-amber-400 bg-amber-50", icon: AlertTriangle },
  info: { box: "border-slate-300 bg-white", icon: Info },
};

/**
 * Live exercise controls in the order a person needs them while moving:
 * set and reps → what to do now → controls (pause is reachable without scrolling on a phone) →
 * how well the camera sees me → which joints are fine; measurements sit underneath.
 */
export default function LivePanel(p: LivePanelProps) {
  const { ui } = p;
  const before = p.repsBefore ?? 0;
  const shown = before + ui.counted;
  const total = p.setTarget ?? ui.targetReps;
  const reached = ui.done;
  const tone = TONE[ui.cueTone] ?? TONE.default;
  const Icon = tone.icon;
  const status = p.paused ? "Paused" : ui.phase === "setup" ? (ui.tracking ? "Getting into position" : "Waiting for the camera") : ui.phaseLabel;
  const notCounted = ui.notCounted;
  const verdict = !p.paused && ui.verdict && ui.verdict.kind !== "good" && ui.verdict.kind !== "corrected" ? ui.verdict : null;

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      <div aria-live="off">
        {p.contextLabel ? (
          <>
            <p className="text-base font-bold text-slate-900">{p.contextLabel}</p>
            {p.contextDetail && <p className="text-sm text-slate-700">{p.contextDetail}</p>}
          </>
        ) : null}
        <p className="mt-1 text-sm font-semibold text-slate-600">Repetitions</p>
        <p className="font-mono tabular text-slate-900">
          <span className="text-5xl font-bold leading-none sm:text-7xl">{shown}</span>
          <span className="text-2xl font-semibold text-slate-500"> / {total}</span>
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1" role="img" aria-label={`${ui.valid} good reps of ${total}${notCounted > 0 ? `, ${notCounted} attempts not counted` : ""}`}>
          {Array.from({ length: Math.min(total, 40) }, (_, i) => {
            const idx = i - before;
            const state = i < before ? "done" : idx >= 0 && idx < ui.repFlags.length ? (ui.repFlags[idx] ? "done" : "partial") : "todo";
            return <TickBox key={i} state={state} size={total > 12 ? 16 : 20} />;
          })}
        </div>
        {(ui.counted > 0 || notCounted > 0) && (
          <p className="mt-2 text-xs text-slate-700">
            <span className="tabular font-semibold">{ui.valid}</span> good {ui.valid === 1 ? "rep" : "reps"}
            {ui.invalid > 0 && <>, <span className="tabular font-semibold">{ui.invalid}</span> not counted (a movement check)</>}
            {ui.partial > 0 && <>, <span className="tabular font-semibold">{ui.partial}</span> not counted (too short)</>}
          </p>
        )}
      </div>

      {verdict && (
        <div role="status" className="rounded-lg border border-amber-400 bg-amber-50 px-3.5 py-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-slate-800" aria-hidden="true" />
            <p translate={verdict.say ? "no" : undefined} className="flex-1 text-lg font-semibold leading-snug text-slate-900">{verdict.say ?? "That one wasn’t counted."}</p>
          </div>
        </div>
      )}

      <div role="status" aria-live="polite" className={cn("rounded-lg border px-3.5 py-3", p.paused ? "border-slate-300 bg-slate-50" : tone.box)}>
        <div className="flex items-start gap-2.5">
          <Icon className="mt-0.5 size-5 shrink-0 text-slate-800" aria-hidden="true" />
          <p translate={p.paused ? undefined : "no"} className="flex-1 text-lg font-semibold leading-snug text-slate-900">{p.paused ? "Paused. Tap Resume when you’re ready." : ui.cue}</p>
          <button
            type="button"
            onClick={p.onToggleVoice}
            aria-label={p.voiceEnabled ? "Mute voice coach" : "Turn on voice coach"}
            aria-pressed={p.voiceEnabled}
            className="-m-1 rounded-md p-1.5 text-slate-700 hover:bg-slate-100"
          >
            {p.voiceEnabled ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
          </button>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2 pl-[30px]">
          <Authorship by="automated" />
          <CoachLanguageSwitch className="shrink-0" />
        </div>
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

      {ui.suggestDemo && !p.paused && (
        <Button size="lg" variant="outline" onClick={p.onOpenGuide}>
          <BookOpen className="size-4" aria-hidden="true" /> Show me how it goes
        </Button>
      )}
      {ui.offerFinish && !p.paused && p.onFinishEarly && (
        <div className="rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-3">
          <p className="text-sm text-slate-900">It’s fine to stop here. Your good reps are saved and your prescription doesn’t change.</p>
          <Button size="lg" variant="secondary" className="mt-2 w-full" onClick={p.onFinishEarly}>Finish for today</Button>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <ConfidenceBadge level={ui.confidence} tracking={ui.tracking} />
          <p className="text-sm text-slate-800">
            <span className="text-slate-600">Movement: </span>
            <span className="font-semibold">{status}</span>
          </p>
        </div>
        <JointStatusStrip joints={ui.joints} />
      </div>


      <details className="group border-t border-slate-300 pt-3" open>
        <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900 marker:hidden">Measurements</summary>
        <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-slate-600">{ui.unit === "deg" ? "Angle" : "Turn"}</dt>
            <dd className="font-mono text-lg font-semibold tabular">{Number.isFinite(ui.primary) ? `${ui.primary}${ui.unit === "deg" ? "°" : "%"}` : "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-600">Best range</dt>
            <dd className="font-mono text-lg font-semibold tabular">{ui.rom > 0 ? `${ui.rom}${ui.unit === "deg" ? "°" : "%"}` : "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-600">Last rep</dt>
            <dd className="font-mono text-lg font-semibold tabular">{ui.lastRepSeconds > 0 ? `${ui.lastRepSeconds.toFixed(1)}s` : "—"}</dd>
          </div>
        </dl>
        <button type="button" onClick={p.onOpenGuide} className="mt-3 text-sm font-semibold text-emerald-700 underline underline-offset-4">
          Open exercise guide
        </button>
      </details>
    </div>
  );
}
