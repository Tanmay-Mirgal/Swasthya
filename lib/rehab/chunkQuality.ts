/**
 * lib/rehab/chunkQuality.ts
 *
 * The movement-quality measurements the on-device engine attaches to a chunk of reps:
 * how many reps were valid, which errors came up, how often a spoken correction worked,
 * how well the camera could see. Everything arrives from the browser, so everything is
 * sanitised here: unknown shapes are dropped, numbers are clamped, codes are whitelisted by
 * pattern, and free text from the client is never stored (labels are looked up from the
 * exercise templates on the server instead).
 *
 * Pure and dependency-free so it runs in tests and in the route handler alike.
 */

export type ErrorSeverity = "minor" | "moderate" | "major";

export interface StoredRep {
  n: number;
  valid: boolean;
  reasons: string[];
  errors: string[];
  rom: number;
  ms: number;
  conf: number;
}

export interface StoredObservation {
  code: string;
  repsAffected: number;
  ofReps: number;
}

export interface ChunkQuality {
  /** Version of the movement engine that produced these numbers. Absent on older records. */
  engine?: number;
  validReps?: number;
  invalidReps?: number;
  partialReps?: number;
  /** Mean visibility of the joints the exercise needs while judging, 0..1. */
  avgConfidence?: number;
  lowConfidenceMs?: number;
  corrections?: { attempted: number; succeeded: number };
  /** Reps affected by each error code, with the worst severity seen. */
  flags?: Record<string, { count: number; severity: ErrorSeverity }>;
  repRecords?: StoredRep[];
  observations?: StoredObservation[];
}

const CODE = /^[A-Z][A-Z_]{2,39}$/;
const SEVERITIES: ErrorSeverity[] = ["minor", "moderate", "major"];

const int = (v: unknown, lo: number, hi: number): number | undefined => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= lo && n <= hi ? n : undefined;
};
const num = (v: unknown, lo: number, hi: number): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) && n >= lo && n <= hi ? n : undefined;
};
const codes = (v: unknown, max: number): string[] =>
  Array.isArray(v) ? v.filter((c): c is string => typeof c === "string" && CODE.test(c)).slice(0, max) : [];

/** Sanitises untrusted quality data for a chunk of `reps` credited reps. */
export function cleanQuality(raw: unknown, reps: number): ChunkQuality {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const out: ChunkQuality = {};

  const engine = int(r.engine, 1, 99);
  if (engine !== undefined) out.engine = engine;

  if (r.validReps !== undefined || r.invalidReps !== undefined) {
    const valid = Math.min(int(r.validReps, 0, 1000) ?? 0, reps);
    const invalid = Math.min(int(r.invalidReps, 0, 1000) ?? 0, reps - valid);
    out.validReps = valid;
    out.invalidReps = invalid;
  }
  const partial = int(r.partialReps, 0, 1000);
  if (partial !== undefined) out.partialReps = partial;
  const conf = num(r.avgConfidence, 0, 1);
  if (conf !== undefined) out.avgConfidence = Math.round(conf * 100) / 100;
  const low = int(r.lowConfidenceMs, 0, 3_600_000);
  if (low !== undefined) out.lowConfidenceMs = low;

  if (r.corrections && typeof r.corrections === "object") {
    const c = r.corrections as Record<string, unknown>;
    const attempted = int(c.attempted, 0, 10_000);
    const succeeded = int(c.succeeded, 0, 10_000);
    if (attempted !== undefined && succeeded !== undefined) out.corrections = { attempted, succeeded: Math.min(succeeded, attempted) };
  }

  if (r.flags && typeof r.flags === "object") {
    const flags: NonNullable<ChunkQuality["flags"]> = {};
    for (const [code, v] of Object.entries(r.flags as Record<string, unknown>).slice(0, 12)) {
      if (!CODE.test(code) || !v || typeof v !== "object") continue;
      const e = v as Record<string, unknown>;
      const count = int(e.count, 1, 10_000);
      const severity = SEVERITIES.find((s) => s === e.severity);
      if (count !== undefined && severity) flags[code] = { count, severity };
    }
    if (Object.keys(flags).length) out.flags = flags;
  }

  if (Array.isArray(r.repRecords)) {
    const recs: StoredRep[] = [];
    for (const item of r.repRecords.slice(0, 60)) {
      if (!item || typeof item !== "object") continue;
      const x = item as Record<string, unknown>;
      const n = int(x.n, 1, 200);
      if (n === undefined || typeof x.valid !== "boolean") continue;
      recs.push({
        n,
        valid: x.valid,
        reasons: codes(x.reasons, 6),
        errors: codes(x.errors, 8),
        rom: int(x.rom, 0, 360) ?? 0,
        ms: int(x.ms, 0, 600_000) ?? 0,
        conf: Math.round((num(x.conf, 0, 1) ?? 0) * 100) / 100,
      });
    }
    if (recs.length) out.repRecords = recs;
  }

  if (Array.isArray(r.observations)) {
    const obs: StoredObservation[] = [];
    for (const item of r.observations.slice(0, 6)) {
      if (!item || typeof item !== "object") continue;
      const x = item as Record<string, unknown>;
      const code = typeof x.code === "string" ? x.code : "";
      const affected = int(x.repsAffected, 1, 1000);
      const of = int(x.ofReps, 1, 1000);
      if (CODE.test(code) && affected !== undefined && of !== undefined && affected <= of) obs.push({ code, repsAffected: affected, ofReps: of });
    }
    if (obs.length) out.observations = obs;
  }
  return out;
}

