import "server-only";
import Payment from "@/models/Payment";
import AppointmentRequest from "@/models/AppointmentRequest";
import { refundPayment } from "./razorpay";

/** Refund the consultation fee for an appointment that will not happen. Safe to call twice. */
export async function refundAppointment(appointmentId: string): Promise<boolean> {
  const payment = await Payment.findOneAndUpdate(
    { appointmentId, status: "paid" },
    { status: "refunded" },
    { returnDocument: "before" }
  );
  if (!payment?.paymentId) return false;
  try {
    const refund = await refundPayment(payment.paymentId, payment.amount);
    await Payment.updateOne({ _id: payment._id }, { refundId: refund.id });
    await AppointmentRequest.updateOne({ _id: appointmentId }, { paymentStatus: "refunded" });
    return true;
  } catch (error) {
    // Put the claim back so the refund can be retried; never lose track of money owed.
    await Payment.updateOne({ _id: payment._id }, { status: "paid" });
    console.error("Refund failed for appointment", appointmentId, error);
    return false;
  }
}
