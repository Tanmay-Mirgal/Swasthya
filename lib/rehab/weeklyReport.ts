/**
 * lib/rehab/weeklyReport.ts
 *
 * Builds the weekly report from stored data only: the prescription schedule, the set
 * logs, and the measurements and feedback counts the on-device engine recorded. It
 * never states a diagnosis, a trend as a clinical finding, or anything not in the
 * database. A week covers the cycle start through the review day, inclusive.
 */
import Prescription, { type IPrescription } from "@/models/Prescription";
import ExerciseSession, { type IExerciseSession } from "@/models/ExerciseSession";
import WeeklyReview, { type IWeeklyReport, type IWeeklyReportExercise, type IWeeklyReview } from "@/models/WeeklyReview";
import { addDays, type DateKey } from "./dates";
import { adherenceBetween, adherencePercent, computeDailyPlan, type ExerciseDayLog } from "./schedule";
import { groupLogsByDay } from "./adherence";
import { toScheduleInput } from "./prescriptionService";
import { creditsGoodRepsOnly, formAccuracyOf } from "./chunkQuality";
import { getMovementTemplate } from "@/lib/movement/template/registry";

const avg = (nums: number[]): number | undefined => (nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : undefined);

export interface ReportInput {
  prescription: IPrescription;
  weekNumber: number;
  weekStart: DateKey;
  weekEnd: DateKey;
  sessions: IExerciseSession[];
  today: DateKey;
  previousFormScore?: number;
  previousFormBasis?: "engine2" | "engine4" | "legacy";
}

/** Pure: turns a plan, a date range and the stored sessions into a report. */
type Judgeable = { engineVersion?: number; validReps?: number };

/**
 * The sessions judged by the engine, on ONE basis. From engine v4 the form share counts every attempt, so if a week holds
 * both v4 and older sessions only the v4 ones are used; shares on different bases are never mixed.
 */
function judgedOf<T extends Judgeable>(list: T[]): { list: T[]; basis: "engine2" | "engine4" | "legacy" } {
  const judged = list.filter((s) => (s.engineVersion ?? 0) >= 2 && s.validReps !== undefined);
  const v4 = judged.filter((s) => creditsGoodRepsOnly(s.engineVersion));
  if (v4.length) return { list: v4, basis: "engine4" };
  return { list: judged, basis: judged.length ? "engine2" : "legacy" };
}

