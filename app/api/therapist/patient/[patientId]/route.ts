import { NextResponse } from "next/server";
import { createClerkClient } from "@clerk/backend";
import connectToDatabase from "@/lib/mongodb";
import PatientProfile from "@/lib/models/PatientProfile";
import TherapistAssignment from "@/lib/models/TherapistAssignment";
import ExerciseAssignment from "@/lib/models/ExerciseAssignment";
import User from "@/lib/models/User";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ patientId: string }> }
) {
  try {
    const { patientId } = await params;
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

    // Verify therapist
    const user = await User.findOne({ clerkUserId });
    if (!user || user.role !== "therapist") {
      return NextResponse.json({ error: "Forbidden: Not a therapist" }, { status: 403 });
    }

    // Verify assignment
    const assignment = await TherapistAssignment.findOne({ 
      patientId: patientId,
      therapistId: clerkUserId 
    }).lean();

    if (!assignment) {
      return NextResponse.json({ error: "Patient not assigned to you" }, { status: 403 });
    }

    const patientUser = await User.findOne({ clerkUserId: patientId }).lean();
    const patientProfile = await PatientProfile.findOne({ clerkUserId: patientId }).lean();
    const exerciseAssignments = await ExerciseAssignment.find({ patientId: patientId }).lean();

    return NextResponse.json({
      success: true,
      data: {
        user: {
           firstName: patientUser?.firstName,
           lastName: patientUser?.lastName,
           email: patientUser?.email,
           imageUrl: patientUser?.imageUrl,
        },
        profile: patientProfile,
        exerciseAssignments,
      }
    });
  } catch (error) {
    console.error("Error fetching patient detail:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
