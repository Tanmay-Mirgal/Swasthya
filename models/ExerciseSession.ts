import mongoose, { Schema, Document } from "mongoose";
import type { StoredObservation, StoredRep, ErrorSeverity } from "@/lib/rehab/chunkQuality";

export interface IExerciseSessionSet {
  index: number;
  completedReps: number;
  chunks: {
    chunkId: string;
    reps: number;
    startedAt?: Date;
    endedAt?: Date;
    rom?: number;
    formScore?: number;
    issues?: Record<string, number>;
    /** Movement-engine quality measurements (see lib/rehab/chunkQuality). Absent on older records. */
    engine?: number;
    validReps?: number;
    invalidReps?: number;
    partialReps?: number;
    avgConfidence?: number;
    lowConfidenceMs?: number;
    corrections?: { attempted: number; succeeded: number };
    flags?: Record<string, { count: number; severity: ErrorSeverity }>;
    repRecords?: StoredRep[];
    observations?: StoredObservation[];
  }[];
  completedAt?: Date;
}

/**
 * One exercise-day. Prescribed work is a single record per
 * (patient, prescription, exercise, day) that fills in set by set; free practice
 * (no prescription) keeps the original one-record-per-run shape.
 */
export interface IExerciseSession extends Document {
  patientId: string;
  prescriptionId?: string;
  /** Subdocument id of the exercise inside the prescription. */
  prescriptionExerciseKey?: string;
  /** Calendar day in the patient's timezone (YYYY-MM-DD). */
  dateKey?: string;
  sets?: IExerciseSessionSet[];
  /** Optimistic-concurrency counter for set updates. */
  rev?: number;
  /** Totals of each movement-feedback code across the day's chunks (reps affected, for engine v2 data). */
  issueCounts?: Record<string, number>;
  /** Worst severity seen per issue code. Engine v2 only. */
  issueSeverity?: Record<string, ErrorSeverity>;
  /** Version of the movement engine behind formAccuracy / the quality totals. Absent = legacy tempo-based score. */
  engineVersion?: number;
  validReps?: number;
  invalidReps?: number;
  partialReps?: number;
  correctionAttempts?: number;
  correctionsSucceeded?: number;
  avgConfidence?: number;
  lowConfidenceMs?: number;
  /** Persistent problems worth a therapist's attention: what was measured and how often. No causes. */
  observations?: StoredObservation[];
  /** Patient-reported discomfort after the exercise (their words, not an app judgement). */
  discomfort?: "none" | "mild" | "moderate" | "severe";
  exerciseId: string;
  exerciseName: string;
  durationSeconds: number;
  completedReps: number;
  targetReps: number;
  rom: number;
  targetRom?: number;
  formAccuracy?: number;
  targetMet: boolean;
  /** Therapist review: written by a person, kept separate from the automated measurements. */
  therapistNote?: string;
  therapistAssessment?: "on_track" | "needs_work" | "concern";
  reviewedAt?: Date;
  reviewedBy?: string;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ExerciseSessionSchema = new Schema(
  {
    patientId: {
      type: String,
      required: true,
      index: true,
    },
    prescriptionId: { type: String, index: true },
    prescriptionExerciseKey: { type: String },
    dateKey: { type: String },
    rev: { type: Number, default: 0 },
    issueCounts: { type: Schema.Types.Mixed },
    issueSeverity: { type: Schema.Types.Mixed },
    engineVersion: { type: Number },
    validReps: { type: Number },
    invalidReps: { type: Number },
    partialReps: { type: Number },
    correctionAttempts: { type: Number },
    correctionsSucceeded: { type: Number },
    avgConfidence: { type: Number },
    lowConfidenceMs: { type: Number },
    observations: { type: Schema.Types.Mixed },
    discomfort: { type: String, enum: ["none", "mild", "moderate", "severe"] },
    sets: [
      {
        _id: false,
        index: { type: Number, required: true },
        completedReps: { type: Number, default: 0 },
        chunks: [
          {
            _id: false,
            chunkId: { type: String, required: true },
            reps: { type: Number, required: true },
            startedAt: { type: Date },
            endedAt: { type: Date },
            rom: { type: Number },
            formScore: { type: Number },
            issues: { type: Schema.Types.Mixed },
            engine: { type: Number },
            validReps: { type: Number },
            invalidReps: { type: Number },
            partialReps: { type: Number },
            avgConfidence: { type: Number },
            lowConfidenceMs: { type: Number },
            corrections: { type: Schema.Types.Mixed },
            flags: { type: Schema.Types.Mixed },
            repRecords: { type: Schema.Types.Mixed },
            observations: { type: Schema.Types.Mixed },
          },
        ],
        completedAt: { type: Date },
      },
    ],
    exerciseId: {
      type: String,
      required: true,
    },
    exerciseName: {
      type: String,
      required: true,
    },
    durationSeconds: {
      type: Number,
      default: 0,
    },
    completedReps: {
      type: Number,
      default: 0,
    },
    targetReps: {
      type: Number,
      default: 10,
    },
    rom: {
      type: Number,
      default: 0,
    },
    // No defaults: a missing measurement stays missing instead of being invented.
    targetRom: {
      type: Number,
    },
    formAccuracy: {
      type: Number,
    },
    targetMet: {
      type: Boolean,
      default: false,
    },
    therapistNote: { type: String, maxlength: 2000 },
    therapistAssessment: { type: String, enum: ["on_track", "needs_work", "concern"] },
    reviewedAt: { type: Date },
    reviewedBy: { type: String },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// One record per prescribed exercise per day; free practice (no prescription) is unconstrained.
ExerciseSessionSchema.index(
  { patientId: 1, prescriptionId: 1, prescriptionExerciseKey: 1, dateKey: 1 },
  { unique: true, partialFilterExpression: { prescriptionId: { $type: "string" } } }
);
ExerciseSessionSchema.index({ patientId: 1, date: -1 });

const ExerciseSession =
  mongoose.models.ExerciseSession ||
  mongoose.model<IExerciseSession>("ExerciseSession", ExerciseSessionSchema);

export default ExerciseSession;
