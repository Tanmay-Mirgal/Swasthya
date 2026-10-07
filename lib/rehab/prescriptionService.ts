/**
 * lib/rehab/prescriptionService.ts
 *
 * Creating, revising and transitioning prescriptions. All validation happens here,
 * server-side; the builder UI is a convenience, never the authority.
 */

import mongoose from "mongoose";
import Prescription, { type IPrescription, type PrescriptionFrequency, type PrescriptionStatus } from "@/models/Prescription";
import TherapistProfile from "@/models/TherapistProfile";
import Consultation from "@/models/Consultation";
import WeeklyReview from "@/models/WeeklyReview";
import { getPrescribableExercise } from "./exerciseCatalog";
import { getMovementTemplate } from "@/lib/movement/template/registry";
import { isValidRangeOverride, rangeOverrideBounds } from "@/lib/movement/template/tolerance";
import { addDays, dateKeyInTimezone, isDateKey, type DateKey } from "./dates";
import { endDateFor, reviewDays, type ScheduleInput } from "./schedule";
import { HttpError, patientTimezone } from "./auth";

export interface PrescriptionExerciseInput {
  exerciseId: string;
  sets: number;
  reps: number;
  holdSeconds?: number;
  targetRom?: number;
  /**
   * The least range (in the exercise's display unit) accepted as a good rep for THIS patient. Optional; only ever more
   * lenient than the exercise's default, and never below its "almost" line. Absent = the exercise's own standard.
   */
  minRangeOverride?: number;
  tempoSeconds?: number;
  modifications?: string;
  instructions?: string;
}

/** A therapist's accepted-range tolerance, validated against what the exercise's template allows. */
function rangeOverride(exerciseId: string, name: string, raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const v = Number(raw);
  const template = getMovementTemplate(exerciseId);
  if (!template || !isValidRangeOverride(template, v)) {
    const b = template ? rangeOverrideBounds(template) : null;
    const unit = b?.unit === "pct" ? "%" : "°";
    throw new HttpError(400, b ? `For ${name}, the accepted range must be between ${Math.min(b.strict, b.lenient)}${unit} and ${Math.max(b.strict, b.lenient)}${unit}.` : `${name} has no adjustable range.`);
  }
  return Math.round(v * 10) / 10;
}

export interface MedicineInput {
  name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
  startDate?: string;
  endDate?: string;
}

export interface PrescriptionInput {
  patientId: string;
  consultationId?: string;
  startDate?: string;
  durationDays: number;
  frequency?: PrescriptionFrequency;
  exercises: PrescriptionExerciseInput[];
  weeklyReview?: { enabled: boolean; cycleDay?: number; requireRecording?: boolean; recordingExerciseId?: string };
  instructions?: string;
  doctorNotes?: string;
  medicines?: MedicineInput[];
  /** Why the plan is being changed, kept in the audit trail when revising. */
  revisionNote?: string;
}

const MAX_EXERCISES = 12;
const MAX_MEDICINES = 20;

const int = (v: unknown, min: number, max: number): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : undefined;
};
const text = (v: unknown, max: number): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;

