import mongoose, { Schema, Document } from "mongoose";

/**
 * One row per call (a consultation can have many). The live gate is still
 * `Consultation.callStatus/callId`; this is the history and audit trail:
 * who rang, when it was answered, when media really connected, who ended it and why.
 */
export type CallSessionStatus = "ringing" | "accepted" | "active" | "ended";

export interface ICallSession extends Document {
  callId: string;
  consultationId: string;
  therapistId: string;
  patientId: string;
  initiatorId: string;
  status: CallSessionStatus;
  startedAt: Date;
  acceptedAt?: Date;
  /** Set when a client reports its RTCPeerConnection reached `connected`. */
  connectedAt?: Date;
  endedAt?: Date;
  endedBy?: "doctor" | "patient" | "system";
  endReason?: string;
}

const CallSessionSchema = new Schema<ICallSession>(
  {
    callId: { type: String, required: true, unique: true, index: true },
    consultationId: { type: String, required: true, index: true },
    therapistId: { type: String, required: true },
    patientId: { type: String, required: true },
    initiatorId: { type: String, required: true },
    status: { type: String, enum: ["ringing", "accepted", "active", "ended"], default: "ringing" },
    startedAt: { type: Date, required: true },
    acceptedAt: Date,
    connectedAt: Date,
    endedAt: Date,
    endedBy: { type: String, enum: ["doctor", "patient", "system"] },
    endReason: String,
  },
  { timestamps: true }
);

const CallSession =
  (mongoose.models.CallSession as mongoose.Model<ICallSession>) ||
  mongoose.model<ICallSession>("CallSession", CallSessionSchema);

export default CallSession;
