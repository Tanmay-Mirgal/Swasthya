/**
 * lib/rehab/sessionService.ts
 *
 * Reads the patient's daily plan (derived, never stored) and records set progress.
 *
 * A prescribed exercise has ONE ExerciseSession per day that fills in set by set.
 * Each submitted chunk is applied with optimistic concurrency on a single document,
 * so two tabs (or a retried request) cannot double-count reps or lose a write, and
 * the set, the day's totals and the exercise's completion always change together.
 */

import mongoose from "mongoose";
import Prescription, { type IPrescription } from "@/models/Prescription";
import ExerciseSession, { type IExerciseSession } from "@/models/ExerciseSession";
import WeeklyReview from "@/models/WeeklyReview";
import { addDays, dateKeyInTimezone, weekdayOf, type DateKey } from "./dates";
import { applyChunk, totalRepsOf, type SetRecord } from "./chunking";
import { cleanQuality, formAccuracyOf, rollupQuality, type ChunkQuality } from "./chunkQuality";
import {
  adherenceBetween,
  computeDailyPlan,
  computeExerciseProgress,
  exercisesDueOn,
  type DailyPlan,
  type ExerciseDayLog,
  type ExerciseProgress,
} from "./schedule";
import { completeElapsedPrescriptions, getLivePrescription, toScheduleInput } from "./prescriptionService";
import { HttpError, patientTimezone } from "./auth";

export interface PlanSnapshot {
  state: "none" | "paused" | "active";
  timezone: string;
  today: DateKey;
  prescription?: {
    id: string;
    version: number;
    status: string;
    doctorId: string;
    doctorName?: string;
    startDate: string;
    endDate: string;
    durationDays: number;
    frequency: string;
    instructions?: string;
    doctorNotes?: string;
    medicineCount: number;
    weeklyReview: IPrescription["weeklyReview"];
    exercises: {
      key: string;
      exerciseId: string;
      name: string;
      sets: number;
      reps: number;
      holdSeconds?: number;
      targetRom?: number;
      tempoSeconds?: number;
      modifications?: string;
      instructions?: string;
    }[];
    updatedAt: Date;
  };
  daily?: DailyPlan;
  /** Monday-first week containing today: what really happened on each day. */
  week?: { day: DateKey; label: string; state: "done" | "partial" | "missed" | "todo"; isToday: boolean }[];
  /** The next days (after today) with exercises due, for the "coming up" list. */
  upcoming?: { day: DateKey; exercises: string[] }[];
  /** Set when today is a weekly review day. */
  review?: {
    id: string;
    week: number;
    status: string;
    recordingRequired: boolean;
    recordingExerciseKey?: string;
    recordingDone: boolean;
  } | null;
}

function logsOf(sessions: Pick<IExerciseSession, "prescriptionExerciseKey" | "sets">[]): ExerciseDayLog[] {
  return sessions
    .filter((s) => s.prescriptionExerciseKey)
    .map((s) => ({
      exerciseKey: s.prescriptionExerciseKey!,
      sets: (s.sets ?? []).map((x) => ({ index: x.index, completedReps: x.completedReps })),
    }));
}

export function serializePrescription(p: IPrescription): NonNullable<PlanSnapshot["prescription"]> {
  return {
    id: p._id.toString(),
    version: p.version,
    status: p.status,
    doctorId: p.doctorId,
    doctorName: p.doctorName,
    startDate: p.startDate,
    endDate: p.endDate,
    durationDays: p.durationDays,
    frequency: p.frequency,
    instructions: p.instructions,
    doctorNotes: p.doctorNotes,
    medicineCount: p.medicines?.length ?? 0,
    weeklyReview: p.weeklyReview,
    exercises: p.exercises.map((e) => ({
      key: e._id!.toString(),
      exerciseId: e.exerciseId,
      name: e.name,
      sets: e.sets,
      reps: e.reps,
      holdSeconds: e.holdSeconds,
      targetRom: e.targetRom,
      tempoSeconds: e.tempoSeconds,
      modifications: e.modifications,
      instructions: e.instructions,
    })),
    updatedAt: p.updatedAt,
  };
}

