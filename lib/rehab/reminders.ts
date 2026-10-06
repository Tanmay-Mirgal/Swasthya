/**
 * lib/rehab/reminders.ts
 *
 * The daily job, run by Vercel Cron (see vercel.json) against /api/cron/daily. It is
 * idempotent: every notice has a unique dedupe key, so running it twice, or at any
 * cadence, never sends anything twice. Per patient it decides, in the patient's own
 * timezone, whether today is a day to remind, whether it is a review day, and whether
 * a past review day needs its report.
 */
import "server-only";
import Prescription from "@/models/Prescription";
import PatientProfile from "@/models/PatientProfile";
import ExerciseSession, { type IExerciseSession } from "@/models/ExerciseSession";
import WeeklyReview from "@/models/WeeklyReview";
import User from "@/models/User";
import { DEFAULT_TIMEZONE, dateKeyInTimezone, hourInTimezone, isValidTimezone } from "./dates";
import { computeDailyPlan, reviewWeekOn } from "./schedule";
import { groupLogsByDay } from "./adherence";
import { syncWeeklyReviews, toScheduleInput } from "./prescriptionService";
import { generateWeeklyReport } from "./weeklyReport";
import { deliver } from "./notifier";
import { dailyReminderEmail, weeklyReviewDueEmail, weeklyReviewReadyEmail } from "@/lib/email/templates";
import { getPrescribableExercise } from "./exerciseCatalog";

export interface ReminderRunSummary {
  plansChecked: number;
  plansClosed: number;
  dailyReminders: { sent: number; skipped: number; duplicate: number; failed: number; notDueYet: number };
  weeklyDue: number;
  reportsGenerated: number;
  therapistNotices: number;
}

const DEFAULT_REMINDER_HOUR = 9;

/**
 * With an hourly cron (REMINDER_SCHEDULE=hourly, needs a Vercel plan that allows it) each patient is
 * reminded at their own reminder hour. With the default daily cron there is only one run per day,
 * so the hour cannot be honoured and the reminder goes out on that run.
 */
const respectsLocalHour = () => process.env.REMINDER_SCHEDULE === "hourly";
const hourReached = (now: Date, tz: string, hour: number) => !respectsLocalHour() || hourInTimezone(now, tz) >= hour;

