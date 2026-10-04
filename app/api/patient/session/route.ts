import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import ExerciseSession from "@/lib/models/ExerciseSession";

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

    const sessions = await ExerciseSession.find({ patientId: clerkUserId })
      .sort({ date: -1 })
      .limit(50)
      .lean();

    const totalSessions = sessions.length;
    const totalReps = sessions.reduce((acc: number, s: any) => acc + (s.completedReps || 0), 0);
    const avgRom =
      totalSessions > 0
        ? Math.round(sessions.reduce((acc: number, s: any) => acc + (s.rom || 0), 0) / totalSessions)
        : 0;

    const latestSession = sessions.length > 0 ? sessions[0] : null;

    return NextResponse.json({
      success: true,
      data: {
        sessions,
        stats: {
          totalSessions,
          totalReps,
          avgRom,
        },
        latestSession,
      },
    });
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
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

    const body = await req.json();
    await connectToDatabase();

    const newSession = await ExerciseSession.create({
      patientId: clerkUserId,
      exerciseId: body.exerciseId,
      exerciseName: body.exerciseName,
      durationSeconds: body.durationSeconds || 0,
      completedReps: body.completedReps || 0,
      targetReps: body.targetReps || 10,
      rom: body.rom || 0,
      targetRom: body.targetRom || 90,
      formAccuracy: body.formAccuracy || 95,
      targetMet: body.targetMet || false,
      date: body.date ? new Date(body.date) : new Date(),
    });

    return NextResponse.json({
      success: true,
      data: newSession,
    });
  } catch (error) {
    console.error("Error saving exercise session:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
