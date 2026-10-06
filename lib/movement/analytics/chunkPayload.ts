/**
 * lib/movement/analytics/chunkPayload.ts
 *
 * Turns the engine's summary of a chunk of reps into the payload the server stores.
 * Every number comes from the engine; nothing is estimated or defaulted here.
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
    formScore: s.counted > 0 ? Math.round((100 * s.valid) / s.counted) : undefined,
    issues: errors ? Object.fromEntries(Object.entries(errors).map(([code, e]) => [code, e.count])) : undefined,
    engine: ENGINE_VERSION,
    validReps: s.valid,
    invalidReps: s.invalid,
    partialReps: s.partial,
    avgConfidence: s.avgConfidence,
    lowConfidenceMs: s.lowConfidenceMs,
    corrections: s.corrections,
    flags: errors,
    repRecords: s.reps.map((r) => ({ n: r.n, valid: r.valid, reasons: r.reasons, errors: r.errors, rom: r.rom, ms: r.durationMs, conf: r.confidence })),
    observations: (s.observations ?? []).map((o) => ({ code: o.code.toUpperCase(), repsAffected: o.repsAffected, ofReps: o.ofReps })),
  };
}
