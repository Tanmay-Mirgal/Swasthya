/**
 * lib/rehab/milestones.ts
 *
 * The encouraging facts shown after an exercise and after the day's routine, derived only from stored
 * numbers. Pure. Nothing here is invented, estimated or compared with another session: a line appears
 * only when the data in front of it makes it true, and the motivational layer never turns a clinical
 * measurement into a score.
 *
 * Deliberately NOT here: "first time" and "better than last time". Those need history across sessions and live
 * with the progress work (`progressFacts`), behind their own evidence rules. `evaluateSet` below does take the best
 * range so far as an INPUT, already restricted by those rules, and applies the same evidence bar to the set.
 */
import { EVIDENCE } from "./progressFacts";

export interface SessionFacts {
  exerciseId: string;
  completedSets: number;
  targetSets: number;
  completedReps: number;
  /** True when the movement engine judged the reps (engine v2+). Hand-counted and legacy sessions are not judged. */
  judged: boolean;
  /** Engine v4+: `completedReps` are GOOD reps only, and `invalidReps` / `partialReps` are attempts that did not count. */
  goodOnly?: boolean;
  validReps?: number;
  invalidReps?: number;
  partialReps?: number;
  correctionAttempts?: number;
  correctionsSucceeded?: number;
  /** Best measured range, in the unit named by `romUnit`. Absent when nothing was measured. */
  rom?: number;
  targetRom?: number;
  romUnit?: "deg" | "pct";
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * One true, specific line about this exercise, or null. In priority order:
 * range reached, every counted rep had good form, a correction worked, every set done.
 */
export function sessionHighlight(f: SessionFacts): string | null {
  if (f.romUnit === "deg" && f.targetRom && f.rom !== undefined && f.rom >= f.targetRom) return "You reached the range your therapist set.";
  if (f.judged && (f.validReps ?? 0) > 0 && f.invalidReps === 0 && f.partialReps === 0) return f.goodOnly ? "Every attempt counted as a good rep." : "Every rep had good form.";
  if (f.judged && (f.correctionsSucceeded ?? 0) > 0) return `You fixed ${plural(f.correctionsSucceeded as number, "thing", "things")} as you went.`;
  if (f.targetSets > 0 && f.completedSets >= f.targetSets) return "You completed every set.";
  return null;
}

/** The plain numbers for an exercise-complete summary. Only counts that were actually recorded. */
export function sessionSummaryLines(f: SessionFacts): string[] {
  if (f.goodOnly) {
    const lines = [`${plural(f.completedSets, "set", "sets")} completed`, `${plural(f.completedReps, "good rep", "good reps")}`];
    const notCounted = (f.invalidReps ?? 0) + (f.partialReps ?? 0);
    // Said honestly but quietly: the patient and the therapist should see the same picture.
    if (notCounted > 0) lines.push(`${plural(notCounted, "attempt", "attempts")} did not count`);
    return lines;
  }
  const lines = [`${plural(f.completedSets, "set", "sets")} completed`, `${plural(f.completedReps, "rep", "reps")} counted`];
  if (f.judged && f.validReps !== undefined) lines.push(`${plural(f.validReps, "rep", "reps")} with good form`);
  return lines;
}

export interface DaySession {
  completedReps: number;
  judged: boolean;
  validReps?: number;
  invalidReps?: number;
}

export interface DaySummary {
  exercisesDone: number;
  exercisesDue: number;
  setsDone: number;
  setsDue: number;
  repsCounted: number;
  /** Valid reps across the exercises the engine judged; null when none was judged. */
  validReps: number | null;
  /** Share of judged reps that were valid, 0-100; null when none was judged. */
  goodFormShare: number | null;
  routineComplete: boolean;
}

export function summarizeDay(plan: { completedExercises: number; totalExercises: number; completedSets: number; totalSets: number }, sessions: DaySession[]): DaySummary {
  const judged = sessions.filter((s) => s.judged && s.validReps !== undefined && s.invalidReps !== undefined);
  const valid = judged.reduce((a, s) => a + (s.validReps ?? 0), 0);
  const counted = judged.reduce((a, s) => a + (s.validReps ?? 0) + (s.invalidReps ?? 0), 0);
  return {
    exercisesDone: plan.completedExercises,
    exercisesDue: plan.totalExercises,
    setsDone: plan.completedSets,
    setsDue: plan.totalSets,
    repsCounted: sessions.reduce((a, s) => a + s.completedReps, 0),
    validReps: judged.length ? valid : null,
    goodFormShare: counted > 0 ? Math.round((100 * valid) / counted) : null,
    routineComplete: plan.totalExercises > 0 && plan.completedExercises >= plan.totalExercises,
  };
}

/** The lines shown when the whole routine is done. */
export function routineLines(d: DaySummary): string[] {
  const lines = [`${plural(d.exercisesDone, "exercise", "exercises")} completed`, `${plural(d.setsDone, "set", "sets")} completed`];
  if (d.validReps !== null) lines.push(`${plural(d.validReps, "rep", "reps")} with good form`);
  return lines;
}

/**
 * Consistency as something earned, never as something lost: a count of days done this week, shown only
 * when it is at least one. A quiet week produces no sentence at all.
 */
export function weekConsistency(week: { state: "done" | "partial" | "missed" | "todo" }[] | undefined): string | null {
  const n = (week ?? []).filter((d) => d.state === "done").length;
  return n > 0 ? `You’ve done your exercises on ${plural(n, "day", "days")} this week.` : null;
}

/** What to say about the next session, from the plan's real schedule. Never guilt, never a streak. */
export function nextSessionLine(upcoming: { day: string; exercises: string[] }[] | undefined, formatDay: (day: string) => string): string | null {
  const next = upcoming?.[0];
  return next ? `Your next session is ${formatDay(next.day)}.` : null;
}

// ── A finished set ─────────────────────────────────────────────────────────────

export type MilestoneId = "routine_complete" | "exercise_complete" | "target_range" | "best_range" | "clean_set" | "fixed_it" | "halfway";

export interface Milestone {
  id: MilestoneId;
  /** Short, shown large. */
  title: string;
  /** One plain sentence, shown under the title and captioned when spoken. */
  detail: string;
  /** What the voice says. Every one has an entry in the spoken catalogue (`lib/i18n/spoken`), which a test checks. */
  spoken: string;
}

/** What is known about the set the person has just finished. Every field is a stored or measured fact. */
export interface SetFacts {
  /** The set just finished, 1-based. */
  setNumber: number;
  totalSets: number;
  /** That was the last set of this exercise. */
  exerciseComplete: boolean;
  /** ...and it finished every exercise due today. */
  routineComplete?: boolean;
  /** The movement engine judged these reps (camera mode). Hand-counted sets are never judged. */
  judged: boolean;
  /** Engine v4+: only good reps are counted and attempts that did not count are reported beside them. */
  goodOnly?: boolean;
  /** Good reps, and attempts that did not count, in THIS set (across any pauses within it). */
  good: number;
  invalid: number;
  partial: number;
  /** Best range reached in this set, in `romUnit`. */
  rom?: number;
  romUnit?: "deg" | "pct";
  targetRom?: number;
  /** The best range in earlier sessions measured by the same engine (already held to its own evidence bar), or null. */
  personalBest?: { rom: number; unit: "deg" | "pct" } | null;
  correctionsSucceeded?: number;
}

export interface SetCelebration {
  /** 1 = a set finished, 2 = an exercise or a verified milestone, 3 = today's routine. Sets how big the celebration is. */
  level: 1 | 2 | 3;
  headline: string;
  /** Verified achievements, most important first. Empty when nothing special is true: the set is still celebrated, quietly. */
  milestones: Milestone[];
}

/**
 * Which milestones this set earned. Each one appears only when the numbers in front of it make it true, and none is
 * ever a score or a rank. A set that earns nothing extra still gets its celebration, because finishing a set is
 * worth marking, but it is never dressed up as more than it was.
 */
export function evaluateSet(f: SetFacts): SetCelebration {
  const found: Milestone[] = [];
  const attempts = f.good + f.invalid + f.partial;

  if (f.routineComplete) found.push({ id: "routine_complete", title: "Today’s routine complete", detail: "You finished everything due today.", spoken: "Today's routine is complete" });
  if (f.exerciseComplete) found.push({ id: "exercise_complete", title: "Exercise complete", detail: `${plural(f.totalSets, "set", "sets")} done.`, spoken: "Exercise complete" });

  if (f.judged && f.good >= 1 && f.romUnit === "deg" && f.targetRom && f.rom !== undefined && f.rom >= f.targetRom) {
    found.push({ id: "target_range", title: "Target range reached", detail: "You reached the range your therapist set.", spoken: "You reached the range your therapist set" });
  }
  if (
    f.judged &&
    f.personalBest &&
    f.personalBest.unit === f.romUnit &&
    f.rom !== undefined &&
    attempts >= EVIDENCE.minJudgedReps &&
    f.rom >= f.personalBest.rom + EVIDENCE.minBestGain
  ) {
    found.push({ id: "best_range", title: "Best range so far", detail: "That’s your best range so far.", spoken: "That's your best range so far" });
  }
  if (f.judged && f.good >= 3 && f.invalid === 0 && f.partial === 0) {
    const detail = f.goodOnly ? "Every attempt counted as a good rep." : "Every rep had good form.";
    found.push({ id: "clean_set", title: "Clean set", detail, spoken: detail.replace(/\.$/, "").replace("’", "'") });
  }
  if (f.judged && (f.correctionsSucceeded ?? 0) > 0) {
    const n = f.correctionsSucceeded as number;
    const detail = `You fixed ${plural(n, "thing", "things")} as you went.`;
    found.push({ id: "fixed_it", title: "Nice corrections", detail, spoken: detail.replace(/\.$/, "") });
  }
  // Crossing the middle of the exercise's sets, exactly once. Never on the last set, which has its own milestone.
  if (!f.exerciseComplete && f.totalSets >= 3 && f.setNumber * 2 >= f.totalSets && (f.setNumber - 1) * 2 < f.totalSets) {
    found.push({ id: "halfway", title: "Halfway there", detail: "Halfway through this exercise.", spoken: "Halfway through this exercise" });
  }

  const level: SetCelebration["level"] = f.routineComplete ? 3 : f.exerciseComplete || found.length > 0 ? 2 : 1;
  const headline = f.routineComplete ? "Today’s routine complete" : f.exerciseComplete ? "Exercise complete" : `Set ${f.setNumber} complete`;
  return { level, headline, milestones: found };
}
