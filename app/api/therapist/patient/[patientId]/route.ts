import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import PatientProfile from "@/models/PatientProfile";
import TherapistAssignment from "@/models/TherapistAssignment";
import Prescription from "@/models/Prescription";
import WeeklyReview from "@/models/WeeklyReview";
import { adherenceForPlans } from "@/lib/rehab/adherence";
import { serializePrescription } from "@/lib/rehab/sessionService";
import User from "@/models/User";

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
    // This therapist's plans for the patient: the live one plus the versioned history.
    const plans = await Prescription.find({ patientId, doctorId: clerkUserId }).sort({ createdAt: -1 }).limit(20);
    const livePlan = plans.find((p) => p.status === "active" || p.status === "paused") ?? null;
    const adherence = livePlan ? (await adherenceForPlans([livePlan], 14)).get(livePlan._id.toString()) : undefined;
    const reviews = livePlan ? await WeeklyReview.find({ prescriptionId: livePlan._id.toString() }).sort({ weekNumber: 1 }).lean() : [];
    const exerciseAssignments = (livePlan?.exercises ?? []).map((e) => ({
      exerciseId: e.exerciseId,
      exerciseName: e.name,
      targetSets: e.sets,
      targetReps: e.reps,
      targetRom: e.targetRom,
      holdSeconds: e.holdSeconds,
      tempoSeconds: e.tempoSeconds,
      frequency: livePlan?.frequency,
      instructions: e.instructions,
      modifications: e.modifications,
      status: "active",
    }));

    const ExerciseSession = (await import("@/models/ExerciseSession")).default;
    const rawSessions = await ExerciseSession.find({ patientId }).sort({ date: -1 }).limit(60).lean();
    const sessions = (rawSessions as unknown as {
      _id: { toString(): string };
      exerciseId: string;
      exerciseName: string;
      date: Date;
      completedReps: number;
      targetReps: number;
      rom?: number;
      durationSeconds?: number;
      targetMet?: boolean;
      therapistNote?: string;
      therapistAssessment?: string;
      reviewedAt?: Date;
    }[]).map((s) => ({
      id: s._id.toString(),
      exerciseId: s.exerciseId,
      exerciseName: s.exerciseName,
      date: s.date,
      completedReps: s.completedReps,
      targetReps: s.targetReps,
      rom: s.rom || 0,
      durationSeconds: s.durationSeconds || 0,
      targetMet: Boolean(s.targetMet),
      therapistNote: s.therapistNote,
      therapistAssessment: s.therapistAssessment,
      reviewedAt: s.reviewedAt,
    }));

    const ChatMessage = (await import("@/models/ChatMessage")).default;
    const unreadMessages = await ChatMessage.countDocuments({ senderId: patientId, receiverId: clerkUserId, read: false });

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
        plan: livePlan
          ? {
              ...serializePrescription(livePlan),
              medicines: livePlan.medicines,
              statusHistory: livePlan.statusHistory,
              adherence: adherence ?? null,
              weeklyReviews: reviews.map((r) => ({
                id: r._id.toString(),
                weekNumber: r.weekNumber,
                dueDate: r.dueDate,
                status: r.status,
                recordingRequired: r.recordingRequired,
                recordingAttached: Boolean(r.recordingId),
                adherencePercent: r.report?.adherencePercent ?? null,
              })),
            }
          : null,
        planHistory: plans.map((p) => ({
          id: p._id.toString(),
          version: p.version,
          status: p.status,
          startDate: p.startDate,
          endDate: p.endDate,
          exerciseCount: p.exercises.length,
          closedReason: p.closedReason,
          createdAt: p.createdAt,
        })),
        sessions,
        unreadMessages,
        assignedAt: (assignment as { assignedAt?: Date }).assignedAt,
      }
    });
  } catch (error) {
    console.error("Error fetching patient detail:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
