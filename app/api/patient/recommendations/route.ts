import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import PatientProfile from "@/lib/models/PatientProfile";
import ExerciseAssignment from "@/lib/models/ExerciseAssignment";
import ExerciseSession from "@/lib/models/ExerciseSession";
import { getClinicalRecommendations } from "@/lib/recommendations/recommendationEngine";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    let clerkUserId: string | null = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const { verifyToken } = await import("@clerk/backend");
      const verified = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
      clerkUserId = verified?.sub || null;
    }

    // Default concerns fallback if unauthenticated or new user
    let concerns: string[] = ["Knee Rehabilitation", "Range of Motion"];
    let activePrescriptions: { exerciseId: string; targetSets?: number; targetReps?: number }[] = [];
    let recentSessionExerciseIds: string[] = [];

    if (clerkUserId) {
      await connectToDatabase();

      const profile = await PatientProfile.findOne({ clerkUserId }).lean();
      if (profile && Array.isArray(profile.concerns) && profile.concerns.length > 0) {
        concerns = profile.concerns;
      }

      const assignments = await ExerciseAssignment.find({
        patientId: clerkUserId,
        status: "active",
      }).lean();

      activePrescriptions = assignments.map((a: any) => ({
        exerciseId: a.exerciseId,
        targetSets: a.targetSets,
        targetReps: a.targetReps,
      }));

      const recentSessions = await ExerciseSession.find({ patientId: clerkUserId })
        .sort({ date: -1 })
        .limit(10)
        .lean();

      recentSessionExerciseIds = recentSessions.map((s: any) => s.exerciseId).filter(Boolean);
    }

    const recommendationData = getClinicalRecommendations({
      concerns,
      activePrescriptions,
      recentSessionExerciseIds,
    });

    return NextResponse.json({
      success: true,
      data: recommendationData,
    });
  } catch (error) {
    console.error("Error generating clinical recommendations:", error);
    // Graceful fallback to default recommendations without crashing
    const fallback = getClinicalRecommendations({
      concerns: ["General Recovery"],
    });
    return NextResponse.json({ success: true, data: fallback });
  }
}
