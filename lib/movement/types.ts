/**
 * lib/movement/types.ts
 *
 * Shared vocabulary of the movement-intelligence loop. Everything under lib/movement is
 * pure TypeScript (no React, no DOM, no network) so it can run in the browser frame loop,
 * in tests and in replay scripts alike.
 */

/** A landmark as MediaPipe reports it (normalised image coordinates, or metres for world landmarks). */
export interface LM {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

/** One camera frame's worth of pose output. `t` is a monotonic time in milliseconds. */
export interface RawFrame {
  t: number;
  /** 33 normalised image landmarks, or null when no person was found. */
  image: readonly LM[] | null;
  /** 33 metric 3D landmarks (hip-centred), when the model supplies them. */
  world?: readonly LM[] | null;
  /** Video width / height in pixels. Needed so angles are not distorted by non-square frames. */
  aspect: number;
}

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

/** The five phases every repetition moves through. Templates label them for display. */
export type Phase = "setup" | "rest" | "out" | "peak" | "back";

export type Severity = "minor" | "moderate" | "major";

/** Joint colour state drawn on the skeleton. */
export const JOINT_OK = 0; // green: tracked and within tolerance
export const JOINT_ERROR = 1; // red: sustained deviation
export const JOINT_UNCERTAIN = 2; // yellow: not seen clearly enough to judge
export const JOINT_NEUTRAL = 3; // not part of this exercise

export type CameraAdviceCode =
  | "no_person"
  | "cut_off"
  | "too_close"
  | "too_far"
  | "low_visibility"
  | "wrong_orientation";

export interface CameraAdvice {
  code: CameraAdviceCode;
  /** Plain instruction for the person, e.g. "Move slightly backward." */
  message: string;
  /** The joint that triggered it, when one specific joint is the problem. */
  joint?: string;
}

/** Structured, deterministic facts about the movement. Input to the coaching loop and to storage. */
export type MovementEvent =
  | { type: "camera_issue"; t: number; advice: CameraAdvice }
  | { type: "camera_ok"; t: number }
  | { type: "setup_ready"; t: number }
  | { type: "phase_changed"; t: number; phase: Phase; rep: number }
  | {
      type: "movement_error";
      t: number;
      exercise: string;
      phase: Phase;
      joint: string;
      error: string;
      severity: Severity;
      direction: "low" | "high";
      measured: number;
      expected: number;
      confidence: number;
      rep: number;
      oneShot: boolean;
    }
  | { type: "movement_corrected"; t: number; error: string; joint: string; afterMs: number; rep: number }
  | {
      type: "rep_completed";
      t: number;
      rep: number;
      valid: boolean;
      reasons: string[];
      rom: number;
      durationMs: number;
      confidence: number;
    }
  | { type: "partial_rep"; t: number; reached: number };

export interface RepRecord {
  /** 1-based number of the counted repetition within this chunk. */
  n: number;
  valid: boolean;
  /** Error codes that made the rep invalid (empty when valid). */
  reasons: string[];
  /** Every error code raised during the rep, valid or not. */
  errors: string[];
  rom: number;
  durationMs: number;
  confidence: number;
}

export interface ActiveDeviation {
  error: string;
  joint: string;
  severity: Severity;
  direction: "low" | "high";
  measured: number;
  expected: number;
  sinceMs: number;
}
