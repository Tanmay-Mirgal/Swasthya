import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import ExerciseSession from "@/models/ExerciseSession";
import TherapistAssignment from "@/models/TherapistAssignment";
import { getIdentityFromRequest } from "@/lib/realtime/auth/verifier";
import { notifyTherapistFeedback } from "@/lib/rehab/notifier";

export const dynamic = "force-dynamic";

const ASSESSMENTS = ["on_track", "needs_work", "concern"] as const;

/** PATCH: a therapist records their own assessment and note on a patient's session. Automated measurements are never changed. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ patientId: string; sessionId: string }> }
) {
  try {
    const { patientId, sessionId } = await params;
    const me = await getIdentityFromRequest(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (me.role !== "doctor") return NextResponse.json({ error: "Forbidden: Not a therapist" }, { status: 403 });

    await connectToDatabase();
    const assigned = await TherapistAssignment.exists({ patientId, therapistId: me.userId, status: "active" });
    if (!assigned) return NextResponse.json({ error: "Patient not assigned to you" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const assessment = ASSESSMENTS.find((a) => a === body?.assessment);
    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 2000) : "";
    if (!assessment && !note) {
      return NextResponse.json({ error: "Add an assessment or a note" }, { status: 400 });
    }

    const updated = await ExerciseSession.findOneAndUpdate(
      { _id: sessionId, patientId },
      {
        $set: {
          therapistAssessment: assessment,
          therapistNote: note || undefined,
          reviewedAt: new Date(),
          reviewedBy: me.userId,
        },
      },
      { returnDocument: "after" }
    );
    if (!updated) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    // Best effort: a mail outage must not undo the therapist's review.
    notifyTherapistFeedback({
      patientId,
      therapistName: me.name,
      sessionId: updated._id.toString(),
      exerciseName: updated.exerciseName,
      note: updated.therapistNote,
    }).catch((e) => console.error("[rehab] feedback notification failed:", e));

    return NextResponse.json({
      success: true,
      data: {
        id: updated._id.toString(),
        therapistAssessment: updated.therapistAssessment,
        therapistNote: updated.therapistNote,
        reviewedAt: updated.reviewedAt,
      },
    });
  } catch (error) {
    console.error("Error saving session review:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
