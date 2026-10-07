"use client";

import type { ReactNode, RefObject } from "react";
import { BookOpen } from "lucide-react";
import MovementStage from "@/components/movement/MovementStage";
import type { MovementUi } from "@/hooks/useMovementSession";
import { deriveStageVerdict } from "@/lib/movement/verdict/stageVerdict";
import { cn } from "@/lib/utils";
import StageFrame from "./StageFrame";
import { Card, DoneMark, ProgressCard, SetBar, VerdictCard } from "./StageCards";
import { Glyph } from "./marks";
import { useStageLayout } from "./useStageLayout";

/** Big, solid, readable buttons for the stage. Targets are at least 56 px, with a gap, and never sit on the body. */
export function StageButton({ children, onClick, disabled, kind = "primary", className, ...rest }: { children: ReactNode; onClick?: () => void; disabled?: boolean; kind?: "primary" | "ghost"; className?: string } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "children">) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex min-h-16 w-full items-center justify-center gap-2 rounded-xl px-5 text-xl font-bold transition-colors duration-150 disabled:opacity-50",
        kind === "primary" ? "bg-white text-slate-900 hover:bg-slate-100" : "border-2 border-white/80 bg-transparent text-white hover:bg-white/10",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** A control in the top strip: a large target with an icon and a word, never an icon alone. */
export function StageAction({ children, onClick, label, ...rest }: { children: ReactNode; onClick: () => void; label?: string } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "children">) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex min-h-14 items-center gap-2 rounded-lg border-2 border-white/70 px-4 text-lg font-bold text-white transition-colors duration-150 hover:bg-white/15"
      {...rest}
    >
      {children}
    </button>
  );
}

export type StageMode = "ready" | "countdown" | "active" | "paused" | "rest";

export interface LiveStageProps {
  mode: StageMode;
  ui: MovementUi;
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  error: string | null;
  onRetry: () => void;
  viewScale: number;
  title: string;
  subtitle?: string;
  tag?: string | null;
  backLabel?: string;
  onBack: () => void;
  /** Controls for the top strip (sound, guide, details, pause). */
  actions?: ReactNode;

  /** Good reps in the whole set so far (earlier chunks plus this one), and the set's target. */
  goodInSet: number;
  setTarget: number;
  /** "Set 2 of 3". */
  setLabel?: string;

  /** The last spoken lines, shown as a caption strip when the patient asked for captions. */
  captions?: string[];
  /** Something the patient should know, such as reps being kept on this device until they are saved. */
  notice?: string | null;
  // reading-distance calibration (first time only)
  calibration?: { calibrated: boolean; canGrow: boolean; onYes: () => void; onBigger: () => void };
  // ready
  cameraReady?: boolean;
  placementHint?: string;
  onReady?: () => void;
  // countdown
  count?: number;
  onNotYet?: () => void;
  // paused
  onResume?: () => void;
  onStop?: () => void;
  // rest
  /** Milestones this set earned, already verified from stored data. Shown quietly under "SET n DONE". */
  celebration?: { milestones: { id: string; title: string; detail: string }[] } | null;
  setsDone?: number;
  totalSets?: number;
  nextSetReps?: number;
  restSeconds?: number;
  onStartNext?: () => void;
  // offers after attempts kept not counting
  onOpenGuide?: () => void;
  onFinishEarly?: () => void;
}

/**
 * The patient's live screen, built to be read from 1 to 2 metres: the camera fills the screen, the good-rep count and the
 * verdict sit in solid lanes beside the person, and the border of the whole stage carries the state. One panel for every
 * stage of a session (get ready, countdown, exercising, paused, resting) so none of them is a separate screen to find.
 */
