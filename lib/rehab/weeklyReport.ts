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

const avg = (nums: number[]): number | undefined => (nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : undefined);

export interface ReportInput {
  prescription: IPrescription;
  weekNumber: number;
  weekStart: DateKey;
  weekEnd: DateKey;
  sessions: IExerciseSession[];
  today: DateKey;
  previousFormScore?: number;
}

/** Pure: turns a plan, a date range and the stored sessions into a report. */
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
    row.averageFormScore = avg(mine.map((s) => s.formAccuracy).filter((n): n is number => typeof n === "number"));
  }

  const issueTotals: Record<string, number> = {};
  for (const s of inWeek) for (const [code, n] of Object.entries((s.issueCounts ?? {}) as Record<string, number>)) issueTotals[code] = (issueTotals[code] ?? 0) + n;

  const formScore = avg(inWeek.map((s) => s.formAccuracy).filter((n): n is number => typeof n === "number"));
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
    averageRom: avg(inWeek.map((s) => s.rom ?? 0).filter((n) => n > 0)),
    averageFormScore: formScore,
    qualityChange: formScore !== undefined && input.previousFormScore !== undefined ? formScore - input.previousFormScore : null,
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
  });
  review.status = "report_ready";
  review.markModified("report");
  await review.save();
  return review;
}
