/**
 * lib/movement/template/schema.ts
 *
 * The Exercise Template: the single source of truth for what correct movement means.
 * A template is plain data (no functions) so it can be validated, documented and reviewed
 * by a therapist. The generic MovementEngine reads it; nothing exercise-specific lives in
 * the engine. To add an exercise, add one template file and register it.
 *
 * All thresholds are engineering defaults chosen to be conservative. They are not clinical
 * advice and are expected to be tuned against real camera footage and therapist review.
 */
import type { LandmarkRef } from "../landmarks";
import type { Phase, Severity } from "../types";

// ── Metrics ────────────────────────────────────────────────────────────────────

export type MetricSpace = "image" | "world";
export type ScaleRef = "torso" | "shoulderWidth" | "hipWidth" | "shin" | "thigh" | "none";
/** How a captured baseline is applied: `delta` = value - baseline; `ratioDrop` = 1 - value / baseline. */
export type BaselineMode = "delta" | "ratioDrop";

interface MetricBase {
  /** Captured while the person holds the starting position, then used as the reference. */
  baseline?: BaselineMode;
  /** Take the magnitude of the result (after any baseline is applied). */
  abs?: boolean;
}

export type MetricDef = MetricBase &
  (
    | { kind: "angle"; a: LandmarkRef; b: LandmarkRef; c: LandmarkRef; space?: MetricSpace }
    /** Angle of the segment a→b from straight down, 0 to 180 degrees. */
    | { kind: "fromVertical"; a: LandmarkRef; b: LandmarkRef }
    /** (point.x - mid(ref1, ref2).x) / scale, signed. */
    | { kind: "offsetX"; point: LandmarkRef; ref1: LandmarkRef; ref2: LandmarkRef; scale: ScaleRef }
    /** (point.y - from.y) / scale. Positive = below `from` in the image. */
    | { kind: "offsetY"; point: LandmarkRef; from: LandmarkRef; scale: ScaleRef }
    | { kind: "distance"; a: LandmarkRef; b: LandmarkRef; scale: ScaleRef }
    /** Sideways distance of `point` from the line end1→end2, positive toward the body midline. */
    | { kind: "lineOffsetInward"; point: LandmarkRef; end1: LandmarkRef; end2: LandmarkRef; scale: ScaleRef }
    /** |b.y - a.y| / |d.y - c.y|: a foreshortening-sensitive vertical ratio (used for depth from the front). */
    | { kind: "verticalRatio"; a: LandmarkRef; b: LandmarkRef; c: LandmarkRef; d: LandmarkRef }
  );

export interface Condition {
  metric: string;
  min?: number;
  max?: number;
}

// ── Repetition ─────────────────────────────────────────────────────────────────

/**
 * Every exercise here is a cycle on one primary metric: rest → out → peak → back → rest.
 * Thresholds are in the metric's own units; `direction` says which way the metric moves
 * from rest toward peak, so a curl (angle decreases) and an extension (angle increases)
 * share one state machine.
 *
 * A cycle that reaches `countThreshold` is COUNTED (it credits the prescription). It is
 * VALID only if it also reaches `peakThreshold`, is not too fast, and raises no rule that
 * invalidates a rep. A cycle that never reaches `countThreshold` is a partial attempt.
 */
export interface RepSpec {
  metric: string;
  direction: "increase" | "decrease";
  restThreshold: number;
  leaveThreshold: number;
  countThreshold: number;
  peakThreshold: number;
  /** How far the metric must retreat from the peak zone to count as heading back. */
  returnDrop: number;
  minRepMs: number;
  maxRepMs?: number;
  /** Minimum time spent in the peak zone for the rep to be valid (a hold). */
  minPeakHoldMs?: number;
  /** Minimum gap between two counted reps. */
  debounceMs: number;
  /** If heading back and not at rest after this long, raise `incompleteReturn`. */
  returnStallMs: number;
  /** A rep still in progress after this long is abandoned. */
  abandonMs: number;
  /** ROM and measurements are shown multiplied by this (e.g. 100 for a ratio shown as %). */
  displayScale?: number;
  unit: "deg" | "pct";
}

