/**
 * lib/rehab/schedule.ts
 *
 * Deterministic schedule maths. Given a prescription and the stored set logs, this
 * answers "what is due today, what is done, what is missed, is it a review day".
 * Nothing here is stored: the daily plan is always derived from the active
 * prescription plus the real session records, so there is no second copy to drift.
 */

import { addDays, diffDays, weekdayOf, type DateKey } from "./dates";

export type Frequency = "daily" | "alternate" | "weekdays";

export interface ScheduleExercise {
  key: string; // prescription exercise subdocument id
  exerciseId: string;
  name: string;
  sets: number;
  reps: number;
}

export interface WeeklyReviewConfig {
  enabled: boolean;
  /** 1-7: the nth day of each seven-day cycle counted from the prescription start. */
  cycleDay: number;
  requireRecording: boolean;
  /** Prescription exercise key to record; defaults to the first exercise. */
  recordingExerciseKey?: string;
}

export interface ScheduleInput {
  startDate: DateKey;
  endDate: DateKey;
  frequency: Frequency;
  exercises: ScheduleExercise[];
  weeklyReview?: WeeklyReviewConfig;
}

export type SetStatus = "not_started" | "in_progress" | "complete";

export interface SetLog {
  index: number; // 0-based
  completedReps: number;
}

/** What has been recorded for one exercise on one day. */
export interface ExerciseDayLog {
  exerciseKey: string;
  sets: SetLog[];
}

export function dayNumber(input: Pick<ScheduleInput, "startDate">, day: DateKey): number {
  return diffDays(input.startDate, day) + 1;
}

export function weekNumber(input: Pick<ScheduleInput, "startDate">, day: DateKey): number {
  const n = dayNumber(input, day);
  return n < 1 ? 0 : Math.ceil(n / 7);
}

export function isWithinPlan(input: Pick<ScheduleInput, "startDate" | "endDate">, day: DateKey): boolean {
  return day >= input.startDate && day <= input.endDate;
}

export function totalPlanDays(input: Pick<ScheduleInput, "startDate" | "endDate">): number {
  return diffDays(input.startDate, input.endDate) + 1;
}

export function endDateFor(startDate: DateKey, durationDays: number): DateKey {
  return addDays(startDate, Math.max(1, durationDays) - 1);
}

/** Is this a regular training day under the prescription's frequency? */
export function isTrainingDay(input: Pick<ScheduleInput, "startDate" | "endDate" | "frequency">, day: DateKey): boolean {
  if (!isWithinPlan(input, day)) return false;
  switch (input.frequency) {
    case "daily":
      return true;
    case "alternate":
      return (dayNumber(input, day) - 1) % 2 === 0;
    case "weekdays": {
      const w = weekdayOf(day);
      return w >= 1 && w <= 5;
    }
    default:
      return true;
  }
}

/** The weekly-review day for `day`, if any. Returns the week number it closes. */
export function reviewWeekOn(input: ScheduleInput, day: DateKey): number | null {
  const cfg = input.weeklyReview;
  if (!cfg?.enabled || !isWithinPlan(input, day)) return null;
  const n = dayNumber(input, day);
  return ((n - 1) % 7) + 1 === cfg.cycleDay ? Math.ceil(n / 7) : null;
}

/** All review days across the plan, in order. */
export function reviewDays(input: ScheduleInput): { week: number; day: DateKey }[] {
  if (!input.weeklyReview?.enabled) return [];
  const out: { week: number; day: DateKey }[] = [];
  const total = totalPlanDays(input);
  for (let n = input.weeklyReview.cycleDay; n <= total; n += 7) {
    out.push({ week: Math.ceil(n / 7), day: addDays(input.startDate, n - 1) });
  }
  return out;
}

export function recordingExerciseKey(input: ScheduleInput): string | undefined {
  const cfg = input.weeklyReview;
  if (!cfg?.enabled || !cfg.requireRecording) return undefined;
  if (cfg.recordingExerciseKey && input.exercises.some((e) => e.key === cfg.recordingExerciseKey)) {
    return cfg.recordingExerciseKey;
  }
  return input.exercises[0]?.key;
}

/** Exercises the patient should do on `day`. On a review day the recorded exercise is always included. */
export function exercisesDueOn(input: ScheduleInput, day: DateKey): ScheduleExercise[] {
  if (!isWithinPlan(input, day)) return [];
  if (isTrainingDay(input, day)) return input.exercises;
  const recordKey = reviewWeekOn(input, day) !== null ? recordingExerciseKey(input) : undefined;
  return recordKey ? input.exercises.filter((e) => e.key === recordKey) : [];
}

// ── Set / rep progress ──────────────────────────────────────────────────────

export interface SetProgress {
  index: number;
  targetReps: number;
  completedReps: number;
  remainingReps: number;
  status: SetStatus;
}

