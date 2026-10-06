/**
 * lib/rehab/adherence.ts
 *
 * Batched adherence for many prescriptions at once (one query for plans' sessions,
 * no per-patient round trips). Everything is derived from the prescription schedule
 * and the stored sets; nothing here is cached or invented.
 */
import ExerciseSession, { type IExerciseSession } from "@/models/ExerciseSession";
import PatientProfile from "@/models/PatientProfile";
import type { IPrescription } from "@/models/Prescription";
import { DEFAULT_TIMEZONE, addDays, dateKeyInTimezone, isValidTimezone, type DateKey } from "./dates";
import { adherenceBetween, adherencePercent, dayNumber, totalPlanDays, type DayAdherence, type ExerciseDayLog } from "./schedule";
import { toScheduleInput } from "./prescriptionService";

export interface PlanAdherence {
  prescriptionId: string;
  patientId: string;
  timezone: string;
  today: DateKey;
  dayNumber: number;
  totalDays: number;
  /** Sets completed / sets due over the last 7 days (including today). Null when nothing was due. */
  adherence7d: number | null;
  /** Past days in the last 7 with nothing logged. */
  missedDays7d: number;
  completedToday: boolean;
  lastActiveDay: DateKey | null;
  days: DayAdherence[];
}

export function groupLogsByDay(sessions: Pick<IExerciseSession, "dateKey" | "prescriptionExerciseKey" | "sets">[]): Record<DateKey, ExerciseDayLog[]> {
  const out: Record<DateKey, ExerciseDayLog[]> = {};
  for (const s of sessions) {
    if (!s.dateKey || !s.prescriptionExerciseKey) continue;
    (out[s.dateKey] ??= []).push({
      exerciseKey: s.prescriptionExerciseKey,
      sets: (s.sets ?? []).map((x) => ({ index: x.index, completedReps: x.completedReps })),
    });
  }
  return out;
}

export async function adherenceForPlans(plans: IPrescription[], windowDays = 7): Promise<Map<string, PlanAdherence>> {
  const result = new Map<string, PlanAdherence>();
  if (plans.length === 0) return result;

  const patientIds = [...new Set(plans.map((p) => p.patientId))];
  const profiles = await PatientProfile.find({ clerkUserId: { $in: patientIds } }, { clerkUserId: 1, timezone: 1 }).lean<{ clerkUserId: string; timezone?: string }[]>();
  const tzOf = new Map(profiles.map((p) => [p.clerkUserId, isValidTimezone(p.timezone) ? p.timezone : DEFAULT_TIMEZONE]));

  const now = new Date();
  const oldest = dateKeyInTimezone(new Date(now.getTime() - (windowDays + 2) * 86_400_000), "Pacific/Kiritimati"); // earliest possible local day
  const sessions = await ExerciseSession.find(
    { prescriptionId: { $in: plans.map((p) => p._id.toString()) }, dateKey: { $gte: oldest } },
    { prescriptionId: 1, dateKey: 1, prescriptionExerciseKey: 1, sets: 1 }
  ).lean<IExerciseSession[]>();
  const byPlan = new Map<string, IExerciseSession[]>();
  for (const s of sessions) (byPlan.get(s.prescriptionId!) ?? byPlan.set(s.prescriptionId!, []).get(s.prescriptionId!)!).push(s);

  for (const plan of plans) {
    const tz = tzOf.get(plan.patientId) ?? DEFAULT_TIMEZONE;
    const today = dateKeyInTimezone(now, tz);
    const schedule = toScheduleInput(plan);
    const logs = groupLogsByDay(byPlan.get(plan._id.toString()) ?? []);
    const days = adherenceBetween(schedule, addDays(today, -(windowDays - 1)), today, logs, today);
    const logged = Object.keys(logs).sort();
    const todayEntry = days.find((d) => d.day === today);
    result.set(plan._id.toString(), {
      prescriptionId: plan._id.toString(),
      patientId: plan.patientId,
      timezone: tz,
      today,
      dayNumber: dayNumber(schedule, today),
      totalDays: totalPlanDays(schedule),
      adherence7d: adherencePercent(days),
      missedDays7d: days.filter((d) => d.status === "missed").length,
      completedToday: todayEntry?.status === "complete",
      lastActiveDay: logged.length ? logged[logged.length - 1] : null,
      days,
    });
  }
  return result;
}
