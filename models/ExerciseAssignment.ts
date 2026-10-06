import mongoose, { Schema, Document } from "mongoose";

export interface IExerciseAssignment extends Document {
  patientId: string; // clerkUserId
  therapistId?: string; // clerkUserId (if assigned by therapist)
  consultationId?: string;
  prescriptionId?: string;
  exerciseId: string; // from lib/exercises (e.g. "seated-knee-extension")
  exerciseName?: string;
  status: "active" | "completed";
  type: "suggested" | "assigned"; // "suggested" by system, "assigned" by therapist
  targetSets: number;
  targetReps: number;
  frequency?: string;
  instructions?: string;
  /** Target range of motion in degrees. */
  targetRom?: number;
  holdSeconds?: number;
  /** Seconds per repetition the therapist wants. */
  tempoSeconds?: number;
  /** Patient-specific modifications (e.g. limit range, use a chair with arms). */
  modifications?: string;
  assignedAt: Date;
}

const ExerciseAssignmentSchema = new Schema(
  {
    patientId: {
      type: String,
      required: true,
      index: true,
    },
    therapistId: {
      type: String,
      index: true,
    },
    consultationId: {
      type: String,
      index: true,
    },
    prescriptionId: {
      type: String,
      index: true,
    },
    exerciseId: {
      type: String,
      required: true,
    },
    exerciseName: {
      type: String,
    },
    status: {
      type: String,
      enum: ["active", "completed"],
      default: "active",
    },
    type: {
      type: String,
      enum: ["suggested", "assigned"],
      default: "suggested",
    },
    targetSets: {
      type: Number,
      default: 3,
    },
    targetReps: {
      type: Number,
      default: 10,
    },
    frequency: {
      type: String,
      default: "Daily",
    },
    instructions: {
      type: String,
    },
    targetRom: { type: Number },
    holdSeconds: { type: Number },
    tempoSeconds: { type: Number },
    modifications: { type: String, maxlength: 1000 },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const ExerciseAssignment =
  mongoose.models.ExerciseAssignment ||
  mongoose.model<IExerciseAssignment>("ExerciseAssignment", ExerciseAssignmentSchema);

export default ExerciseAssignment;
