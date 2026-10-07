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
      /** A GOOD rep: it reached the full range, returned, and broke no mandatory rule. Only these are credited. */
      type: "rep_completed";
      t: number;
      /** Number of good reps so far in this chunk, including this one. */
      rep: number;
      /** Always true since engine v4 (a flagged rep is `rep_not_counted`); kept so older readers keep working. */
      valid: boolean;
      reasons: string[];
      rom: number;
      durationMs: number;
      confidence: number;
      /** How clean the good rep was. Chooses the wording ("Smooth and steady"); never shown as a number or a score. */
      quality?: RepQuality;
    }
  /** The movement reached the full range but broke a mandatory rule, so it was NOT counted. */
  | { type: "rep_not_counted"; t: number; reasons: string[]; rom: number; durationMs: number; confidence: number; /** Good reps so far (unchanged by this attempt). */ rep: number }
  /** The movement did not reach the full range, so it was NOT counted. `almost` = it got past the old halfway-credit line. */
  | { type: "partial_rep"; t: number; reached: number; almost?: boolean }
  /** A rep was under way when the camera lost the person, so it could not be judged. Not a mistake, not counted. */
  | { type: "uncertain_rep"; t: number; reached: number; reason: AttemptReason }
  /** A rule has had no measurable landmarks for a while, so it is not being checked. Quiet; never an error. */
  | { type: "rule_unevaluable"; t: number; rule: string };

/** What became of one cycle of the movement. Since engine v4 only `valid` ones are counted; the rest are attempts. */
export type RepOutcome = "valid" | "invalid" | "partial" | "uncertain" | "discarded";

/** Why a cycle that began did not become a counted rep. */
export type AttemptReason = "short_range" | "dropout" | "timeout" | "debounce" | "rule_broken" | "low_visibility" | "rule_unevaluable";

/** A cycle that began but was not counted. Kept so that nothing the person did simply disappears. */
export interface AttemptRecord {
  outcome: Exclude<RepOutcome, "valid">;
  reason: AttemptReason;
  /** How far toward the peak it got, 0..1. */
  reached: number;
  durationMs: number;
  confidence: number;
  /** For `invalid`: the mandatory rules (UPPER_SNAKE) that were broken. */
  reasons?: string[];
  /** For `invalid`: the range reached, in display units. */
  rom?: number;
}

/** `excellent`: seen clearly and nothing even to coach. `good`: counted, with something to coach or a less clear view. */
export type RepQuality = "excellent" | "good";

export interface RepRecord {
  /** 1-based number of the counted repetition within this chunk. */
  n: number;
  outcome: "valid" | "invalid";
  valid: boolean;
  quality?: RepQuality;
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
