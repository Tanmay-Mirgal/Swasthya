import { NextResponse } from "next/server";
import WeeklyReview from "@/models/WeeklyReview";
import { errorResponse, requirePatient } from "@/lib/rehab/auth";

export const dynamic = "force-dynamic";

/** The signed-in patient's own weekly reports, newest first. Upcoming weeks are not listed. */
export async function GET(req: Request) {
  try {
    const me = await requirePatient(req);
    const reviews = await WeeklyReview.find({ patientId: me.userId, status: { $in: ["recording_due", "report_ready", "reviewed"] } }).sort({ dueDate: -1 }).limit(60).lean();
    return NextResponse.json({
      success: true,
      data: reviews.map((r) => ({
        id: r._id.toString(),
        weekNumber: r.weekNumber,
        dueDate: r.dueDate,
        status: r.status,
        adherencePercent: r.report?.adherencePercent ?? null,
        recordingAttached: Boolean(r.recordingId),
        reviewed: r.status === "reviewed",
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
