import mongoose, { Schema, Document } from "mongoose";

/**
 * Metadata for a weekly-review recording. The video itself lives in private object
 * storage (Vercel Blob, `access: "private"`); only the pathname and facts about it are
 * kept here. There is never a public URL: playback goes through GET /api/recordings/[id],
 * which checks that the caller is the patient or their therapist.
 */
export interface IRecording extends Document {
  patientId: string;
  doctorId: string;
  prescriptionId: string;
  reviewId: string;
  weekNumber: number;
  exerciseKey?: string;
  exerciseId?: string;
  /** Local calendar day the clip was recorded (patient timezone). */
  dateKey: string;
  /** Pathname inside the private store. Never exposed to clients. */
  pathname: string;
  contentType: string;
  sizeBytes: number;
  durationSeconds?: number;
  /** The exercise session this clip belongs to, when known. */
  sessionId?: string;
  createdAt: Date;
}

const RecordingSchema = new Schema(
  {
    patientId: { type: String, required: true, index: true },
    doctorId: { type: String, required: true, index: true },
    prescriptionId: { type: String, required: true },
    reviewId: { type: String, required: true, index: true },
    weekNumber: { type: Number, required: true },
    exerciseKey: { type: String },
    exerciseId: { type: String },
    dateKey: { type: String, required: true },
    pathname: { type: String, required: true },
    contentType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    durationSeconds: { type: Number },
    sessionId: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const Recording =
  (mongoose.models.Recording as mongoose.Model<IRecording>) || mongoose.model<IRecording>("Recording", RecordingSchema);

export default Recording;
