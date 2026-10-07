/**
 * lib/rehab/progressFacts.ts
 *
 * What can honestly be said about how an exercise is going across sessions. Pure, from stored numbers only.
 *
 * Every comparison has to clear an evidence bar before it is shown, because the numbers are noisy: a session's
 * range is the best single repetition, tracking quality varies, and one or two reps prove nothing. So a line
 * appears only when
 *   - both sessions were judged by the movement engine (never mixed with older, unjudged or hand-counted data),
 *   - both measured range in the same unit,
 *   - both had enough judged reps to mean something, and
 *   - the difference is clearly bigger than the noise.
 * Only encouraging comparisons are shown to the patient; the full numbers stay in the progress charts and the
 * therapist's view. Nothing here is a score, a rank or a prediction.
 */

import { creditsGoodRepsOnly } from "./chunkQuality";

export interface HistorySession {
  /** YYYY-MM-DD in the patient's timezone. Sessions on the same day as the current one are not "previous". */
  dateKey: string;
  exerciseId: string;
  judged: boolean;
  /** Engine version. From v4 only good reps are credited and every attempt is in the share, so v4 is never compared with older data. */
  engine?: number;
  validReps?: number;
  invalidReps?: number;
  partialReps?: number;
  /** Best measured range, in `romUnit`. 0 or undefined = not measured. */
  rom?: number;
  romUnit?: "deg" | "pct";
  targetRom?: number;
}

/** The evidence bars. Engineering defaults, not clinical thresholds. */
export const EVIDENCE = {
  /** Judged reps (valid + invalid) a session needs before it can be compared. */
  minJudgedReps: 8,
  /** Range must beat the comparison by at least this much (degrees, or percentage points). */
  minRomGain: 5,
  /** A personal best needs at least this many earlier measured sessions and beat the best by this much. */
  minPriorSessionsForBest: 2,
  minBestGain: 3,
  /** Good-form share must rise by at least this many percentage points. */
  minFormGain: 10,
} as const;

/** Judged attempts: from engine v4 that includes the attempts that fell short; before, only counted reps were judged. */
const judgedReps = (s: HistorySession) => (s.judged ? (s.validReps ?? 0) + (s.invalidReps ?? 0) + (creditsGoodRepsOnly(s.engine) ? (s.partialReps ?? 0) : 0) : 0);
const sameBasis = (a: HistorySession, b: HistorySession) => creditsGoodRepsOnly(a.engine) === creditsGoodRepsOnly(b.engine);
const usable = (s: HistorySession) => s.judged && judgedReps(s) >= EVIDENCE.minJudgedReps;
const measured = (s: HistorySession) => s.judged && (s.rom ?? 0) > 0 && judgedReps(s) >= EVIDENCE.minJudgedReps;
const share = (s: HistorySession) => (s.validReps ?? 0) / Math.max(1, judgedReps(s));

export interface ProgressFacts {
  /** Encouraging, true statements, best first. At most one is shown on the summary. */
  highlights: string[];
  /** "Last time you completed N good repetitions…" for the start of the next session, or null. */
  lastTime: string | null;
  /** The best range measured so far, when there is enough history for "best" to mean anything. */
  personalBest: { rom: number; unit: "deg" | "pct" } | null;
}

/**
 * `current` is today's session (or null when only previewing the next one); `previous` are earlier sessions of the
 * SAME exercise, any order. Sessions dated on or after `current`'s day are ignored.
 */
export function progressFacts(current: HistorySession | null, previous: HistorySession[]): ProgressFacts {
  const earlier = previous
    .filter((p) => (!current || (p.dateKey < current.dateKey && p.exerciseId === current.exerciseId)))
    .sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));
  // "Last time" for a comparison is the latest usable session on the SAME basis as today's; with no session in play any will do.
  const last = earlier.find((p) => usable(p) && (!current || sameBasis(p, current))) ?? null;

  const lastTime = last && (last.validReps ?? 0) > 0 ? `Last time you completed ${last.validReps} good ${last.validReps === 1 ? "repetition" : "repetitions"}. Let’s see how today feels.` : null;

  const sameUnit = (a: HistorySession, b: HistorySession) => a.romUnit !== undefined && a.romUnit === b.romUnit && sameBasis(a, b);
  const highlights: string[] = [];

  if (current && measured(current)) {
    const comparable = earlier.filter((p) => measured(p) && sameUnit(p, current));

    // First time reaching the therapist's target range (degrees only; the target is stored in degrees).
    if (current.romUnit === "deg" && current.targetRom && (current.rom ?? 0) >= current.targetRom && comparable.length >= 1 && comparable.every((p) => (p.rom ?? 0) < (current.targetRom as number))) {
      highlights.push("This is the first time you’ve reached the range your therapist set.");
    }

    // Best range so far, with enough history and a clear margin.
    if (comparable.length >= EVIDENCE.minPriorSessionsForBest) {
      const best = Math.max(...comparable.map((p) => p.rom ?? 0));
      if ((current.rom as number) >= best + EVIDENCE.minBestGain) highlights.push("That’s your best range so far.");
    }

    // Better than last time.
    const prev = comparable[0];
    if (prev && (current.rom as number) >= (prev.rom as number) + EVIDENCE.minRomGain) highlights.push("Your range was better than your last session.");
  }

  if (current && usable(current) && last && usable(last)) {
    if (Math.round(100 * share(current)) >= Math.round(100 * share(last)) + EVIDENCE.minFormGain) highlights.push(creditsGoodRepsOnly(current.engine) ? "More of your attempts counted as good reps than last time." : "More of your reps had good form than last time.");
  }

  const measuredAll = [...earlier, ...(current ? [current] : [])].filter((s) => measured(s) && (!current || sameUnit(s, current)));
  // With no session in play, the personal best is taken on the newest basis present.
  const newest = creditsGoodRepsOnly(measuredAll[0]?.engine);
  const unit = current?.romUnit ?? measuredAll[0]?.romUnit;
  const personalBest = unit && measuredAll.length >= EVIDENCE.minPriorSessionsForBest ? { rom: Math.max(...measuredAll.filter((s) => s.romUnit === unit && (current || creditsGoodRepsOnly(s.engine) === newest)).map((s) => s.rom ?? 0)), unit } : null;

  return { highlights, lastTime, personalBest };
}
