import mongoose, { Schema, Document } from "mongoose";

export interface IExerciseAssignment extends Document {
  patientId: string; // clerkUserId
  therapistId?: string; // clerkUserId (if assigned by therapist)
  exerciseId: string; // from lib/exercises (e.g. "seated-knee-extension")
  status: "active" | "completed";
  type: "suggested" | "assigned"; // "suggested" by system, "assigned" by therapist
  targetSets: number;
  targetReps: number;
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
    exerciseId: {
      type: String,
      required: true,
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
