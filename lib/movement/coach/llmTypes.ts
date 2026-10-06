/**
 * lib/movement/coach/llmTypes.ts
 *
 * The structured facts handed to the language model, and what comes back. Only identifiers
 * and rounded numbers cross the wire: the server rebuilds the plain-language observation
 * from the exercise template, so the client cannot inject prompt text. No frames, no
 * landmarks and no personal details are ever included.
 */
import type { Phase, Severity } from "../types";

export interface CoachCueRequest {
  exerciseId: string;
  phase: Phase;
  rep: number;
  set: number;
  confidence: "HIGH" | "MEDIUM";
  error: {
    /** snake_case rule id from the exercise template. */
    code: string;
    direction: "low" | "high";
    severity: Severity;
    measured?: number;
    expected?: number;
    unit?: "deg" | "pct" | "s";
  };
  /** How many times this problem has already been coached. */
  attempts: number;
  /** True when the latest measurement is closer to the target than the first one; null when unknown. */
  improving: boolean | null;
  /** The wording used last time, so the model can vary it. Treated as data, length-limited. */
  previousCue?: string;
  /** Which escalation step this wording is for (0 = first). */
  tier: number;
}

export interface CoachCueResponse {
  cue: string | null;
  /** True when the deterministic message should be used. */
  fallback: boolean;
}
