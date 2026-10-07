/**
 * lib/movement/ui/movementUi.ts
 *
 * What the exercise screen shows, derived in one place from the engine's latest frame and
 * the coach's state. Pure, so the live hook and the design-preview replay build it the same
 * way and tests can check what a person would read.
 */
import type { FrameResult } from "../judge/engine";
import { defaultCue, type AttemptMark, type CoachState, type CueTone, type Verdict } from "../coach/coachState";
import { resolveRef } from "../landmarks";
import type { MovementTemplate } from "../template/schema";
import { JOINT_NEUTRAL, type CameraAdvice, type ConfidenceLevel, type Phase } from "../types";
import { deriveStageVerdict, type StageVerdict } from "../verdict/stageVerdict";

/** Where the body is in the video, as fractions (0..1) of the video frame. Used to keep overlays off the person. */
export interface BodyBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface JointStatus {
  label: string;
  /** JOINT_OK | JOINT_ERROR | JOINT_UNCERTAIN | JOINT_NEUTRAL */
  state: number;
}

export interface MovementUi {
  status: "idle" | "loading" | "running" | "error";
  tracking: boolean;
  confidence: ConfidenceLevel;
  advice: CameraAdvice | null;
  phase: Phase;
  phaseLabel: string;
  setupProgress: number;
  /** GOOD reps: the number that counts toward the prescription (equal to `valid`). */
  counted: number;
  valid: number;
  /** Attempts that reached the full range but broke a rule. NOT counted. */
  invalid: number;
  /** Attempts that did not reach the full range. NOT counted. */
  partial: number;
  /** invalid + partial: everything the person tried that did not count. */
  notCounted: number;
  /** The result of the last attempt (a good rep, or one that was not counted); clears itself after a few seconds. */
  verdict: Verdict | null;
  /** What became of each attempt in this chunk, in order. */
  attempts: AttemptMark[];
  /** The person's bounding box in the video frame, or null when nobody is seen. */
  bodyBox: BodyBox | null;
  /** What the patient is told right now: one mark, one word, one short instruction (see verdict/stageVerdict). */
  stage: StageVerdict;
  /** After several attempts in a row that did not count: point to the guide, and offer to finish for today. */
  suggestDemo: boolean;
  offerFinish: boolean;
  targetReps: number;
  done: boolean;
  cue: string;
  cueTone: CueTone | "default";
  cueCode: string | null;
  /** Current value of the primary measurement, in display units; NaN when unknown. */
  primary: number;
  unit: "deg" | "pct";
  /** Best range of motion in this chunk so far (display units). */
  rom: number;
  lastRepSeconds: number;
  /** One entry per counted rep, in order: true = valid, false = counted but flagged. */
  repFlags: boolean[];
  joints: JointStatus[];
  activeErrors: string[];
  fps: number;
}

export function initialUi(template: MovementTemplate, targetReps: number): MovementUi {
  return {
    status: "idle",
    tracking: false,
    confidence: "LOW",
    advice: null,
    phase: "setup",
    phaseLabel: "Get into position",
    setupProgress: 0,
    counted: 0,
    valid: 0,
    invalid: 0,
    partial: 0,
    notCounted: 0,
    verdict: null,
    attempts: [],
    bodyBox: null,
    stage: deriveStageVerdict({ tracking: false, confidence: "LOW", advice: null, phase: "setup", paused: false, verdict: null }),
    suggestDemo: false,
    offerFinish: false,
    targetReps,
    done: false,
    cue: template.setup.instruction,
    cueTone: "default",
    cueCode: null,
    primary: NaN,
    unit: template.rep.unit,
    rom: 0,
    lastRepSeconds: 0,
    repFlags: [],
    joints: template.statusJoints.map((j) => ({ label: j.label, state: JOINT_NEUTRAL })),
    activeErrors: [],
    fps: 0,
  };
}

export interface UiExtras {
  status: MovementUi["status"];
  rom: number;
  lastRepMs: number;
  repFlags: boolean[];
  fps: number;
}

export function buildMovementUi(r: FrameResult, coach: CoachState, template: MovementTemplate, x: UiExtras): MovementUi {
  const cue = coach.cue;
  return {
    status: x.status,
    tracking: r.tracking,
    confidence: r.confidence,
    advice: r.advice,
    phase: r.phase,
    phaseLabel: r.phase === "setup" ? "Get into position" : template.phaseLabels[r.phase],
    setupProgress: r.setupProgress,
    counted: r.counted,
    valid: r.valid,
    invalid: r.invalid,
    partial: r.partial,
    notCounted: r.invalid + r.partial,
    verdict: coach.verdict,
    attempts: coach.attemptMarks,
    bodyBox: bodyBoxOf(r),
    stage: deriveStageVerdict({ tracking: r.tracking, confidence: r.confidence, advice: r.advice, phase: r.phase, paused: coach.paused, verdict: coach.verdict }),
    suggestDemo: coach.suggestDemo,
    offerFinish: coach.offerFinish,
    targetReps: r.targetReps,
    done: r.done,
    cue: cue?.text ?? defaultCue(template, coach),
    cueTone: cue?.tone ?? "default",
    cueCode: cue?.code ?? null,
    primary: Number.isFinite(r.primary) ? Math.round(r.primary) : NaN,
    unit: template.rep.unit,
    rom: x.rom,
    lastRepSeconds: x.lastRepMs / 1000,
    repFlags: x.repFlags,
    joints: template.statusJoints.map((j) => ({ label: j.label, state: r.joints[resolveRef(j.ref, r.side)] ?? JOINT_NEUTRAL })),
    activeErrors: r.active.map((a) => a.error),
    fps: x.fps,
  };
}

/** The box around the joints the camera can see, in video fractions; null when nobody is in view. */
export function bodyBoxOf(r: Pick<FrameResult, "tracking" | "raw" | "vis">): BodyBox | null {
  if (!r.tracking) return null;
  let x0 = 1, x1 = 0, y0 = 1, y1 = 0, n = 0;
  for (let i = 0; i < 33; i++) {
    if (r.vis[i] < 0.4) continue;
    const x = r.raw[i * 3], y = r.raw[i * 3 + 1];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
    n++;
  }
  return n >= 4 ? { x0: Math.max(0, x0), x1: Math.min(1, x1), y0: Math.max(0, y0), y1: Math.min(1, y1) } : null;
}

/** A cheap fingerprint of everything on screen, so React state is only set when something changed. */
export function uiSignature(ui: MovementUi): string {
  return [
    ui.status,
    ui.tracking ? 1 : 0,
    ui.confidence,
    ui.advice?.code ?? "",
    ui.phase,
    Math.round(ui.setupProgress * 10),
    ui.counted,
    ui.valid,
    ui.invalid,
    ui.partial,
    ui.verdict?.seq ?? 0,
    ui.stage.kind,
    ui.attempts.join(","),
    ui.bodyBox ? [ui.bodyBox.x0, ui.bodyBox.x1, ui.bodyBox.y0, ui.bodyBox.y1].map((v) => Math.round(v * 20)).join(":") : "",
    ui.suggestDemo ? 1 : 0,
    ui.offerFinish ? 1 : 0,
    ui.targetReps,
    ui.cue,
    ui.cueTone,
    ui.joints.map((j) => j.state).join(""),
    ui.activeErrors.length,
    ui.primary,
    ui.rom,
    ui.repFlags.length,
    ui.fps,
  ].join("|");
}
