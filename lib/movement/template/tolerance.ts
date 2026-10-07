/**
 * lib/movement/template/tolerance.ts
 *
 * The two things a prescription may adjust for one patient without touching the template: how long to hold at the top
 * (the prescription's `holdSeconds`, already stored) and the minimum range accepted as a good rep. The range can only
 * be made MORE lenient than the template and never below the template's "almost" line, so a clinician can fit the gate
 * to a patient who physically cannot reach the default yet, and the app can never silently lower its own standard.
 */
import type { MovementTemplate, RepSpec } from "./schema";

export interface EngineTolerance {
  /** Hold at the peak, in ms (from the prescription). Replaces the template's own hold when set. */
  holdMs?: number | null;
  /** Minimum range accepted as a good rep, in the template's display units (degrees, or percent). */
  minRange?: number | null;
}

const scaleOf = (t: MovementTemplate) => t.rep.displayScale ?? 1;

/** The range a therapist may choose from, in display units: from the template's default (strict) to its "almost" line (most lenient). */
export function rangeOverrideBounds(t: MovementTemplate): { strict: number; lenient: number; unit: "deg" | "pct" } {
  const s = scaleOf(t);
  return { strict: Math.round(t.rep.peakThreshold * s * 100) / 100, lenient: Math.round(t.rep.countThreshold * s * 100) / 100, unit: t.rep.unit };
}

/** True when `value` (display units) is an allowed override for this template. */
export function isValidRangeOverride(t: MovementTemplate, value: number): boolean {
  if (!Number.isFinite(value)) return false;
  const { strict, lenient } = rangeOverrideBounds(t);
  return value >= Math.min(strict, lenient) - 1e-9 && value <= Math.max(strict, lenient) + 1e-9;
}

/** The rep spec the engine actually uses for this patient: the template's, with the prescription's tolerance applied. */
export function effectiveRep(t: MovementTemplate, tol: EngineTolerance = {}): RepSpec {
  const base = t.rep;
  const s = base.direction === "increase" ? 1 : -1;
  let peak = base.peakThreshold;
  if (tol.minRange !== undefined && tol.minRange !== null && Number.isFinite(tol.minRange)) {
    // In the direction of movement, "more lenient" is closer to the count line. Clamp into [count, peak].
    const u = Math.min(s * base.peakThreshold, Math.max(s * base.countThreshold, s * (tol.minRange / scaleOf(t))));
    peak = u / s;
  }
  const hold = tol.holdMs !== undefined && tol.holdMs !== null && tol.holdMs > 0 ? tol.holdMs : base.minPeakHoldMs;
  return { ...base, peakThreshold: peak, ...(hold ? { minPeakHoldMs: hold } : {}) };
}
