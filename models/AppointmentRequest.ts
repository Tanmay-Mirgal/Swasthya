import mongoose, { Schema, Document } from "mongoose";

export interface IAppointmentRequest extends Document {
  patientId: string; // clerkUserId
  therapistId: string; // clerkUserId
  status: "pending" | "accepted" | "declined" | "cancelled" | "completed";
  requestedDate?: Date;
  requestedTime?: string;
  scheduledAt?: Date;
  duration: number; // in minutes
  patientNote?: string;
  consultationId?: string;
  cancellationReason?: string;
  /** Razorpay payment taken when the request was made (amount in rupees). */
  paymentId?: string;
  paymentStatus?: "paid" | "refunded";
  amountPaid?: number;
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
      enum: ["pending", "accepted", "declined", "cancelled", "completed"],
      default: "pending",
      index: true,
    },
    requestedDate: {
      type: Date,
    },
    requestedTime: {
      type: String,
    },
    scheduledAt: {
      type: Date,
      index: true,
    },
    duration: {
      type: Number,
      default: 30, // 30 mins
    },
    patientNote: {
      type: String,
    },
    consultationId: {
      type: String,
      index: true,
    },
    cancellationReason: {
      type: String,
    },
    paymentId: { type: String, index: true },
    paymentStatus: { type: String, enum: ["paid", "refunded"] },
    amountPaid: { type: Number },
  },
  {
    timestamps: true,
  }
);

const AppointmentRequest =
  mongoose.models.AppointmentRequest ||
  mongoose.model<IAppointmentRequest>("AppointmentRequest", AppointmentRequestSchema);

export default AppointmentRequest;