/** Fits quality numbers to the reps actually credited (a chunk can be credited fewer reps than were counted). */
export function clampQuality<T extends ChunkQuality>(q: T, credited: number): T {
  if (q.validReps === undefined && q.invalidReps === undefined) return q;
  const valid = Math.min(q.validReps ?? 0, credited);
  const invalid = Math.min(q.invalidReps ?? 0, credited - valid);
  return { ...q, validReps: valid, invalidReps: invalid, repRecords: q.repRecords?.slice(0, credited) };
}

export interface QualityRollup {
  engineVersion?: number;
  validReps?: number;
  invalidReps?: number;
  partialReps?: number;
  correctionAttempts?: number;
  correctionsSucceeded?: number;
  avgConfidence?: number;
  lowConfidenceMs?: number;
  /** Reps affected per error code, with the worst severity seen. */
  errors?: Record<string, { count: number; severity: ErrorSeverity }>;
  observations?: StoredObservation[];
}

const SEVERITY_RANK: Record<ErrorSeverity, number> = { minor: 0, moderate: 1, major: 2 };

/** Combines the quality of every chunk of one exercise-day into session-level totals. */
export function rollupQuality(chunks: Array<{ reps: number } & ChunkQuality>): QualityRollup {
  const out: QualityRollup = {};
  const withQuality = chunks.filter((c) => c.validReps !== undefined || c.engine !== undefined);
  if (!withQuality.length) return out;

  out.engineVersion = Math.max(...withQuality.map((c) => c.engine ?? 0)) || undefined;
  const sum = (f: (c: (typeof chunks)[number]) => number | undefined) => {
    let any = false;
    let total = 0;
    for (const c of chunks) {
      const v = f(c);
      if (v !== undefined) {
        any = true;
        total += v;
      }
    }
    return any ? total : undefined;
  };
  out.validReps = sum((c) => c.validReps);
  out.invalidReps = sum((c) => c.invalidReps);
  out.partialReps = sum((c) => c.partialReps);
  out.correctionAttempts = sum((c) => c.corrections?.attempted);
  out.correctionsSucceeded = sum((c) => c.corrections?.succeeded);
  out.lowConfidenceMs = sum((c) => c.lowConfidenceMs);

  const weighted = chunks.filter((c) => c.avgConfidence !== undefined && c.reps > 0);
  if (weighted.length) {
    const reps = weighted.reduce((s, c) => s + c.reps, 0);
    out.avgConfidence = Math.round((weighted.reduce((s, c) => s + (c.avgConfidence as number) * c.reps, 0) / reps) * 100) / 100;
  }

  const errors: NonNullable<QualityRollup["errors"]> = {};
  for (const c of chunks) {
    for (const [code, e] of Object.entries(c.flags ?? {})) {
      const cur = errors[code];
      if (cur) {
        cur.count += e.count;
        if (SEVERITY_RANK[e.severity] > SEVERITY_RANK[cur.severity]) cur.severity = e.severity;
      } else errors[code] = { ...e };
    }
  }
  if (Object.keys(errors).length) out.errors = errors;

  const obs = new Map<string, StoredObservation>();
  for (const c of chunks) {
    for (const o of c.observations ?? []) {
      const cur = obs.get(o.code);
      if (cur) obs.set(o.code, { code: o.code, repsAffected: cur.repsAffected + o.repsAffected, ofReps: cur.ofReps + o.ofReps });
      else obs.set(o.code, { ...o });
    }
  }
  if (obs.size) out.observations = [...obs.values()];
  return out;
}

/** Form accuracy as the share of counted reps that were valid; undefined when the engine did not judge any. */
export function formAccuracyOf(validReps?: number, invalidReps?: number): number | undefined {
  if (validReps === undefined || invalidReps === undefined) return undefined;
  const total = validReps + invalidReps;
  return total > 0 ? Math.round((100 * validReps) / total) : undefined;
}

/** Correction success as a percentage; undefined when no correction was attempted. */
export function correctionRateOf(attempted?: number, succeeded?: number): number | undefined {
  if (!attempted || attempted <= 0 || succeeded === undefined) return undefined;
  return Math.round((100 * Math.min(succeeded, attempted)) / attempted);
}

/** Mean seconds per counted rep across every chunk that carries per-rep records. */
export function avgRepSecondsOf(sets: Array<{ chunks?: Array<{ repRecords?: StoredRep[] }> }> | undefined): number | undefined {
  const ms = (sets ?? []).flatMap((s) => (s.chunks ?? []).flatMap((c) => (c.repRecords ?? []).map((r) => r.ms))).filter((n) => n > 0);
  return ms.length ? Math.round(ms.reduce((a, b) => a + b, 0) / ms.length / 100) / 10 : undefined;
}
