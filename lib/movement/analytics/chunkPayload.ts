/**
 * lib/movement/analytics/chunkPayload.ts
 *
 * Turns the engine's summary of a chunk of reps into the payload the server stores.
 * Every number comes from the engine; nothing is estimated or defaulted here.
 * `reps` is the number of GOOD reps (the only ones that credit the prescription); attempts that did not count travel beside it.
 */
import type { ChunkSummary } from "../judge/engine";
import type { Observation } from "../coach/coachState";
import type { ChunkQuality } from "@/lib/rehab/chunkQuality";
import { ENGINE_VERSION } from "../version";

export interface ChunkPayload extends ChunkQuality {
  reps: number;
  rom?: number;
  formScore?: number;
  /** Reps affected by each error code (kept for older readers of `issues`). */
  issues?: Record<string, number>;
}

export function summaryToPayload(s: ChunkSummary & { observations?: Observation[] }): ChunkPayload {
  const errors = Object.keys(s.errors).length ? s.errors : undefined;
  return {
    reps: s.counted,
    rom: s.rom > 0 ? s.rom : undefined,
    // Share of ALL attempts that were good reps (engine v4): reps that fell short or broke a rule are part of the denominator.
    formScore: s.valid + s.invalid + s.partial > 0 ? Math.round((100 * s.valid) / (s.valid + s.invalid + s.partial)) : undefined,
    issues: errors ? Object.fromEntries(Object.entries(errors).map(([code, e]) => [code, e.count])) : undefined,
    engine: ENGINE_VERSION,
    validReps: s.valid,
    invalidReps: s.invalid,
    partialReps: s.partial,
    uncertainReps: s.uncertain,
    unevaluable: s.unevaluable.length ? s.unevaluable : undefined,
    thresholdsUsed: { minRange: s.thresholds.minRange, unit: s.thresholds.unit, holdMs: s.thresholds.holdMs, rangeOverridden: s.thresholds.rangeOverridden },
    attempts: s.attempts.length ? s.attempts.map((a) => ({ outcome: a.outcome, reason: a.reason, reached: Math.round(a.reached * 100) / 100, ms: a.durationMs, conf: a.confidence, ...(a.reasons ? { reasons: a.reasons } : {}), ...(a.rom !== undefined ? { rom: a.rom } : {}) })) : undefined,
    avgConfidence: s.avgConfidence,
    lowConfidenceMs: s.lowConfidenceMs,
    corrections: s.corrections,
    flags: errors,
    repRecords: s.reps.map((r) => ({ n: r.n, outcome: r.outcome, valid: r.valid, quality: r.quality, reasons: r.reasons, errors: r.errors, rom: r.rom, ms: r.durationMs, conf: r.confidence })),
    observations: (s.observations ?? []).map((o) => ({ code: o.code.toUpperCase(), repsAffected: o.repsAffected, ofReps: o.ofReps })),
  };
}
