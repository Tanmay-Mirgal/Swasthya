/**
 * lib/movement/ui/movementUi.ts
 *
 * What the exercise screen shows, derived in one place from the engine's latest frame and
 * the coach's state. Pure, so the live hook and the design-preview replay build it the same
 * way and tests can check what a person would read.
 */
import type { FrameResult } from "../judge/engine";
import { defaultCue, type CoachState, type CueTone } from "../coach/coachState";
import { resolveRef } from "../landmarks";
import type { MovementTemplate } from "../template/schema";
import { JOINT_NEUTRAL, type CameraAdvice, type ConfidenceLevel, type Phase } from "../types";

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
  counted: number;
  valid: number;
  invalid: number;
  partial: number;
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