function clean(input: PrescriptionInput, today: DateKey) {
  const durationDays = int(input.durationDays, 1, 365);
  if (!durationDays) throw new HttpError(400, "Choose how many days the plan runs (1 to 365).");

  const startDate = input.startDate ?? today;
  if (!isDateKey(startDate)) throw new HttpError(400, "The start date is not valid.");
  if (startDate < addDays(today, -1)) throw new HttpError(400, "The start date cannot be in the past.");

  const frequency: PrescriptionFrequency = ["daily", "alternate", "weekdays"].includes(input.frequency ?? "daily")
    ? (input.frequency ?? "daily")
    : "daily";

  if (!Array.isArray(input.exercises) || input.exercises.length === 0) {
    throw new HttpError(400, "Add at least one exercise to the plan.");
  }
  if (input.exercises.length > MAX_EXERCISES) throw new HttpError(400, `A plan can have up to ${MAX_EXERCISES} exercises.`);

  const seen = new Set<string>();
  const exercises = input.exercises.map((raw, order) => {
    const catalog = typeof raw.exerciseId === "string" ? getPrescribableExercise(raw.exerciseId) : null;
    if (!catalog) throw new HttpError(400, "One of the exercises is not available for camera tracking.");
    if (seen.has(catalog.id)) throw new HttpError(400, `${catalog.name} is added twice.`);
    seen.add(catalog.id);
    const sets = int(raw.sets, 1, 10);
    const reps = int(raw.reps, 1, 50);
    if (!sets || !reps) throw new HttpError(400, `Set the sets (1 to 10) and reps (1 to 50) for ${catalog.name}.`);
    return {
      exerciseId: catalog.id,
      name: catalog.name,
      sets,
      reps,
      holdSeconds: int(raw.holdSeconds, 0, 120),
      targetRom: int(raw.targetRom, 1, 180),
      minRangeOverride: rangeOverride(catalog.id, catalog.name, raw.minRangeOverride),
      tempoSeconds: int(raw.tempoSeconds, 1, 20),
      modifications: text(raw.modifications, 1000),
      instructions: text(raw.instructions, 1000),
      order,
    };
  });

  const wr = input.weeklyReview;
  const cycleDay = int(wr?.cycleDay, 1, 7) ?? 6;
  const reviewEnabled = Boolean(wr?.enabled);
  if (reviewEnabled && cycleDay > durationDays) {
    throw new HttpError(400, `The weekly review day (day ${cycleDay}) falls after the plan ends.`);
  }
  const requireRecording = reviewEnabled && Boolean(wr?.requireRecording);
  if (wr?.recordingExerciseId && !seen.has(wr.recordingExerciseId)) {
    throw new HttpError(400, "The exercise chosen for the review recording is not in the plan.");
  }

  const medicines = (input.medicines ?? []).slice(0, MAX_MEDICINES).map((m) => {
    const name = text(m.name, 200);
    if (!name) throw new HttpError(400, "Each medicine needs a name.");
    if (m.startDate && !isDateKey(m.startDate)) throw new HttpError(400, `The start date for ${name} is not valid.`);
    if (m.endDate && !isDateKey(m.endDate)) throw new HttpError(400, `The end date for ${name} is not valid.`);
    return {
      name,
      dosage: text(m.dosage, 200) ?? "",
      frequency: text(m.frequency, 200) ?? "",
      duration: text(m.duration, 200) ?? "",
      instructions: text(m.instructions, 1000) ?? "",
      startDate: m.startDate || undefined,
      endDate: m.endDate || undefined,
    };
  });

  return {
    startDate,
    endDate: endDateFor(startDate, durationDays),
    durationDays,
    frequency,
    exercises,
    weeklyReview: {
      enabled: reviewEnabled,
      cycleDay,
      requireRecording,
      recordingExerciseId: requireRecording ? (wr?.recordingExerciseId ?? exercises[0].exerciseId) : undefined,
    },
    instructions: text(input.instructions, 2000),
    doctorNotes: text(input.doctorNotes, 2000),
    medicines,
    revisionNote: text(input.revisionNote, 500),
  };
}

/** Maps the exercise id picked for recording onto the saved subdocument key. */
function recordingKey(doc: IPrescription, recordingExerciseId?: string): string | undefined {
  if (!recordingExerciseId) return undefined;
  return doc.exercises.find((e) => e.exerciseId === recordingExerciseId)?._id?.toString();
}

export function toScheduleInput(p: Pick<IPrescription, "startDate" | "endDate" | "frequency" | "exercises" | "weeklyReview">): ScheduleInput {
  return {
    startDate: p.startDate,
    endDate: p.endDate,
    frequency: p.frequency,
    exercises: p.exercises.map((e) => ({
      key: e._id!.toString(),
      exerciseId: e.exerciseId,
      name: e.name,
      sets: e.sets,
      reps: e.reps,
    })),
    weeklyReview: p.weeklyReview
      ? {
          enabled: p.weeklyReview.enabled,
          cycleDay: p.weeklyReview.cycleDay,
          requireRecording: p.weeklyReview.requireRecording,
          recordingExerciseKey: p.weeklyReview.recordingExerciseKey,
        }
      : undefined,
  };
}

/**
 * Creates a prescription for a patient. If the patient already has a live plan with
 * this therapist, the new one is a revision: the old plan is closed (kept, never
 * edited) and the new one links back to it.
 *
 * Writes are ordered so a failure part-way leaves a recoverable state: the new plan
 * is inserted as a draft first, the previous plan is closed second, and only then is
 * the new plan activated. The partial unique index on (patient, therapist) for live
 * plans makes a concurrent double-submit fail rather than create two active plans.
 */