// ── Rules ──────────────────────────────────────────────────────────────────────

/** Wording for one kind of deviation. `texts` escalate: first mention, repeat, persistent. */
export interface RuleMessage {
  /** At least three. Each says WHAT is wrong, WHERE, and HOW to fix it. */
  texts: [string, string, string, ...string[]];
  /** Plain observation handed to the language model as a fact, never a measurement. */
  observation: string;
}

interface RuleBase {
  /** Error code. snake_case; stored upper-snake in session data. */
  id: string;
  /** Short name for therapist-facing summaries. */
  label: string;
  severity: Severity;
  /** When raised during a rep, the rep is counted but marked invalid. */
  invalidatesRep: boolean;
  /** Joints turned RED while the rule is active. */
  landmarks: LandmarkRef[];
  /** Skeleton segments turned RED while the rule is active. */
  bones?: [LandmarkRef, LandmarkRef][];
  /** Wording when the value is BELOW `min`. */
  low?: RuleMessage;
  /** Wording when the value is ABOVE `max`. */
  high?: RuleMessage;
  /** Played when the patient fixes it. Defaults to a generic acknowledgement. */
  ack?: string;
}

/** Evaluated every frame, only in the listed phases; needs `sustainMs` before it turns red. */
export interface ContinuousRule extends RuleBase {
  kind: "range" | "alignment" | "compensation";
  metric: string;
  phases: Phase[];
  min?: number;
  max?: number;
  /** Extra margin back inside the band before it clears (hysteresis), in metric units. */
  release: number;
  sustainMs: number;
  recoverMs: number;
}

/** Evaluated once per rep from the rep itself. Thresholds come from `RepSpec`. */
export interface RepRules {
  /** Fires when the rep turns around before `peakThreshold`. */
  range: RuleBase;
  tooFast?: RuleBase;
  tooSlow?: RuleBase;
  incompleteReturn?: RuleBase;
  shortHold?: RuleBase;
}

// ── Template ───────────────────────────────────────────────────────────────────

export type BodySegment = "lower" | "upper" | "neck";

export interface MovementTemplate {
  id: string;
  version: number;
  name: string;
  description: string;
  category: string;
  difficulty: "Beginner" | "Intermediate";
  bodyPart: string;
  bodySegment: BodySegment;
  primaryJoint: string;
  movement: string;
  defaultReps: number;
  instructions: string[];

  camera: {
    view: "side" | "front" | "either";
    minBodyFraction: number;
    maxBodyFraction: number;
    /** One line shown on the set-up screen. */
    hint: string;
    /** Word used in camera advice, e.g. "leg", "arm", "head and shoulders". */
    segmentWord: string;
  };

  /** Which body side to evaluate for refs written as `active`. `auto` picks the better-seen side. */
  sideMode: "auto" | "left" | "right";
  landmarks: { required: LandmarkRef[]; optional: LandmarkRef[] };

  metrics: Record<string, MetricDef>;

  setup: {
    instruction: string;
    holdMs: number;
    /** All must hold, in addition to the primary metric being in the rest zone. */
    conditions?: Condition[];
    /** Baselined metrics are only captured while their raw values stay within this range. */
    stableWithin?: number;
  };

  /** Display names for the phases, shown to the patient. */
  phaseLabels: Record<Exclude<Phase, "setup">, string>;
  /** Plain-language movement cue for each phase (the deterministic coaching when nothing is wrong). */
  phaseCues: Record<Exclude<Phase, "setup">, string>;

  rep: RepSpec;
  repRules: RepRules;
  rules: ContinuousRule[];

  /** Joints shown in the status strip, in order, with their label. */
  statusJoints: { label: string; ref: LandmarkRef }[];

  commonMistakes: string[];
}
