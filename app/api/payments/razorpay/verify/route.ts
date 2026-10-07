import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import AppointmentRequest from "@/models/AppointmentRequest";
import Payment from "@/models/Payment";
import { getIdentityFromRequest } from "@/lib/realtime/auth/verifier";
import { confirmPayment, PaymentConfigError, refundPayment, verifySignature } from "@/lib/payments/razorpay";

export const dynamic = "force-dynamic";

/** Step 2 of booking: check the payment really happened, then (and only then) send the request to the therapist. */
export async function POST(req: Request) {
  try {
    const me = await getIdentityFromRequest(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = await req.json();
    if (!orderId || !paymentId || !signature) return NextResponse.json({ error: "Missing payment details." }, { status: 400 });

    await connectToDatabase();

    const payment = await Payment.findOne({ orderId, patientId: me.userId });
    if (!payment) return NextResponse.json({ error: "Payment not found." }, { status: 404 });

    // Already processed (double click, retry): return the same appointment.
    if (payment.status === "paid" && payment.appointmentId) {
      return NextResponse.json({ success: true, data: { appointmentId: payment.appointmentId } });
    }
    if (payment.status !== "created") return NextResponse.json({ error: "This payment can’t be used." }, { status: 409 });

    if (!verifySignature(orderId, paymentId, signature) || !(await confirmPayment(paymentId, orderId, payment.amount))) {
      await Payment.updateOne({ _id: payment._id, status: "created" }, { status: "failed" });
      return NextResponse.json({ error: "We couldn’t confirm your payment. If money was taken it will be returned." }, { status: 402 });
    }

    // Claim the payment so two concurrent verifications create only one appointment.
    const claimed = await Payment.findOneAndUpdate({ _id: payment._id, status: "created" }, { status: "paid", paymentId }, { returnDocument: "after" });
    if (!claimed) {
      const again = await Payment.findById(payment._id);
      return again?.appointmentId
        ? NextResponse.json({ success: true, data: { appointmentId: again.appointmentId } })
        : NextResponse.json({ error: "Your payment is being processed." }, { status: 409 });
    }

    try {
      const request = await AppointmentRequest.create({
        patientId: claimed.patientId,
        therapistId: claimed.therapistId,
        status: "pending",
        requestedDate: claimed.booking.requestedDate ? new Date(claimed.booking.requestedDate) : new Date(),
        requestedTime: claimed.booking.requestedTime || "10:00 AM",
        scheduledAt: claimed.booking.scheduledAt,
        duration: 30,
        patientNote: claimed.booking.patientNote || "",
        paymentId,
        paymentStatus: "paid",
        amountPaid: claimed.amount / 100,
      });
      await Payment.updateOne({ _id: claimed._id }, { appointmentId: request._id.toString() });
      return NextResponse.json({ success: true, data: { appointmentId: request._id.toString() } });
    } catch (error) {
      // Paid but no appointment: give the money back rather than leave the patient charged for nothing.
      console.error("Appointment creation failed after payment:", error);
      try {
        const refund = await refundPayment(paymentId, claimed.amount);
        await Payment.updateOne({ _id: claimed._id }, { status: "refunded", refundId: refund.id });
      } catch (refundError) {
        console.error("Refund after failed booking also failed", paymentId, refundError);
      }
      return NextResponse.json({ error: "We couldn’t create your appointment, and your payment is being returned." }, { status: 500 });
    }
  } catch (error) {
    if (error instanceof PaymentConfigError) return NextResponse.json({ error: error.message }, { status: 503 });
    console.error("Error verifying payment:", error);
    return NextResponse.json({ error: "We couldn’t confirm your payment. Please try again." }, { status: 500 });
  }
}
