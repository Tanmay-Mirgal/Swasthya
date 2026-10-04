import mongoose, { Schema, Document } from "mongoose";

export interface IConsultation extends Document {
  patientId: string;
  doctorId: string;
  issue: string;
  status: "REQUESTED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  callStatus: "idle" | "calling" | "connected" | "ended";
  startedAt?: Date;
  endedAt?: Date;
  duration?: number; // duration in seconds
  patientNote?: string;
  doctorNotes?: string;
  prescriptionId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ConsultationSchema = new Schema(
  {
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
    issue: {
      type: String,
      required: true,
      default: "General Rehabilitation",
    },
    status: {
      type: String,
      enum: ["REQUESTED", "ACTIVE", "COMPLETED", "CANCELLED"],
      default: "ACTIVE",
      index: true,
    },
    callStatus: {
      type: String,
      enum: ["idle", "calling", "connected", "ended"],
      default: "idle",
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    endedAt: {
      type: Date,
    },
    duration: {
      type: Number,
      default: 0,
    },
    patientNote: {
      type: String,
    },
    doctorNotes: {
      type: String,
    },
    prescriptionId: {
      type: Schema.Types.ObjectId,
      ref: "Prescription",
    },
  },
  {
    timestamps: true,
  }
);

const Consultation =
  mongoose.models.Consultation ||
  mongoose.model<IConsultation>("Consultation", ConsultationSchema);

export default Consultation;
