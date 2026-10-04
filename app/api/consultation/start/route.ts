import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import Consultation from "@/models/Consultation";
import PatientProfile from "@/models/PatientProfile";
import TherapistProfile from "@/models/TherapistProfile";
import ChatMessage from "@/models/ChatMessage";
import { ensureSeedDoctors } from "@/services/doctors/doctorService";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    let clerkUserId = "guest_patient";

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const { verifyToken } = await import("@clerk/backend");
        const verified = await verifyToken(token, {
          secretKey: process.env.CLERK_SECRET_KEY,
        });
        if (verified.sub) clerkUserId = verified.sub;
      } catch (err) {
        console.warn("Auth token fallback to guest_patient");
      }
    }

    const body = await req.json();
    const { doctorId, issue } = body;

    if (!doctorId) {
      return NextResponse.json({ error: "doctorId is required" }, { status: 400 });
    }

    await connectToDatabase();
    await ensureSeedDoctors();

    // Determine issue from patient profile if not specified
    let patientIssue = issue;
    if (!patientIssue) {
      const patientProfile = await PatientProfile.findOne({ clerkUserId }).lean();
      if (patientProfile && patientProfile.concerns && patientProfile.concerns.length > 0) {
        patientIssue = patientProfile.concerns.join(", ");
      } else {
        patientIssue = "Knee Rehabilitation & Pain Recovery";
      }
    }

    // Look for an existing ACTIVE consultation between patient and doctor
    let consultation = await Consultation.findOne({
      patientId: clerkUserId,
      doctorId,
      status: "ACTIVE",
    }).sort({ createdAt: -1 });

    if (!consultation) {
      // Create new consultation
      consultation = await Consultation.create({
        patientId: clerkUserId,
        doctorId,
        issue: patientIssue,
        status: "ACTIVE",
        callStatus: "idle",
        startedAt: new Date(),
      });

      // Insert welcoming care team message
      await ChatMessage.create({
        consultationId: consultation._id.toString(),
        senderId: doctorId,
        senderRole: "doctor",
        receiverId: clerkUserId,
        content: `Hello! I have reviewed your concern (${patientIssue}). How can I assist your recovery today? You can send messages here or click Start Video Consultation.`,
        type: "text",
        read: false,
      });
    }

    const doctorProfile = await TherapistProfile.findOne({ clerkUserId: doctorId }).lean();

    return NextResponse.json({
      success: true,
      data: {
        consultation,
        doctor: doctorProfile,
      },
    });
  } catch (error) {
    console.error("Error starting consultation:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
