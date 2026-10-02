import { NextResponse } from "next/server";
import { createClerkClient } from "@clerk/backend";
import connectToDatabase from "@/lib/mongodb";
import PatientProfile from "@/lib/models/PatientProfile";
import TherapistAssignment from "@/lib/models/TherapistAssignment";
import ExerciseAssignment from "@/lib/models/ExerciseAssignment";
import User from "@/lib/models/User";

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

    // Verify role
    const user = await User.findOne({ clerkUserId });
    if (!user || user.role !== "therapist") {
      return NextResponse.json({ error: "Forbidden: Not a therapist" }, { status: 403 });
    }

    // Get patients assigned to this therapist
    // Get patients assigned to this therapist
    const assignments = await TherapistAssignment.find({ therapistId: clerkUserId, status: "active" }).lean();
    
    const patients = [];
    for (const assignment of assignments) {
      const patientUser = await User.findOne({ clerkUserId: assignment.patientId }).lean();
      const patientProfile = await PatientProfile.findOne({ clerkUserId: assignment.patientId }).lean();
      const exerciseAssignments = await ExerciseAssignment.find({ patientId: assignment.patientId }).lean();
      
      if (patientUser) {
        patients.push({
          assignment,
          user: {
             firstName: patientUser.firstName,
             lastName: patientUser.lastName,
             email: patientUser.email,
             imageUrl: patientUser.imageUrl,
          },
          profile: patientProfile,
          exerciseAssignments
        });
      }
    }

    const AppointmentRequest = (await import("@/lib/models/AppointmentRequest")).default;
    const requestRecords = await AppointmentRequest.find({ therapistId: clerkUserId, status: "pending" }).lean();
    
    const pendingRequests = [];
    for (const req of requestRecords) {
      const patientUser = await User.findOne({ clerkUserId: req.patientId }).lean();
      const patientProfile = await PatientProfile.findOne({ clerkUserId: req.patientId }).lean();
      
      if (patientUser) {
        pendingRequests.push({
          request: req,
          user: {
             firstName: patientUser.firstName,
             lastName: patientUser.lastName,
             imageUrl: patientUser.imageUrl,
          },
          profile: patientProfile,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        patients,
        pendingRequests
      }
    });
  } catch (error) {
    console.error("Error fetching therapist dashboard data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
