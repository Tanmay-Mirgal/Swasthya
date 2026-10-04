import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import PatientProfile from "@/models/PatientProfile";
import TherapistAssignment from "@/models/TherapistAssignment";
import TherapistProfile from "@/models/TherapistProfile";
import Consultation from "@/models/Consultation";
import Prescription from "@/models/Prescription";
import AppointmentRequest from "@/models/AppointmentRequest";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const { verifyToken } = await import("@clerk/backend");
    const verified = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
    const clerkUserId = verified.sub;

    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    // 1. Patient Profile
    const profile = await PatientProfile.findOne({ clerkUserId }).lean();

    // 2. Active Therapist Assignment (Connected Doctor)
    const assignment = await TherapistAssignment.findOne({
      patientId: clerkUserId,
      status: "active",
    }).lean();

    let connectedTherapist: any = null;
    if (assignment && assignment.therapistId) {
      connectedTherapist = await TherapistProfile.findOne({
        clerkUserId: assignment.therapistId,
      }).lean();
    }

    // 3. Pending Appointment Request
    const appointmentRequests = await AppointmentRequest.find({
      patientId: clerkUserId,
    })
      .sort({ createdAt: -1 })
      .lean();

    const pendingRequest = appointmentRequests.find((r: any) => r.status === "pending");
    let requestedTherapist: any = null;
    if (pendingRequest) {
      requestedTherapist = await TherapistProfile.findOne({
        clerkUserId: pendingRequest.therapistId,
      }).lean();
    }

    // 4. All Consultations for this patient
    const rawConsultations = await Consultation.find({
      patientId: clerkUserId,
    })
      .sort({ createdAt: -1 })
      .lean();

    // Collect all doctor clerkUserIds
    const doctorIds = Array.from(
      new Set(rawConsultations.map((c: any) => c.doctorId).filter(Boolean))
    );
    const doctors = await TherapistProfile.find({
      clerkUserId: { $in: doctorIds },
    }).lean();

    const doctorMap = new Map();
    doctors.forEach((d: any) => doctorMap.set(d.clerkUserId, d));

    const enrichedConsultations = rawConsultations.map((c: any) => ({
      ...c,
      doctor: doctorMap.get(c.doctorId) || null,
    }));

    // Active consultation (status !== "COMPLETED" && status !== "CANCELLED", or latest)
    const activeConsultation =
      enrichedConsultations.find((c: any) => c.status === "ACTIVE" || c.status === "REQUESTED") ||
      (enrichedConsultations.length > 0 ? enrichedConsultations[0] : null);

    // If no connected therapist from assignment, fallback to the doctor of the latest consultation
    if (!connectedTherapist && activeConsultation?.doctor) {
      connectedTherapist = activeConsultation.doctor;
    }

    // 5. Latest Prescription
    const latestPrescription = await Prescription.findOne({
      patientId: clerkUserId,
    })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: {
        profile,
        connectedTherapist,
        pendingRequest: pendingRequest
          ? {
              ...pendingRequest,
              therapist: requestedTherapist,
            }
          : null,
        activeConsultation,
        consultations: enrichedConsultations,
        latestPrescription,
      },
    });
  } catch (error) {
    console.error("Error fetching patient appointments:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