/** The patient's plan for today, built from the live prescription and stored sessions. */
export async function getPlanSnapshot(patientId: string, timezone?: string): Promise<PlanSnapshot> {
  const tz = timezone ?? (await patientTimezone(patientId));
  const today = dateKeyInTimezone(new Date(), tz);

  await completeElapsedPrescriptions(today, patientId);
  const live = await getLivePrescription(patientId);
  if (!live) return { state: "none", timezone: tz, today };

  const schedule = toScheduleInput(live);
  const sessions = await ExerciseSession.find({ patientId, prescriptionId: live._id.toString(), dateKey: today }).lean<IExerciseSession[]>();
  const daily = computeDailyPlan(schedule, today, logsOf(sessions));

  // Monday-first week around today, ticked only from stored sets.
  const mondayOffset = (weekdayOf(today) + 6) % 7;
  const monday = addDays(today, -mondayOffset);
  const weekLogs = await ExerciseSession.find(
    { patientId, prescriptionId: live._id.toString(), dateKey: { $gte: monday, $lte: today } },
    { dateKey: 1, prescriptionExerciseKey: 1, sets: 1 }
  ).lean<IExerciseSession[]>();
  const logsByDay: Record<string, ExerciseDayLog[]> = {};
  for (const l of weekLogs) (logsByDay[l.dateKey!] ??= []).push({ exerciseKey: l.prescriptionExerciseKey!, sets: (l.sets ?? []).map((x) => ({ index: x.index, completedReps: x.completedReps })) });
  const adherence = adherenceBetween(schedule, monday, today, logsByDay, today);
  const labels = ["M", "T", "W", "T", "F", "S", "S"];
  const week = labels.map((label, i) => {
    const day = addDays(monday, i);
    const found = adherence.find((a) => a.day === day);
    const state: "done" | "partial" | "missed" | "todo" =
      found?.status === "complete" ? "done" : found?.status === "partial" ? "partial" : found?.status === "missed" ? "missed" : "todo";
    return { day, label, state, isToday: day === today };
  });

  const upcoming: { day: DateKey; exercises: string[] }[] = [];
  for (let n = 1; n <= 14 && upcoming.length < 2; n++) {
    const day = addDays(today, n);
    if (day > live.endDate) break;
    const due = exercisesDueOn(schedule, day);
    if (due.length) upcoming.push({ day, exercises: due.map((e) => e.name) });
  }

  const reviewRow =
    daily.reviewWeek !== null
      ? await WeeklyReview.findOne({ prescriptionId: live._id.toString(), weekNumber: daily.reviewWeek }).lean()
      : null;

  return {
    state: live.status === "paused" ? "paused" : "active",
    timezone: tz,
    today,
    week,
    upcoming,
    review: reviewRow
      ? {
          id: reviewRow._id.toString(),
          week: reviewRow.weekNumber,
          status: reviewRow.status,
          recordingRequired: reviewRow.recordingRequired,
          recordingExerciseKey: reviewRow.recordingExerciseKey,
          recordingDone: Boolean(reviewRow.recordingId),
        }
      : null,
    prescription: serializePrescription(live),
    daily: live.status === "paused" ? { ...daily, exercises: [], totalExercises: 0, totalSets: 0, completedSets: 0, completionPercent: 0 } : daily,
  };
}

export interface RecordChunkInput extends ChunkQuality {
  prescriptionId: string;
  exerciseKey: string;
  setIndex: number;
  chunkId: string;
  reps: number;
  startedAt?: string;
  endedAt?: string;
  rom?: number;
  formScore?: number;
  /** Movement-feedback codes raised during this chunk, with counts. */
  issues?: Record<string, number>;
  /** Optional self-report, usually sent with the last chunk of an exercise. */
  discomfort?: "none" | "mild" | "moderate" | "severe";
}

export interface RecordChunkResult {
  duplicate: boolean;
  credited: number;
  setComplete: boolean;
  exercise: ExerciseProgress;
  exerciseComplete: boolean;
  dayComplete: boolean;
  sessionId: string;
}

const MAX_ATTEMPTS = 5;

/** Keeps a small, safe map of issue code → count (codes are upper-snake identifiers from the engine). */
function cleanIssues(raw: unknown): Record<string, number> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<string, number> = {};
  for (const [code, n] of Object.entries(raw as Record<string, unknown>).slice(0, 12)) {
    const count = Math.round(Number(n));
    if (/^[A-Z_]{3,40}$/.test(code) && Number.isFinite(count) && count > 0) out[code] = Math.min(count, 10_000);
  }
  return Object.keys(out).length ? out : undefined;
}

