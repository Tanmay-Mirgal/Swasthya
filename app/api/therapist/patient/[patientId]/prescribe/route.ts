import { NextResponse } from "next/server";
import { createClerkClient } from "@clerk/backend";
import connectToDatabase from "@/lib/mongodb";
import TherapistAssignment from "@/lib/models/TherapistAssignment";
import ExerciseAssignment from "@/lib/models/ExerciseAssignment";
import User from "@/lib/models/User";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

export async function POST(
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

    const body = await req.json();
    const { exerciseId, targetSets, targetReps } = body;

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

    const exerciseAssignment = await ExerciseAssignment.create({
       patientId,
       therapistId: clerkUserId,
       exerciseId,
       type: "assigned",
       status: "active",
       targetSets,
       targetReps
    });

    return NextResponse.json({
      success: true,
      data: exerciseAssignment
    });
  } catch (error) {
    console.error("Error creating prescription:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