export async function createPrescription(therapistId: string, input: PrescriptionInput): Promise<IPrescription> {
  const tz = await patientTimezone(input.patientId);
  const today = dateKeyInTimezone(new Date(), tz);
  const data = clean(input, today);

  let consultationId: mongoose.Types.ObjectId | undefined;
  if (input.consultationId) {
    if (!mongoose.isValidObjectId(input.consultationId)) throw new HttpError(400, "That consultation id is not valid.");
    const consultation = await Consultation.findById(input.consultationId).lean<{ _id: mongoose.Types.ObjectId; doctorId: string; patientId: string }>();
    if (!consultation || consultation.doctorId !== therapistId || consultation.patientId !== input.patientId) {
      throw new HttpError(403, "That consultation does not belong to you and this patient.");
    }
    consultationId = consultation._id;
  }

  const profile = await TherapistProfile.findOne({ clerkUserId: therapistId }).lean<{ professionalName?: string; specialization?: string }>();
  const previous = await Prescription.findOne({
    patientId: input.patientId,
    doctorId: therapistId,
    status: { $in: ["active", "paused"] },
  });

  const now = new Date();
  const { recordingExerciseId, ...weeklyReview } = data.weeklyReview;
  const doc = new Prescription({
    consultationId,
    patientId: input.patientId,
    doctorId: therapistId,
    doctorName: profile?.professionalName,
    doctorSpecialization: profile?.specialization,
    status: "draft",
    statusHistory: [{ status: "draft", at: now, by: therapistId, note: data.revisionNote }],
    version: previous ? previous.version + 1 : 1,
    rootId: previous ? (previous.rootId ?? previous._id.toString()) : undefined,
    supersedesId: previous?._id.toString(),
    startDate: data.startDate,
    endDate: data.endDate,
    durationDays: data.durationDays,
    frequency: data.frequency,
    weeklyReview,
    exercises: data.exercises,
    instructions: data.instructions,
    doctorNotes: data.doctorNotes,
    medicines: data.medicines,
  });
  if (!doc.rootId) doc.rootId = doc._id.toString();
  doc.weeklyReview.recordingExerciseKey = recordingKey(doc, recordingExerciseId);
  await doc.save();

  try {
    if (previous) {
      previous.status = "completed";
      previous.closedReason = "superseded";
      previous.supersededById = doc._id.toString();
      previous.statusHistory.push({ status: "completed", at: now, by: therapistId, note: "Replaced by a newer version" });
      await previous.save();
    }
    doc.status = "active";
    doc.statusHistory.push({ status: "active", at: now, by: therapistId });
    await doc.save();
  } catch (err) {
    // Leave the audit trail honest: the new plan never became active.
    await Prescription.updateOne({ _id: doc._id }, { $set: { status: "cancelled", closedReason: "cancelled" } });
    throw err;
  }

  if (consultationId) {
    await Consultation.updateOne({ _id: consultationId }, { $set: { prescriptionId: doc._id } });
  }
  await syncWeeklyReviews(doc);
  return doc;
}

/** Ensures one WeeklyReview row exists for every review day in the plan. */
export async function syncWeeklyReviews(doc: IPrescription): Promise<void> {
  const input = toScheduleInput(doc);
  const days = reviewDays(input);
  if (days.length === 0) return;
  await WeeklyReview.bulkWrite(
    days.map(({ week, day }) => ({
      updateOne: {
        filter: { prescriptionId: doc._id.toString(), weekNumber: week },
        update: {
          $setOnInsert: {
            prescriptionId: doc._id.toString(),
            patientId: doc.patientId,
            doctorId: doc.doctorId,
            weekNumber: week,
            dueDate: day,
            status: "upcoming",
            recordingRequired: doc.weeklyReview.requireRecording,
            recordingExerciseKey: doc.weeklyReview.recordingExerciseKey,
          },
        },
        upsert: true,
      },
    }))
  );
}

const TRANSITIONS: Record<PrescriptionStatus, PrescriptionStatus[]> = {
  draft: ["active", "cancelled"],
  active: ["paused", "completed", "cancelled"],
  paused: ["active", "completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export async function transitionPrescription(
  prescriptionId: string,
  therapistId: string,
  next: PrescriptionStatus,
  note?: string
): Promise<IPrescription> {
  if (!mongoose.isValidObjectId(prescriptionId)) throw new HttpError(400, "That prescription id is not valid.");
  const doc = await Prescription.findById(prescriptionId);
  if (!doc || doc.doctorId !== therapistId) throw new HttpError(404, "Prescription not found.");
  if (!TRANSITIONS[doc.status].includes(next)) {
    throw new HttpError(409, `A ${doc.status} plan cannot become ${next}.`);
  }
  doc.status = next;
  if (next === "completed") doc.closedReason = "manual";
  if (next === "cancelled") doc.closedReason = "cancelled";
  doc.statusHistory.push({ status: next, at: new Date(), by: therapistId, note: text(note, 500) });
  await doc.save();
  return doc;
}

/** The patient's live plan (active, else paused), if any. */
export async function getLivePrescription(patientId: string) {
  return Prescription.findOne({ patientId, status: { $in: ["active", "paused"] } }).sort({ createdAt: -1 });
}

/** Closes plans whose end date has passed. Run lazily on read and by the daily cron. */
export async function completeElapsedPrescriptions(today: DateKey, patientId?: string): Promise<number> {
  const filter: Record<string, unknown> = { status: { $in: ["active", "paused"] }, endDate: { $lt: today } };
  if (patientId) filter.patientId = patientId;
  const res = await Prescription.updateMany(filter, {
    $set: { status: "completed", closedReason: "duration_elapsed" },
    $push: { statusHistory: { status: "completed", at: new Date(), note: "Plan duration ended" } },
  });
  return res.modifiedCount;
}