export interface ExerciseProgress {
  key: string;
  exerciseId: string;
  name: string;
  targetSets: number;
  targetReps: number;
  sets: SetProgress[];
  completedSets: number;
  completedReps: number;
  prescribedReps: number;
  /** The set the patient should work on next (first incomplete). */
  currentSetIndex: number | null;
  status: SetStatus;
}

export function computeExerciseProgress(ex: ScheduleExercise, log?: ExerciseDayLog): ExerciseProgress {
  const sets: SetProgress[] = [];
  for (let i = 0; i < ex.sets; i++) {
    // Reps beyond the prescribed target never count (rep chunking cannot over-credit a set).
    const done = Math.min(ex.reps, Math.max(0, log?.sets.find((s) => s.index === i)?.completedReps ?? 0));
    sets.push({
      index: i,
      targetReps: ex.reps,
      completedReps: done,
      remainingReps: ex.reps - done,
      status: done >= ex.reps ? "complete" : done > 0 ? "in_progress" : "not_started",
    });
  }
  const completedSets = sets.filter((s) => s.status === "complete").length;
  const completedReps = sets.reduce((sum, s) => sum + s.completedReps, 0);
  const current = sets.find((s) => s.status !== "complete");
  return {
    key: ex.key,
    exerciseId: ex.exerciseId,
    name: ex.name,
    targetSets: ex.sets,
    targetReps: ex.reps,
    sets,
    completedSets,
    completedReps,
    prescribedReps: ex.sets * ex.reps,
    currentSetIndex: current ? current.index : null,
    status: completedSets === ex.sets ? "complete" : completedReps > 0 ? "in_progress" : "not_started",
  };
}

export interface DailyPlan {
  day: DateKey;
  dayNumber: number;
  weekNumber: number;
  totalDays: number;
  isTrainingDay: boolean;
  reviewWeek: number | null;
  recordingExerciseKey?: string;
  exercises: ExerciseProgress[];
  completedExercises: number;
  totalExercises: number;
  completedSets: number;
  totalSets: number;
  /** 0-100, by sets (the unit of work the patient controls). */
  completionPercent: number;
}

export function computeDailyPlan(input: ScheduleInput, day: DateKey, logs: ExerciseDayLog[]): DailyPlan {
  const due = exercisesDueOn(input, day);
  const exercises = due.map((ex) => computeExerciseProgress(ex, logs.find((l) => l.exerciseKey === ex.key)));
  const totalSets = exercises.reduce((s, e) => s + e.targetSets, 0);
  const completedSets = exercises.reduce((s, e) => s + e.completedSets, 0);
  const reviewWeek = reviewWeekOn(input, day);
  return {
    day,
    dayNumber: dayNumber(input, day),
    weekNumber: weekNumber(input, day),
    totalDays: totalPlanDays(input),
    isTrainingDay: isTrainingDay(input, day),
    reviewWeek,
    recordingExerciseKey: reviewWeek !== null ? recordingExerciseKey(input) : undefined,
    exercises,
    completedExercises: exercises.filter((e) => e.status === "complete").length,
    totalExercises: exercises.length,
    completedSets,
    totalSets,
    completionPercent: totalSets === 0 ? 0 : Math.round((completedSets / totalSets) * 100),
  };
}

// ── Missed days & adherence ─────────────────────────────────────────────────

export interface DayAdherence {
  day: DateKey;
  totalSets: number;
  completedSets: number;
  /** `pending` is today with nothing logged yet: still in progress, never "missed". */
  status: "complete" | "partial" | "missed" | "pending";
}

/**
 * Per-day adherence between `from` and `to` (inclusive, clamped to the plan).
 * `logsByDay` maps a day key to the stored exercise logs for that day.
 * Today is never "missed" (it is still in progress) and future days are omitted.
 */
export function adherenceBetween(
  input: ScheduleInput,
  from: DateKey,
  to: DateKey,
  logsByDay: Record<DateKey, ExerciseDayLog[]>,
  today: DateKey
): DayAdherence[] {
  const start = from < input.startDate ? input.startDate : from;
  const lastDay = to > today ? today : to; // future days are not reported
  const end = lastDay > input.endDate ? input.endDate : lastDay;
  const out: DayAdherence[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const plan = computeDailyPlan(input, d, logsByDay[d] ?? []);
    if (plan.totalExercises === 0) continue; // rest day
    const status: DayAdherence["status"] =
      plan.completedSets >= plan.totalSets
        ? "complete"
        : plan.completedSets > 0
          ? "partial"
          : d === today ? "pending" : "missed";
    out.push({ day: d, totalSets: plan.totalSets, completedSets: plan.completedSets, status });
  }
  return out;
}

export function adherencePercent(days: DayAdherence[]): number | null {
  const total = days.reduce((s, d) => s + d.totalSets, 0);
  if (total === 0) return null;
  return Math.round((days.reduce((s, d) => s + d.completedSets, 0) / total) * 100);
}
