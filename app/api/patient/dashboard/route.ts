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
      const User = (await import("@/lib/models/User")).default;
      const user = await User.findOne({ clerkUserId }).lean();
      const therapist = await TherapistProfile.findOne({ clerkUserId }).lean();
      if (user?.role === "therapist" || therapist) {
        return NextResponse.json({
          success: false,
          isTherapist: true,
          redirect: "/therapist",
        });
      }
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

    const ExerciseSession = (await import("@/lib/models/ExerciseSession")).default;
    const dbSessions = await ExerciseSession.find({ patientId: clerkUserId }).sort({ date: -1 }).limit(20).lean();
    
    const totalSessions = dbSessions.length;
    const totalReps = dbSessions.reduce((acc: number, s: any) => acc + (s.completedReps || 0), 0);
    const avgRom =
      totalSessions > 0
        ? Math.round(dbSessions.reduce((acc: number, s: any) => acc + (s.rom || 0), 0) / totalSessions)
        : 0;
    const latestDbSession = dbSessions.length > 0 ? dbSessions[0] : null;

    // Execute Clinical Recommendation Engine
    const { getClinicalRecommendations } = await import("@/lib/recommendations/recommendationEngine");
    const activePrescriptions = exerciseAssignments.map((a: any) => ({
      exerciseId: a.exerciseId,
      targetSets: a.targetSets,
      targetReps: a.targetReps,
    }));
    const recentSessionExerciseIds = dbSessions.map((s: any) => s.exerciseId).filter(Boolean);
    const recommendationData = getClinicalRecommendations({
      concerns: profile?.concerns || [],
      activePrescriptions,
      recentSessionExerciseIds,
    });

    const Consultation = (await import("@/lib/models/Consultation")).default;
    const activeConsultation = await Consultation.findOne({
      patientId: clerkUserId,
    }).sort({ updatedAt: -1 }).lean();

    let consultationDoctor = null;
    if (activeConsultation) {
      consultationDoctor = await TherapistProfile.findOne({ clerkUserId: activeConsultation.doctorId }).lean();
    }

    return NextResponse.json({
      success: true,
      data: {
        profile,
        assignment,
        therapist: therapist || consultationDoctor,
        activeConsultation,
        consultationDoctor,
        appointmentRequests,
        pendingRequest,
        requestedTherapist,
        exerciseAssignments,
        recommendation: recommendationData.primary,
        rankedRecommendations: recommendationData.ranked,
        sessions: dbSessions,
        stats: {
          totalSessions,
          totalReps,
          avgRom,
        },
        latestSession: latestDbSession,
      }
    });
  } catch (error) {
    console.error("Error fetching patient dashboard data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