export default function LiveStage(p: LiveStageProps) {
  const { ui } = p;
  const { stageRef, layout, size } = useStageLayout({ bodyBox: ui.bodyBox, viewScale: p.viewScale, videoRef: p.videoRef });

  const ambient = p.mode === "rest" ? "rest" : p.mode === "countdown" ? "countdown" : p.mode === "paused" ? "paused" : p.mode === "ready" ? (p.cameraReady ? "good" : "cant_see") : ui.stage.kind === "tracking" || ui.stage.kind === "ready" ? "tracking" : ui.stage.kind;

  const marks = ui.attempts;
  // Both cards share one lane when the person leaves room on only one side: keep the count readable but smaller, so the verdict and any buttons always fit.
  const mini = layout.mode !== "lanes";
  let progress: ReactNode;
  let verdict: ReactNode;

  if (p.mode === "ready") {
    // Not "paused": nothing is being judged yet, so the message is only about whether the camera can see the person.
    const stage = p.cameraReady ? deriveStageVerdict({ ...stageInput(ui), advice: null, confidence: "HIGH", tracking: true, verdict: null }) : deriveStageVerdict({ ...stageInput(ui), verdict: null });
    progress = p.calibration && !p.calibration.calibrated ? (
      // Once: "can you read this from where you will sit?" The browser cannot know the screen's size, so the patient says.
      <Card tone="neutral" className="bg-slate-950" role="group" aria-label="Check you can read the screen">
        <p className="font-bold" style={{ fontSize: "calc(var(--t-instr) * 0.8)" }} data-distance="instruction">Can you read this from where you will sit?</p>
        <p className="mt-2 font-extrabold uppercase tracking-wide text-emerald-300" style={{ fontSize: "var(--t-verdict)" }} data-distance="verdict">GOOD</p>
        <div className="mt-3 space-y-3">
          <StageButton onClick={p.calibration.onYes}>Yes, I can read it</StageButton>
          {p.calibration.canGrow && <StageButton kind="ghost" onClick={p.calibration.onBigger}>Make it bigger</StageButton>}
        </div>
      </Card>
    ) : (
      <Card tone="neutral" className="bg-slate-950">
        <p className="font-bold uppercase tracking-wide" style={{ fontSize: "calc(var(--t-instr) * 0.8)" }} data-distance="instruction">Where to sit</p>
        <p className="mt-2 text-white/90" style={{ fontSize: "var(--t-detail)" }}>{p.placementHint}</p>
        <p className="mt-2 text-white/70" style={{ fontSize: "calc(var(--t-detail) * 0.85)" }}>A keyboard or remote works too: Space or Enter to start, P to pause.</p>
      </Card>
    );
    verdict = (
      <Card tone={p.cameraReady ? "good" : "unsure"} key={`${p.cameraReady}-${stage.instruction}`} className="verdict-in" role="status" aria-live="polite" aria-atomic="true">
        <Glyph glyph={p.cameraReady ? "check" : "question"} style={{ width: "calc(var(--t-glyph) * 0.55)", height: "calc(var(--t-glyph) * 0.55)" }} />
        <p data-distance="verdict" className="mt-1 font-extrabold uppercase leading-[1.05] tracking-wide" style={{ fontSize: "var(--t-verdict)" }}>{p.cameraReady ? "I CAN SEE YOU" : stage.word}</p>
        <p data-distance="instruction" className="mt-2 font-semibold leading-tight" style={{ fontSize: "calc(var(--t-instr) * 0.75)" }}>{p.cameraReady ? "Press start when ready" : stage.instruction}</p>
        <div className="mt-4 space-y-3">
          <StageButton onClick={p.onReady} disabled={!p.cameraReady}>I’m ready</StageButton>
        </div>
      </Card>
    );
  } else if (p.mode === "countdown") {
    progress = <ProgressCard good={p.goodInSet} target={p.setTarget} marks={marks} detail={p.setLabel} mini={mini} />;
    verdict = (
      <Card tone="neutral" role="timer" aria-live="assertive" aria-label={`Starting in ${p.count}`}>
        <p data-distance="verdict" className="font-extrabold uppercase tracking-wide" style={{ fontSize: "var(--t-verdict)" }}>GET READY</p>
        <p data-distance="counter" className="font-mono font-bold leading-none tabular" style={{ fontSize: "calc(var(--t-counter) * 1.3)" }}>{p.count}</p>
        <p data-distance="instruction" className="mt-2 font-semibold" style={{ fontSize: "var(--t-instr)" }}>Take your starting position</p>
        <StageButton kind="ghost" onClick={p.onNotYet} className="mt-4">Not yet</StageButton>
      </Card>
    );
  } else if (p.mode === "rest") {
    // When both cards share one lane the sets are already shown in the card below: give the buttons the room.
    progress = mini ? null : (
      <Card tone="neutral" className="bg-slate-950">
        <p className="font-mono font-bold leading-none tabular" style={{ fontSize: "var(--t-counter)" }}>
          <span data-distance="counter">{p.setsDone}</span>
          <span className="text-white/60" style={{ fontSize: "0.5em" }}> / {p.totalSets}</span>
        </p>
        <p data-distance="instruction" className="mt-2 font-bold uppercase tracking-wide" style={{ fontSize: "calc(var(--t-instr) * 0.8)" }}>SETS DONE</p>
      </Card>
    );
    verdict = (
      <Card tone="good" key="rest" className="verdict-in" role="status" aria-live="polite" aria-atomic="true">
        <DoneMark style={{ width: "calc(var(--t-glyph) * 0.5)", height: "calc(var(--t-glyph) * 0.5)" }} />
        <p data-distance="verdict" className="mt-1 font-extrabold uppercase leading-[1.05] tracking-wide" style={{ fontSize: "var(--t-verdict)" }}>SET {p.setsDone} DONE</p>
        <p data-distance="instruction" className="mt-1 font-semibold leading-tight" style={{ fontSize: "calc(var(--t-instr) * 0.75)" }}>Take a short rest</p>
        {(p.celebration?.milestones.length ?? 0) > 0 && (
          <ul role="status" aria-label="Milestones reached" className="mt-3 space-y-2">
            {p.celebration!.milestones.slice(0, 2).map((m) => (
              <li key={m.id} className="rounded-lg bg-white/15 px-3 py-2">
                <p className="font-bold leading-snug" style={{ fontSize: "calc(var(--t-instr) * 0.7)" }}>{m.title}</p>
                <p className="text-white/90" style={{ fontSize: "var(--t-detail)" }}>{m.detail}</p>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3"><SetBar done={p.setsDone ?? 0} total={p.totalSets ?? 1} /></div>
        <p className="mt-2 text-white/90" style={{ fontSize: "var(--t-detail)" }} role="timer" aria-label={`Rested ${p.restSeconds ?? 0} seconds`}>
          Resting {Math.floor((p.restSeconds ?? 0) / 60)}:{String((p.restSeconds ?? 0) % 60).padStart(2, "0")}
        </p>
        <div className="mt-4 space-y-3">
          <StageButton onClick={p.onStartNext}>Start set {(p.setsDone ?? 0) + 1}: {p.nextSetReps} reps</StageButton>
          <StageButton kind="ghost" onClick={p.onStop}>Stop for now</StageButton>
        </div>
      </Card>
    );
  } else {
    progress = <ProgressCard good={p.goodInSet} target={p.setTarget} marks={marks} detail={p.setLabel} mini={mini} />;
    verdict = (
      <div className="flex flex-col gap-3">
        <VerdictCard stage={ui.stage} setupProgress={ui.setupProgress} compact={mini || p.mode === "paused"}>
          {p.mode === "paused" && (
            <div className="mt-4 space-y-3">
              <StageButton onClick={p.onResume}>Resume</StageButton>
              <StageButton kind="ghost" onClick={p.onStop}>Stop for now</StageButton>
            </div>
          )}
        </VerdictCard>
        {p.mode === "active" && ui.suggestDemo && (
          <StageButton onClick={p.onOpenGuide}><BookOpen className="size-6" aria-hidden="true" /> Show me how it goes</StageButton>
        )}
        {p.mode === "active" && ui.offerFinish && p.onFinishEarly && (
          <Card tone="neutral">
            <p style={{ fontSize: "var(--t-detail)" }}>It’s fine to stop here. Your good reps are saved and your prescription doesn’t change.</p>
            <StageButton onClick={p.onFinishEarly} className="mt-3">Finish for today</StageButton>
          </Card>
        )}
      </div>
    );
  }

  if (p.notice) {
    verdict = (
      <div className="flex flex-col gap-3">
        {verdict}
        <p role="status" className="rounded-xl bg-amber-100 px-4 py-3 font-semibold text-amber-950" style={{ fontSize: "var(--t-detail)" }}>{p.notice}</p>
      </div>
    );
  }

  return (
    <StageFrame
      stageRef={stageRef}
      layout={layout}
      size={size}
      viewScale={p.viewScale}
      ambient={ambient as never}
      title={p.title}
      subtitle={p.subtitle}
      tag={p.tag}
      backLabel={p.backLabel}
      onBack={p.onBack}
      actions={p.actions}
      camera={<MovementStage videoRef={p.videoRef} canvasRef={p.canvasRef} ui={ui} error={p.error} onRetry={p.onRetry} quiet />}
      progress={progress}
      verdict={verdict}
      contentKey={`${p.mode}:${ui.stage.kind}:${ui.stage.word}:${mini}:${p.calibration?.calibrated}`}
      captions={p.captions}
    />
  );
}

function stageInput(ui: MovementUi) {
  return { tracking: ui.tracking, confidence: ui.confidence, advice: ui.advice, phase: ui.phase, paused: false, verdict: ui.verdict };
}
