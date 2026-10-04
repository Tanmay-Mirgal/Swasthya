import mongoose, { Schema, Document } from "mongoose";

export interface IAppointmentRequest extends Document {
  patientId: string; // clerkUserId
  therapistId: string; // clerkUserId
  status: "pending" | "accepted" | "declined" | "cancelled";
  requestedDate?: Date;
  requestedTime?: string;
  patientNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AppointmentRequestSchema = new Schema(
  {
    patientId: {
      type: String,
      required: true,
      index: true,
    },
    therapistId: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "cancelled"],
      default: "pending",
    },
    requestedDate: {
      type: Date,
    },
    requestedTime: {
      type: String,
    },
    patientNote: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const AppointmentRequest =
  mongoose.models.AppointmentRequest ||
  mongoose.model<IAppointmentRequest>("AppointmentRequest", AppointmentRequestSchema);

export default AppointmentRequest;
