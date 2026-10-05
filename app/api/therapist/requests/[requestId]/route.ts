import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import AppointmentRequest from "@/models/AppointmentRequest";
import TherapistAssignment from "@/models/TherapistAssignment";
import Consultation from "@/models/Consultation";
import User from "@/models/User";
import { parseScheduledAt } from "@/app/api/patient/appointment-request/route";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params;

    if (!requestId) {
      return NextResponse.json({ error: "Request ID is required" }, { status: 400 });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const { verifyToken } = await import("@clerk/backend");
    const verified = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
    const clerkUserId = verified?.sub;

    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    // Verify user role
    const user = await User.findOne({ clerkUserId }).lean();
    const TherapistProfile = (await import("@/models/TherapistProfile")).default;
    const therapistProfile = await TherapistProfile.findOne({ clerkUserId }).lean();

    if ((!user || user.role !== "therapist") && !therapistProfile) {
      return NextResponse.json({ error: "Forbidden: Not a therapist" }, { status: 403 });
    }

    const { action } = await req.json();

    if (action !== "accept" && action !== "decline") {
      return NextResponse.json({ error: "Invalid action. Must be 'accept' or 'decline'" }, { status: 400 });
    }

    const appointmentRequest = await AppointmentRequest.findById(requestId);

    if (!appointmentRequest) {
      return NextResponse.json({ error: "Appointment request not found" }, { status: 404 });
    }

    if (appointmentRequest.therapistId !== clerkUserId) {
      return NextResponse.json({ error: "Forbidden: Request does not belong to you" }, { status: 403 });
    }

    if (appointmentRequest.status !== "pending") {
      return NextResponse.json({ error: `Request is already ${appointmentRequest.status}` }, { status: 400 });
    }

    if (action === "accept") {
      appointmentRequest.status = "accepted";

      // Ensure scheduledAt is accurately computed
      if (!appointmentRequest.scheduledAt) {
        appointmentRequest.scheduledAt = parseScheduledAt(
          appointmentRequest.requestedDate,
          appointmentRequest.requestedTime
        );
      }

      // Create linked Consultation record dedicated to this appointment
      const consultation = await Consultation.create({
        appointmentId: appointmentRequest._id.toString(),
        patientId: appointmentRequest.patientId,
        doctorId: clerkUserId,
        issue: appointmentRequest.patientNote || "Rehabilitation Consultation",
        status: "ACTIVE",
        roomStatus: "SCHEDULED",
        scheduledAt: appointmentRequest.scheduledAt,
        requestedTime: appointmentRequest.requestedTime,
        duration: appointmentRequest.duration || 30,
      });

      appointmentRequest.consultationId = consultation._id.toString();
      await appointmentRequest.save();

      // Activate Therapist Assignment
      await TherapistAssignment.findOneAndUpdate(
        { patientId: appointmentRequest.patientId, therapistId: clerkUserId },
        { status: "active", assignedAt: new Date() },
        { upsert: true, new: true }
      );
    } else if (action === "decline") {
      appointmentRequest.status = "declined";
      await appointmentRequest.save();
    }

    return NextResponse.json({
      success: true,
      data: {
        status: appointmentRequest.status,
        consultationId: appointmentRequest.consultationId,
        scheduledAt: appointmentRequest.scheduledAt,
      },
    });
  } catch (error) {
    console.error("Error processing appointment request:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
