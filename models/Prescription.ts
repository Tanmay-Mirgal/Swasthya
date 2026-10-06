import mongoose, { Schema, Document } from "mongoose";

/**
 * A rehabilitation prescription: the therapist's plan for one patient over a date range.
 *
 * Lifecycle: draft → active → paused ⇄ active → completed | cancelled.
 * Prescriptions are auditable and never edited in place once active. A change creates
 * a new version (`supersedesId`) and the previous version is closed as `completed`
 * with `closedReason: "superseded"`, so every session keeps pointing at the exact plan
 * it was performed against.
 *
 * `startDate` / `endDate` are calendar days (`YYYY-MM-DD`) in the patient's timezone,
 * not instants, so "day 6" never shifts with a server's clock.
 */

export type PrescriptionStatus = "draft" | "active" | "paused" | "completed" | "cancelled";
export type PrescriptionFrequency = "daily" | "alternate" | "weekdays";

export interface IPrescriptionMedicine {
  name: string;
  /** Dosage exactly as written by the authorised professional. */
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  startDate?: string;
  endDate?: string;
}

export interface IPrescriptionExercise {
  _id?: mongoose.Types.ObjectId;
  exerciseId: string;
  name: string;
  sets: number;
  reps: number;
  holdSeconds?: number;
  /** Target range of motion in degrees, where the exercise supports one. */
  targetRom?: number;
  tempoSeconds?: number;
  modifications?: string;
  instructions?: string;
  order?: number;
  // Legacy fields from the original consultation prescription.
  duration?: string;
  frequency?: string;
  difficulty?: string;
}

export interface IStatusChange {
  status: PrescriptionStatus;
  at: Date;
  by?: string;
  note?: string;
}

export interface IWeeklyReviewConfig {
  enabled: boolean;
  cycleDay: number;
  requireRecording: boolean;
  recordingExerciseKey?: string;
}

export interface IPrescription extends Document {
  consultationId?: mongoose.Types.ObjectId;
  patientId: string;
  doctorId: string;
  doctorName?: string;
  doctorSpecialization?: string;

  status: PrescriptionStatus;
  statusHistory: IStatusChange[];
  version: number;
  rootId?: string;
  supersedesId?: string;
  supersededById?: string;
  closedReason?: "superseded" | "duration_elapsed" | "manual" | "cancelled";

  startDate: string;
  endDate: string;
  durationDays: number;
  frequency: PrescriptionFrequency;
  weeklyReview: IWeeklyReviewConfig;

  exercises: IPrescriptionExercise[];
  /** Patient-facing general instructions. */
  instructions?: string;
  /** Notes from the therapist, shown to the patient. */
  doctorNotes?: string;
  /** A record of professional instructions. Never generated or suggested by the app. */
  medicines: IPrescriptionMedicine[];
  healthyTips: string[];

  createdAt: Date;
  updatedAt: Date;
}

const PrescriptionSchema = new Schema(
  {
    consultationId: { type: Schema.Types.ObjectId, ref: "Consultation", index: true },
    patientId: { type: String, required: true, index: true },
    doctorId: { type: String, required: true, index: true },
    doctorName: { type: String },
    doctorSpecialization: { type: String },

    status: {
      type: String,
      enum: ["draft", "active", "paused", "completed", "cancelled"],
      default: "active",
      index: true,
    },
    statusHistory: [
      {
        _id: false,
        status: { type: String, required: true },
        at: { type: Date, default: Date.now },
        by: { type: String },
        note: { type: String, maxlength: 500 },
      },
    ],
    version: { type: Number, default: 1 },
    rootId: { type: String, index: true },
    supersedesId: { type: String },
    supersededById: { type: String },
    closedReason: { type: String, enum: ["superseded", "duration_elapsed", "manual", "cancelled"] },

    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    durationDays: { type: Number, required: true, min: 1, max: 365 },
    frequency: { type: String, enum: ["daily", "alternate", "weekdays"], default: "daily" },
    weeklyReview: {
      _id: false,
      enabled: { type: Boolean, default: false },
      cycleDay: { type: Number, default: 6, min: 1, max: 7 },
      requireRecording: { type: Boolean, default: false },
      recordingExerciseKey: { type: String },
    },

    exercises: [
      {
        exerciseId: { type: String, required: true },
        name: { type: String, required: true },
        sets: { type: Number, required: true, min: 1, max: 10 },
        reps: { type: Number, required: true, min: 1, max: 50 },
        holdSeconds: { type: Number, min: 0, max: 120 },
        targetRom: { type: Number, min: 1, max: 180 },
        tempoSeconds: { type: Number, min: 1, max: 20 },
        modifications: { type: String, maxlength: 1000 },
        instructions: { type: String, maxlength: 1000 },
        order: { type: Number },
        duration: { type: String },
        frequency: { type: String },
        difficulty: { type: String },
      },
    ],
    instructions: { type: String, maxlength: 2000 },
    doctorNotes: { type: String, maxlength: 2000 },
    medicines: [
      {
        name: { type: String, required: true, maxlength: 200 },
        dosage: { type: String, default: "", maxlength: 200 },
        frequency: { type: String, default: "", maxlength: 200 },
        duration: { type: String, default: "", maxlength: 200 },
        instructions: { type: String, default: "", maxlength: 1000 },
        startDate: { type: String },
        endDate: { type: String },
      },
    ],
    healthyTips: { type: [String], default: [] },
  },
  { timestamps: true }
);

// A patient has at most one live (active or paused) plan per therapist.
PrescriptionSchema.index(
  { patientId: 1, doctorId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ["active", "paused"] } } }
);
PrescriptionSchema.index({ patientId: 1, status: 1, startDate: -1 });
PrescriptionSchema.index({ doctorId: 1, status: 1 });

const Prescription =
  (mongoose.models.Prescription as mongoose.Model<IPrescription>) ||
  mongoose.model<IPrescription>("Prescription", PrescriptionSchema);

export default Prescription;
