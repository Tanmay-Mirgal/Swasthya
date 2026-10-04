import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import PatientProfile from "@/models/PatientProfile";
import TherapistAssignment from "@/models/TherapistAssignment";
import TherapistProfile from "@/models/TherapistProfile";
import ExerciseAssignment from "@/models/ExerciseAssignment";

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
      const User = (await import("@/models/User")).default;
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

    interface AppointmentRequestDoc {
      _id: unknown;
      patientId: string;
      therapistId: string;
      status: string;
      scheduledAt?: Date | string;
      requestedDate?: Date | string;
      createdAt: Date | string;
      duration?: number;
      consultationId?: string;
    }

    interface DbSessionDoc {
      completedReps?: number;
      rom?: number;
      exerciseId?: string;
      date?: Date;
    }

    interface ExerciseAssignmentDoc {
      exerciseId: string;
      targetSets?: number;
      targetReps?: number;
    }

    const appointmentRequests = (await (await import("@/models/AppointmentRequest")).default.find({ patientId: clerkUserId }).sort({ createdAt: -1 }).lean()) as unknown as AppointmentRequestDoc[];
    const pendingRequest = appointmentRequests.find((r) => r.status === "pending");
    let requestedTherapist = null;
    
    if (pendingRequest) {
       requestedTherapist = await TherapistProfile.findOne({ clerkUserId: pendingRequest.therapistId }).lean();
    }

    const rawExerciseAssignments = await ExerciseAssignment.find({ patientId: clerkUserId, status: "active" }).lean();
    const exerciseAssignments = rawExerciseAssignments as unknown as ExerciseAssignmentDoc[];

    const ExerciseSession = (await import("@/models/ExerciseSession")).default;
    const rawDbSessions = await ExerciseSession.find({ patientId: clerkUserId }).sort({ date: -1 }).limit(20).lean();
    const dbSessions = rawDbSessions as unknown as DbSessionDoc[];
    
    const totalSessions = dbSessions.length;
    const totalReps = dbSessions.reduce((acc: number, s) => acc + (s.completedReps || 0), 0);
    const avgRom =
      totalSessions > 0
        ? Math.round(dbSessions.reduce((acc: number, s) => acc + (s.rom || 0), 0) / totalSessions)
        : 0;
    const latestDbSession = dbSessions.length > 0 ? dbSessions[0] : null;

    // Execute Clinical Recommendation Engine
    const { getClinicalRecommendations } = await import("@/lib/recommendations/recommendationEngine");
    const activePrescriptions = exerciseAssignments.map((a) => ({
      exerciseId: a.exerciseId,
      targetSets: a.targetSets,
      targetReps: a.targetReps,
    }));
    const recentSessionExerciseIds = dbSessions.map((s) => s.exerciseId).filter((id): id is string => Boolean(id));
    const recommendationData = getClinicalRecommendations({
      concerns: profile?.concerns || [],
      activePrescriptions,
      recentSessionExerciseIds,
    });

    const AppointmentRequest = (await import("@/models/AppointmentRequest")).default;
    const rawAccepted = await AppointmentRequest.find({
      patientId: clerkUserId,
      status: "accepted",
    }).lean();
    const acceptedAppointments = rawAccepted as unknown as AppointmentRequestDoc[];

    const { canJoinConsultation } = await import("@/types/appointment");
    const now = new Date();
    const liveAppointment = acceptedAppointments.find((a) =>
      canJoinConsultation(a.status, a.scheduledAt || a.requestedDate || a.createdAt, a.duration || 30, now)
    );

    let activeConsultation = null;
    let consultationDoctor = null;
    if (liveAppointment && liveAppointment.consultationId) {
      const Consultation = (await import("@/models/Consultation")).default;
      activeConsultation = await Consultation.findById(liveAppointment.consultationId).lean();
      if (activeConsultation) {
        consultationDoctor = await TherapistProfile.findOne({ clerkUserId: activeConsultation.doctorId }).lean();
      }
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
