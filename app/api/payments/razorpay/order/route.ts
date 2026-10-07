import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import AppointmentRequest from "@/models/AppointmentRequest";
import TherapistProfile from "@/models/TherapistProfile";
import Payment from "@/models/Payment";
import { getIdentityFromRequest } from "@/lib/realtime/auth/verifier";
import { createOrder, PaymentConfigError, razorpayKeyId } from "@/lib/payments/razorpay";
import { parseScheduledAt } from "@/app/api/patient/appointment-request/route";

export const dynamic = "force-dynamic";

const DEFAULT_FEE = 499;

/** Step 1 of booking: price the consultation on the server and open a Razorpay order. */
export async function POST(req: Request) {
  try {
    const me = await getIdentityFromRequest(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (me.role !== "patient") return NextResponse.json({ error: "Only patients can book appointments." }, { status: 403 });

    const { therapistId, requestedDate, requestedTime, scheduledAt: clientScheduledAt, patientNote } = await req.json();
    if (!therapistId || typeof therapistId !== "string") return NextResponse.json({ error: "Therapist ID is required" }, { status: 400 });

    const scheduledAt = clientScheduledAt ? new Date(clientScheduledAt) : parseScheduledAt(requestedDate, requestedTime);
    if (Number.isNaN(scheduledAt.getTime())) return NextResponse.json({ error: "Choose a valid date and time." }, { status: 400 });
    if (scheduledAt.getTime() < Date.now() - 5 * 60_000) return NextResponse.json({ error: "Choose a time in the future." }, { status: 400 });

    await connectToDatabase();

    const profile = await TherapistProfile.findOne({ clerkUserId: therapistId }).lean<{ consultationFee?: number }>();
    if (!profile) return NextResponse.json({ error: "Physiotherapist not found." }, { status: 404 });

    const existing = await AppointmentRequest.findOne({ patientId: me.userId, therapistId, status: "pending" });
    if (existing) {
      return NextResponse.json({ error: "An appointment request is already pending review with this therapist." }, { status: 400 });
    }

    // The amount always comes from the therapist's profile, never from the client.
    const fee = profile.consultationFee || DEFAULT_FEE;
    const amountPaise = Math.round(fee * 100);

    const order = await createOrder({
      amountPaise,
      receipt: `appt_${Date.now().toString(36)}`,
      notes: { patientId: me.userId, therapistId },
    });

    await Payment.create({
      orderId: order.id,
      patientId: me.userId,
      therapistId,
      amount: amountPaise,
      currency: order.currency,
      booking: {
        requestedDate,
        requestedTime: requestedTime || "10:00 AM",
        scheduledAt,
        patientNote: typeof patientNote === "string" ? patientNote.trim().slice(0, 1000) : "",
      },
    });

    return NextResponse.json({
      success: true,
      data: { keyId: razorpayKeyId(), orderId: order.id, amount: order.amount, currency: order.currency, name: me.name, email: me.email },
    });
  } catch (error) {
    if (error instanceof PaymentConfigError) return NextResponse.json({ error: error.message }, { status: 503 });
    console.error("Error creating payment order:", error);
    return NextResponse.json({ error: "We couldn’t start the payment. Please try again." }, { status: 500 });
  }
}