export async function runDailyJob(now: Date = new Date()): Promise<ReminderRunSummary> {
  const summary: ReminderRunSummary = {
    plansChecked: 0,
    plansClosed: 0,
    dailyReminders: { sent: 0, skipped: 0, duplicate: 0, failed: 0, notDueYet: 0 },
    weeklyDue: 0,
    reportsGenerated: 0,
    therapistNotices: 0,
  };

  const plans = await Prescription.find({ status: { $in: ["active", "paused"] } });
  summary.plansChecked = plans.length;
  if (plans.length === 0) return summary;

  const patientIds = [...new Set(plans.map((p) => p.patientId))];
  const [profiles, users] = await Promise.all([
    PatientProfile.find({ clerkUserId: { $in: patientIds } }, { clerkUserId: 1, timezone: 1, notifications: 1 }).lean<
      { clerkUserId: string; timezone?: string; notifications?: { reminderHour?: number } }[]
    >(),
    User.find({ clerkUserId: { $in: patientIds } }, { clerkUserId: 1, firstName: 1, lastName: 1 }).lean<{ clerkUserId: string; firstName?: string; lastName?: string }[]>(),
  ]);
  const profileOf = new Map(profiles.map((p) => [p.clerkUserId, p]));
  const nameOf = new Map(users.map((u) => [u.clerkUserId, u.firstName ? `${u.firstName} ${u.lastName ?? ""}`.trim() : undefined]));
  const tzOf = (id: string) => (isValidTimezone(profileOf.get(id)?.timezone) ? profileOf.get(id)!.timezone! : DEFAULT_TIMEZONE);

  // 1. Close plans whose end date has passed in the patient's timezone.
  const live = [];
  for (const plan of plans) {
    const today = dateKeyInTimezone(now, tzOf(plan.patientId));
    if (plan.endDate < today) {
      plan.status = "completed";
      plan.closedReason = "duration_elapsed";
      plan.statusHistory.push({ status: "completed", at: now, note: "Plan duration ended" });
      await plan.save();
      summary.plansClosed++;
    } else {
      live.push(plan);
    }
  }

  // 2. Today's logs for every live plan in one query.
  const todayKeys = new Set(live.map((p) => dateKeyInTimezone(now, tzOf(p.patientId))));
  const sessions = await ExerciseSession.find({
    prescriptionId: { $in: live.map((p) => p._id.toString()) },
    dateKey: { $in: [...todayKeys] },
  }).lean<IExerciseSession[]>();
  const sessionsOf = new Map<string, IExerciseSession[]>();
  for (const s of sessions) (sessionsOf.get(s.prescriptionId!) ?? sessionsOf.set(s.prescriptionId!, []).get(s.prescriptionId!)!).push(s);

  for (const plan of live) {
    const tz = tzOf(plan.patientId);
    const today = dateKeyInTimezone(now, tz);
    const schedule = toScheduleInput(plan);
    const reminderHour = profileOf.get(plan.patientId)?.notifications?.reminderHour ?? DEFAULT_REMINDER_HOUR;

    if (plan.status === "active" && today >= plan.startDate) {
      await syncWeeklyReviews(plan); // heals rows if a plan predates the reviews feature
      const daily = computeDailyPlan(schedule, today, groupLogsByDay(sessionsOf.get(plan._id.toString()) ?? [])[today] ?? []);
      const remainingExercises = daily.totalExercises - daily.completedExercises;

      // Daily reminder: only on days with work left, once, and not before the patient's reminder hour.
      if (remainingExercises > 0) {
        if (!hourReached(now, tz, reminderHour)) {
          summary.dailyReminders.notDueYet++;
        } else {
          const email = dailyReminderEmail({
            patientName: nameOf.get(plan.patientId),
            remainingExercises,
            totalExercises: daily.totalExercises,
            remainingSets: daily.totalSets - daily.completedSets,
            dayNumber: daily.dayNumber,
            totalDays: daily.totalDays,
          });
          const r = await deliver({
            userId: plan.patientId,
            type: "daily_reminder",
            dedupeKey: `daily:${plan._id.toString()}:${today}`,
            title: "Your rehabilitation plan for today is ready",
            body: `You have ${remainingExercises} ${remainingExercises === 1 ? "exercise" : "exercises"} remaining.`,
            href: "/",
            email,
          });
          summary.dailyReminders[r.status]++;
        }
      }

      // Review day: tell the patient (recording requirement included) once per week.
      const week = reviewWeekOn(schedule, today);
      if (week !== null && hourReached(now, tz, reminderHour)) {
        await WeeklyReview.findOneAndUpdate(
          { prescriptionId: plan._id.toString(), weekNumber: week, status: "upcoming" },
          { $set: { status: plan.weeklyReview.requireRecording ? "recording_due" : "upcoming" } },
        );
        const target = plan.weeklyReview.recordingExerciseKey ? plan.exercises.find((e) => e._id!.toString() === plan.weeklyReview.recordingExerciseKey) : plan.exercises[0];
        const email = weeklyReviewDueEmail({
          patientName: nameOf.get(plan.patientId),
          week,
          recordingRequired: plan.weeklyReview.requireRecording,
          exerciseName: target?.name ?? (target ? getPrescribableExercise(target.exerciseId)?.name : undefined),
        });
        const r = await deliver({
          userId: plan.patientId,
          type: "weekly_review_due",
          dedupeKey: `weekly_due:${plan._id.toString()}:${week}`,
          title: `Week ${week} review day`,
          body: plan.weeklyReview.requireRecording ? "A short recording of one exercise is needed today." : "Your therapist will review your week.",
          href: "/",
          email,
        });
        if (r.status !== "duplicate") summary.weeklyDue++;
      }
    }

    // 3. Reports for review days that have ended (the cron runs the morning after).
    const due = await WeeklyReview.find({
      prescriptionId: plan._id.toString(),
      status: { $in: ["upcoming", "recording_due"] },
      dueDate: { $lt: today },
    });
    for (const review of due) {
      const done = await generateWeeklyReport(review._id.toString(), today);
      if (done?.report) {
        summary.reportsGenerated++;
        const patientName = nameOf.get(plan.patientId) ?? "Your patient";
        const r = await deliver({
          userId: plan.doctorId,
          type: "weekly_review_ready",
          dedupeKey: `weekly_ready:${review._id.toString()}`,
          title: `${patientName}: week ${done.weekNumber} report ready`,
          body: done.report.adherencePercent === null ? "No sets were due this week." : `${done.report.adherencePercent}% adherence.`,
          href: `/therapist/reviews/${done._id.toString()}`,
          email: weeklyReviewReadyEmail({
            patientName,
            week: done.weekNumber,
            adherencePercent: done.report.adherencePercent,
            recordingAttached: Boolean(done.recordingId),
            reviewHref: `/therapist/reviews/${done._id.toString()}`,
          }),
        });
        if (r.status !== "duplicate") summary.therapistNotices++;
      }
    }
  }
  return summary;
}
