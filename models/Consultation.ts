import mongoose, { Schema, Document } from "mongoose";

export interface IConsultation extends Document {
  appointmentId?: string;
  patientId: string;
  doctorId: string;
  issue: string;
  status: "REQUESTED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  roomStatus:
    | "NOT_CREATED"
    | "SCHEDULED"
    | "OPEN"
    | "PATIENT_JOINED"
    | "DOCTOR_JOINED"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "EXPIRED";
  callStatus: "idle" | "calling" | "accepted" | "connected" | "ended";
  callInitiatorId?: string;
  /** Server-issued id of the CURRENT call; every call/signaling event must carry it. */
  callId?: string;
  callUpdatedAt?: Date;
  scheduledAt?: Date;
  requestedTime?: string;
  startedAt?: Date;
  endedAt?: Date;
  patientJoinedAt?: Date;
  doctorJoinedAt?: Date;
  duration?: number; // duration in minutes
  patientNote?: string;
  doctorNotes?: string;
  prescriptionId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ConsultationSchema = new Schema(
  {
    appointmentId: {
      type: String,
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
    roomStatus: {
      type: String,
      enum: [
        "NOT_CREATED",
        "SCHEDULED",
        "OPEN",
        "PATIENT_JOINED",
        "DOCTOR_JOINED",
        "IN_PROGRESS",
        "COMPLETED",
        "EXPIRED",
      ],
      default: "SCHEDULED",
      index: true,
    },
    callStatus: {
      type: String,
      enum: ["idle", "calling", "accepted", "connected", "ended"],
      default: "idle",
    },
    // Who rang (server-derived from the authenticated identity) and when the call state last changed
    callInitiatorId: {
      type: String,
    },
    callId: {
      type: String,
    },
    callUpdatedAt: {
      type: Date,
    },
    scheduledAt: {
      type: Date,
      index: true,
    },
    requestedTime: {
      type: String,
    },
    startedAt: {
      type: Date,
    },
    endedAt: {
      type: Date,
    },
    patientJoinedAt: {
      type: Date,
    },
    doctorJoinedAt: {
      type: Date,
    },
    duration: {
      type: Number,
      default: 30, // 30 minutes
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
