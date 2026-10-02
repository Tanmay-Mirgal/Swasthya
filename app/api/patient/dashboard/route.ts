import { NextResponse } from "next/server";
import { createClerkClient } from "@clerk/backend";
import connectToDatabase from "@/lib/mongodb";
import PatientProfile from "@/lib/models/PatientProfile";
import TherapistAssignment from "@/lib/models/TherapistAssignment";
import TherapistProfile from "@/lib/models/TherapistProfile";
import ExerciseAssignment from "@/lib/models/ExerciseAssignment";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

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

    const profile = await PatientProfile.findOne({ clerkUserId }).lean();
    if (!profile) {
      return NextResponse.json({ error: "Patient profile not found" }, { status: 404 });
    }

    const assignment = await TherapistAssignment.findOne({ patientId: clerkUserId, status: "active" }).lean();
    let therapist = null;

    if (assignment && assignment.therapistId) {
      therapist = await TherapistProfile.findOne({ clerkUserId: assignment.therapistId }).lean();
    }

    const appointmentRequests = await (await import("@/lib/models/AppointmentRequest")).default.find({ patientId: clerkUserId }).sort({ createdAt: -1 }).lean();
    const pendingRequest = appointmentRequests.find((r: any) => r.status === "pending");
    let requestedTherapist = null;
    
    if (pendingRequest) {
       requestedTherapist = await TherapistProfile.findOne({ clerkUserId: pendingRequest.therapistId }).lean();
    }

    const exerciseAssignments = await ExerciseAssignment.find({ patientId: clerkUserId, status: "active" }).lean();

    return NextResponse.json({
      success: true,
      data: {
        profile,
        assignment,
        therapist,
        appointmentRequests,
        pendingRequest,
        requestedTherapist,
        exerciseAssignments,
      }
    });
  } catch (error) {
    console.error("Error fetching patient dashboard data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