export function buildReport(input: ReportInput): IWeeklyReport {
  const { prescription, weekNumber, weekStart, weekEnd, sessions, today } = input;
  const schedule = toScheduleInput(prescription);
  const logsByDay = groupLogsByDay(sessions);
  const days = adherenceBetween(schedule, weekStart, weekEnd, logsByDay, today);

  const perExercise = new Map<string, IWeeklyReportExercise>();
  for (const ex of schedule.exercises) {
    perExercise.set(ex.key, {
      exerciseKey: ex.key,
      exerciseId: ex.exerciseId,
      name: ex.name,
      setsPrescribed: 0,
      setsCompleted: 0,
      repsPrescribed: 0,
      repsCompleted: 0,
      romUnit: getMovementTemplate(ex.exerciseId)?.rep.unit ?? "deg",
    });
  }

  let daysCompleted = 0;
  let totalSets = 0;
  let doneSets = 0;
  let totalReps = 0;
  let doneReps = 0;
  for (const d of days) {
    const plan = computeDailyPlan(schedule, d.day, (logsByDay[d.day] ?? []) as ExerciseDayLog[]);
    if (d.status === "complete") daysCompleted++;
    for (const e of plan.exercises) {
      const row = perExercise.get(e.key)!;
      row.setsPrescribed += e.targetSets;
      row.setsCompleted += e.completedSets;
      row.repsPrescribed += e.prescribedReps;
      row.repsCompleted += e.completedReps;
    }
    totalSets += plan.totalSets;
    doneSets += plan.completedSets;
    totalReps += plan.exercises.reduce((s, e) => s + e.prescribedReps, 0);
    doneReps += plan.exercises.reduce((s, e) => s + e.completedReps, 0);
  }

  const inWeek = sessions.filter((s) => s.dateKey && s.dateKey >= weekStart && s.dateKey <= weekEnd);
  for (const row of perExercise.values()) {
    const mine = inWeek.filter((s) => s.prescriptionExerciseKey === row.exerciseKey);
    row.averageRom = avg(mine.map((s) => s.rom ?? 0).filter((n) => n > 0));
    const { list: judged, basis } = judgedOf(mine);
    row.validReps = judged.length ? judged.reduce((a, s) => a + (s.validReps ?? 0), 0) : undefined;
    row.invalidReps = judged.length ? judged.reduce((a, s) => a + (s.invalidReps ?? 0), 0) : undefined;
    // Per-rep judgment when there is any this week; otherwise the older score. Never a mixture.
    row.averageFormScore = judged.length
      ? formAccuracyOf(row.validReps, row.invalidReps, basis === "engine4" ? judged.reduce((a, s) => a + (s.partialReps ?? 0), 0) : 0)
      : avg(mine.map((s) => s.formAccuracy).filter((n): n is number => typeof n === "number"));
  }

  const issueTotals: Record<string, number> = {};
  for (const s of inWeek) for (const [code, n] of Object.entries((s.issueCounts ?? {}) as Record<string, number>)) issueTotals[code] = (issueTotals[code] ?? 0) + n;

  const { list: judgedWeek, basis: formBasis } = judgedOf(inWeek);
  const weekValid = judgedWeek.reduce((a, s) => a + (s.validReps ?? 0), 0);
  const weekInvalid = judgedWeek.reduce((a, s) => a + (s.invalidReps ?? 0), 0);
  const weekPartial = judgedWeek.reduce((a, s) => a + (s.partialReps ?? 0), 0);
  const formScore =
    formBasis !== "legacy" ? formAccuracyOf(weekValid, weekInvalid, formBasis === "engine4" ? weekPartial : 0) : avg(inWeek.map((s) => s.formAccuracy).filter((n): n is number => typeof n === "number"));
  const confSessions = judgedWeek.filter((s) => s.avgConfidence !== undefined && s.completedReps > 0);
  const confReps = confSessions.reduce((a, s) => a + s.completedReps, 0);
  const sevRank = { minor: 0, moderate: 1, major: 2 } as const;
  const repeated = new Map<string, { reps: number; severity: "minor" | "moderate" | "major" }>();
  for (const s of judgedWeek) {
    for (const [code, n] of Object.entries((s.issueCounts ?? {}) as Record<string, number>)) {
      const sev = (((s.issueSeverity ?? {}) as Record<string, "minor" | "moderate" | "major">)[code] ?? "minor") as "minor" | "moderate" | "major";
      const cur = repeated.get(code);
      repeated.set(code, { reps: (cur?.reps ?? 0) + n, severity: cur && sevRank[cur.severity] > sevRank[sev] ? cur.severity : sev });
    }
  }
  const quality = judgedWeek.length
    ? {
        validReps: weekValid,
        invalidReps: weekInvalid,
        partialReps: judgedWeek.reduce((a, s) => a + (s.partialReps ?? 0), 0),
        correctionAttempts: judgedWeek.reduce((a, s) => a + (s.correctionAttempts ?? 0), 0),
        correctionsSucceeded: judgedWeek.reduce((a, s) => a + (s.correctionsSucceeded ?? 0), 0),
        avgConfidence: confReps ? Math.round((confSessions.reduce((a, s) => a + (s.avgConfidence as number) * s.completedReps, 0) / confReps) * 100) / 100 : undefined,
        repeatedErrors: [...repeated.entries()].map(([code, v]) => ({ code, ...v })).sort((a, b) => b.reps - a.reps).slice(0, 4),
      }
    : undefined;
  const exercises = [...perExercise.values()].filter((e) => e.setsPrescribed > 0);

  return {
    generatedAt: new Date(),
    weekNumber,
    weekStart,
    weekEnd,
    exercisesAssigned: schedule.exercises.length,
    exercisesCompleted: exercises.filter((e) => e.setsCompleted >= e.setsPrescribed).length,
    setsPrescribed: totalSets,
    setsCompleted: doneSets,
    repsPrescribed: totalReps,
    repsCompleted: doneReps,
    daysDue: days.length,
    daysCompleted,
    daysMissed: days.filter((d) => d.status === "missed").length,
    adherencePercent: adherencePercent(days),
    // A range in degrees and a range in percent cannot be averaged together: only degrees are pooled.
    averageRom: avg(inWeek.filter((s) => (getMovementTemplate(s.exerciseId)?.rep.unit ?? "deg") === "deg").map((s) => s.rom ?? 0).filter((n) => n > 0)),
    averageFormScore: formScore,
    formBasis,
    quality,
    // Only compared when both weeks were scored the same way.
    qualityChange:
      formScore !== undefined && input.previousFormScore !== undefined && (input.previousFormBasis ?? "legacy") === formBasis ? formScore - input.previousFormScore : null,
    commonFeedback: Object.entries(issueTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([code, count]) => ({ code, count })),
    discomfortReports: inWeek
      .filter((s) => s.discomfort === "mild" || s.discomfort === "moderate" || s.discomfort === "severe")
      .map((s) => ({ level: s.discomfort as "mild" | "moderate" | "severe", day: s.dateKey!, exerciseName: s.exerciseName })),
    exercises,
  };
}

/** Week N covers the cycle start through the review day. */
export function weekWindow(prescription: IPrescription, weekNumber: number, dueDate: DateKey): { weekStart: DateKey; weekEnd: DateKey } {
  const start = addDays(prescription.startDate, (weekNumber - 1) * 7);
  return { weekStart: start, weekEnd: dueDate };
}

/**
 * Generates (or regenerates, until the therapist has reviewed it) the report for a
 * weekly review and moves it to `report_ready`. Returns the updated review, or null
 * when the review day has not finished or the review is already reviewed.
 */
export async function generateWeeklyReport(reviewId: string, today: DateKey, opts: { force?: boolean } = {}): Promise<IWeeklyReview | null> {
  const review = await WeeklyReview.findById(reviewId);
  if (!review || review.status === "reviewed") return review && review.status === "reviewed" ? review : null;
  if (!opts.force && review.dueDate > today) return null;

  const prescription = await Prescription.findById(review.prescriptionId);
  if (!prescription) return null;

  const { weekStart, weekEnd } = weekWindow(prescription, review.weekNumber, review.dueDate);
  const [sessions, previous] = await Promise.all([
    ExerciseSession.find({ prescriptionId: review.prescriptionId, dateKey: { $gte: weekStart, $lte: weekEnd } }).lean<IExerciseSession[]>(),
    WeeklyReview.findOne({ prescriptionId: review.prescriptionId, weekNumber: review.weekNumber - 1 }).lean<IWeeklyReview>(),
  ]);

  review.report = buildReport({
    prescription,
    weekNumber: review.weekNumber,
    weekStart,
    weekEnd,
    sessions,
    today,
    previousFormScore: previous?.report?.averageFormScore,
    previousFormBasis: previous?.report?.formBasis,
  });
  review.status = "report_ready";
  review.markModified("report");
  await review.save();
  return review;
}
