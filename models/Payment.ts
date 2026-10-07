import mongoose, { Schema, Document } from "mongoose";

export type PaymentStatus = "created" | "paid" | "failed" | "refunded";

export interface IPayment extends Document {
  provider: "razorpay";
  orderId: string;
  paymentId?: string;
  patientId: string;
  therapistId: string;
  /** Smallest currency unit (paise). */
  amount: number;
  currency: string;
  status: PaymentStatus;
  /** What the patient asked for; the AppointmentRequest is only created once the payment is verified. */
  booking: { requestedDate?: string; requestedTime?: string; scheduledAt?: Date; patientNote?: string };
  appointmentId?: string;
  refundId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema(
  {
    provider: { type: String, default: "razorpay" },
    orderId: { type: String, required: true, unique: true },
    paymentId: { type: String, index: true },
    patientId: { type: String, required: true, index: true },
    therapistId: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    status: { type: String, enum: ["created", "paid", "failed", "refunded"], default: "created", index: true },
    booking: {
      requestedDate: String,
      requestedTime: String,
      scheduledAt: Date,
      patientNote: String,
    },
    appointmentId: String,
    refundId: String,
  },
  { timestamps: true }
);

const Payment = mongoose.models.Payment || mongoose.model<IPayment>("Payment", PaymentSchema);
export default Payment;
