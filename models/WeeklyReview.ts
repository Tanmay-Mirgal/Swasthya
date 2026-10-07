import mongoose, { Schema, Document } from "mongoose";

/**
 * The review for one week of a prescription. The `report` is a snapshot of stored
 * data (sets, adherence, measured quality) taken when it was generated; it never
 * contains conclusions the app invented. The recording is a reference only: the
 * video lives in private object storage and is served through an authorised route.
 */

export type WeeklyReviewStatus =
  | "upcoming" // review day has not arrived
  | "recording_due" // review day: patient must record (when required)
  | "report_ready" // report generated, awaiting therapist
  | "reviewed"; // therapist has reviewed

export interface IWeeklyReportExercise {
  exerciseKey: string;
  exerciseId: string;
  name: string;
  setsPrescribed: number;
  setsCompleted: number;
  repsPrescribed: number;
  repsCompleted: number;
  averageRom?: number;
  /** Unit of averageRom: degrees, or percent for movements measured as a share of body width. */
  romUnit?: "deg" | "pct";
  averageFormScore?: number;
  validReps?: number;
  invalidReps?: number;
}

/** What the report's form score is measured against. Scores on different bases are never compared. */
/** engine2 = share of counted reps that were valid; engine4 = share of ALL attempts that were good reps; legacy = pace-based. Never compared with each other. */
export type FormBasis = "engine2" | "engine4" | "legacy";

export interface IWeeklyReport {
  generatedAt: Date;
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  exercisesAssigned: number;
  exercisesCompleted: number;
  setsPrescribed: number;
  setsCompleted: number;
  repsPrescribed: number;
  repsCompleted: number;
  daysDue: number;
  daysCompleted: number;
  daysMissed: number;
  adherencePercent: number | null;
  averageRom?: number;
  averageFormScore?: number;
  /** `engine2` = share of counted reps that met the per-rep form checks; `legacy` = the older tempo-based score. */
  formBasis?: FormBasis;
  /** Movement quality across the week, from per-rep judgment. Absent when the week has none. */
  quality?: {
    validReps: number;
    invalidReps: number;
    partialReps: number;
    correctionAttempts: number;
    correctionsSucceeded: number;
    avgConfidence?: number;
    /** Error codes seen in the most reps across the week. */
    repeatedErrors: { code: string; reps: number; severity: "minor" | "moderate" | "major" }[];
  };
  /** Change in average form score against the previous week's report, percentage points (same basis only). */
  qualityChange?: number | null;
  /** The movement-feedback codes raised most often, as counted by the on-device engine. */
  commonFeedback: { code: string; count: number }[];
  /** Self-reported discomfort entries; only what the patient chose to report. */
  discomfortReports: { level: "mild" | "moderate" | "severe"; day: string; exerciseName: string }[];
  exercises: IWeeklyReportExercise[];
}

export interface IWeeklyReview extends Document {
  prescriptionId: string;
  patientId: string;
  doctorId: string;
  weekNumber: number;
  dueDate: string;
  status: WeeklyReviewStatus;
  recordingRequired: boolean;
  recordingExerciseKey?: string;
  recordingId?: string;
  report?: IWeeklyReport;
  therapistNotes?: string;
  reviewedAt?: Date;
  reviewedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WeeklyReviewSchema = new Schema(
  {
    prescriptionId: { type: String, required: true },
    patientId: { type: String, required: true, index: true },
    doctorId: { type: String, required: true, index: true },
    weekNumber: { type: Number, required: true },
    dueDate: { type: String, required: true },
    status: {
      type: String,
      enum: ["upcoming", "recording_due", "report_ready", "reviewed"],
      default: "upcoming",
      index: true,
    },
    recordingRequired: { type: Boolean, default: false },
    recordingExerciseKey: { type: String },
    recordingId: { type: String },
    report: { type: Schema.Types.Mixed },
    therapistNotes: { type: String, maxlength: 4000 },
    reviewedAt: { type: Date },
    reviewedBy: { type: String },
  },
  { timestamps: true }
);

WeeklyReviewSchema.index({ prescriptionId: 1, weekNumber: 1 }, { unique: true });
WeeklyReviewSchema.index({ doctorId: 1, status: 1, dueDate: -1 });

const WeeklyReview =
  (mongoose.models.WeeklyReview as mongoose.Model<IWeeklyReview>) ||
  mongoose.model<IWeeklyReview>("WeeklyReview", WeeklyReviewSchema);

export default WeeklyReview;