function parseDate(v?: string): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function recordChunk(patientId: string, input: RecordChunkInput): Promise<RecordChunkResult> {
  if (!mongoose.isValidObjectId(input.prescriptionId)) throw new HttpError(400, "That prescription id is not valid.");
  const prescription = await Prescription.findById(input.prescriptionId);
  // Authorization is the patient id on the stored plan, never a client claim.
  if (!prescription || prescription.patientId !== patientId) throw new HttpError(404, "Plan not found.");
  if (prescription.status !== "active") {
    throw new HttpError(409, prescription.status === "paused" ? "Your therapist has paused this plan." : "This plan is no longer active.");
  }

  const tz = await patientTimezone(patientId);
  const today = dateKeyInTimezone(new Date(), tz);
  const schedule = toScheduleInput(prescription);
  const exercise = exercisesDueOn(schedule, today).find((e) => e.key === input.exerciseKey);
  if (!exercise) throw new HttpError(409, "That exercise is not part of today's plan.");

  const chunk = {
    chunkId: String(input.chunkId ?? ""),
    reps: Number(input.reps),
    startedAt: parseDate(input.startedAt),
    endedAt: parseDate(input.endedAt),
    rom: Number.isFinite(Number(input.rom)) && Number(input.rom) > 0 ? Math.min(360, Number(input.rom)) : undefined,
    formScore: Number.isFinite(Number(input.formScore)) ? Math.max(0, Math.min(100, Math.round(Number(input.formScore)))) : undefined,
    issues: cleanIssues(input.issues),
    ...cleanQuality(input, Number(input.reps)),
  };
  const discomfort = ["none", "mild", "moderate", "severe"].includes(input.discomfort ?? "") ? input.discomfort : undefined;

  const key = {
    patientId,
    prescriptionId: prescription._id.toString(),
    prescriptionExerciseKey: exercise.key,
    dateKey: today,
  };
  const prescribed = prescription.exercises.find((e) => e._id!.toString() === exercise.key)!;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let doc = await ExerciseSession.findOne(key).lean<IExerciseSession | null>();
    if (!doc) {
      try {
        const created = await ExerciseSession.create({
          ...key,
          exerciseId: exercise.exerciseId,
          exerciseName: exercise.name,
          targetReps: exercise.sets * exercise.reps,
          targetRom: prescribed.targetRom,
          formAccuracy: undefined,
          sets: [],
          rev: 0,
          date: new Date(),
        });
        doc = created.toObject() as IExerciseSession;
      } catch (err) {
        if ((err as { code?: number }).code === 11000) continue; // someone else created it first
        throw err;
      }
    }

    const current: SetRecord[] = (doc.sets ?? []).map((s) => ({ ...s, chunks: [...s.chunks] }));
    const result = applyChunk({ sets: current, targetSets: exercise.sets, targetReps: exercise.reps, setIndex: input.setIndex, chunk });
    if (!result.ok) throw new HttpError(409, result.error);

    const log: ExerciseDayLog = { exerciseKey: exercise.key, sets: result.sets.map((s) => ({ index: s.index, completedReps: s.completedReps })) };
    const progress = computeExerciseProgress(exercise, log);

    if (!result.duplicate) {
      const allChunks = result.sets.flatMap((s) => s.chunks);
      const roms = allChunks.map((c) => c.rom).filter((n): n is number => typeof n === "number");
      const quality = rollupQuality(allChunks);
      // Engine v2 judges each rep, so form accuracy is the share of counted reps that were valid. Older chunks only
      // carry a tempo-based score; it is used only when no chunk has per-rep judgment.
      const forms = allChunks.filter((c) => typeof c.formScore === "number" && c.reps > 0);
      const formAccuracy =
        formAccuracyOf(quality.validReps, quality.invalidReps) ??
        (forms.length ? Math.round(forms.reduce((sum, c) => sum + c.formScore! * c.reps, 0) / forms.reduce((sum, c) => sum + c.reps, 0)) : undefined);
      const seconds = allChunks.reduce(
        (sum, c) => sum + (c.startedAt && c.endedAt ? Math.max(0, Math.min(3600, (c.endedAt.getTime() - c.startedAt.getTime()) / 1000)) : 0),
        0
      );

      const issueCounts: Record<string, number> = {};
      for (const c of allChunks) for (const [code, n] of Object.entries(c.issues ?? {})) issueCounts[code] = (issueCounts[code] ?? 0) + n;
      for (const [code, e] of Object.entries(quality.errors ?? {})) issueCounts[code] = Math.max(issueCounts[code] ?? 0, e.count);
      const issueSeverity = Object.fromEntries(Object.entries(quality.errors ?? {}).map(([code, e]) => [code, e.severity]));

      const updated = await ExerciseSession.findOneAndUpdate(
        { _id: doc._id, rev: doc.rev ?? 0 },
        {
          $set: {
            sets: result.sets,
            completedReps: totalRepsOf(result.sets, exercise.reps),
            rom: roms.length ? Math.max(...roms) : 0,
            formAccuracy,
            durationSeconds: Math.round(seconds),
            targetMet: progress.status === "complete",
            issueCounts: Object.keys(issueCounts).length ? issueCounts : undefined,
            issueSeverity: Object.keys(issueSeverity).length ? issueSeverity : undefined,
            engineVersion: quality.engineVersion,
            validReps: quality.validReps,
            invalidReps: quality.invalidReps,
            partialReps: quality.partialReps,
            correctionAttempts: quality.correctionAttempts,
            correctionsSucceeded: quality.correctionsSucceeded,
            avgConfidence: quality.avgConfidence,
            lowConfidenceMs: quality.lowConfidenceMs,
            observations: quality.observations,
            ...(discomfort ? { discomfort } : {}),
            date: new Date(),
          },
          $inc: { rev: 1 },
        },
        { returnDocument: "after" }
      );
      if (!updated) continue; // lost the race; reload and apply again
    }

    const allToday = await ExerciseSession.find({ patientId, prescriptionId: key.prescriptionId, dateKey: today }).lean<IExerciseSession[]>();
    const day = computeDailyPlan(schedule, today, logsOf(allToday));
    return {
      duplicate: result.duplicate,
      credited: result.credited,
      setComplete: result.setComplete,
      exercise: progress,
      exerciseComplete: progress.status === "complete",
      dayComplete: day.totalSets > 0 && day.completedSets >= day.totalSets,
      sessionId: doc._id.toString(),
    };
  }
  throw new HttpError(409, "Your progress is being saved from another screen. Please try again in a moment.");
}
