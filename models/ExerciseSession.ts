import mongoose, { Schema, Document } from "mongoose";

export interface IExerciseSession extends Document {
  patientId: string;
  exerciseId: string;
  exerciseName: string;
  durationSeconds: number;
  completedReps: number;
  targetReps: number;
  rom: number;
  targetRom: number;
  formAccuracy?: number;
  targetMet: boolean;
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
    targetRom: {
      type: Number,
      default: 90,
    },
    formAccuracy: {
      type: Number,
      default: 95,
    },
    targetMet: {
      type: Boolean,
      default: false,
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const ExerciseSession =
  mongoose.models.ExerciseSession ||
  mongoose.model<IExerciseSession>("ExerciseSession", ExerciseSessionSchema);

export default ExerciseSession;
