import mongoose, { Schema, Document } from "mongoose";

export interface IPrescriptionMedicine {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface IPrescriptionExercise {
  exerciseId: string;
  name: string;
  sets: number;
  reps: number;
  duration?: string;
  frequency?: string;
  difficulty?: string;
  instructions?: string;
}

export interface IPrescription extends Document {
  consultationId: mongoose.Types.ObjectId;
  patientId: string;
  doctorId: string;
  doctorName?: string;
  doctorSpecialization?: string;
  medicines: IPrescriptionMedicine[];
  healthyTips: string[];
  exercises: IPrescriptionExercise[];
  doctorNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PrescriptionSchema = new Schema(
  {
    consultationId: {
      type: Schema.Types.ObjectId,
      ref: "Consultation",
      required: true,
      index: true,
    },
    patientId: {
      type: String,
      required: true,
      index: true,
    },
    doctorId: {
      type: String,
      required: true,
      index: true,
    },
    doctorName: {
      type: String,
      default: "Doctor",
    },
    doctorSpecialization: {
      type: String,
    },
    medicines: [
      {
        name: { type: String, required: true },
        dosage: { type: String, default: "" },
        frequency: { type: String, default: "" },
        duration: { type: String, default: "" },
        instructions: { type: String, default: "" },
      },
    ],
    healthyTips: {
      type: [String],
      default: [],
    },
    exercises: [
      {
        exerciseId: { type: String, required: true },
        name: { type: String, required: true },
        sets: { type: Number, default: 3 },
        reps: { type: Number, default: 10 },
        duration: { type: String, default: "10 mins" },
        frequency: { type: String, default: "Daily" },
        difficulty: { type: String, default: "Moderate" },
        instructions: { type: String, default: "" },
      },
    ],
    doctorNotes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const Prescription =
  mongoose.models.Prescription ||
  mongoose.model<IPrescription>("Prescription", PrescriptionSchema);

export default Prescription;
