import { NextResponse } from "next/server";
import WeeklyReview from "@/models/WeeklyReview";
import User from "@/models/User";
import { errorResponse, requireTherapist } from "@/lib/rehab/auth";
import { dayEndedEverywhere } from "@/lib/rehab/dates";
import { generateWeeklyReport } from "@/lib/rehab/weeklyReport";

export const dynamic = "force-dynamic";

/**
 * Therapist: weekly reviews for the patients in their care, newest first. Reviews whose
 * day has passed without a report are generated here, so the list never shows a stale
 * "upcoming" week that is really due.
 */
export async function GET(req: Request) {
  try {
    const me = await requireTherapist(req);
    const status = new URL(req.url).searchParams.get("status");

    // A review is only closed out once its day has ended everywhere, whatever the patient's timezone.
    const cutoff = dayEndedEverywhere();
    const stale = await WeeklyReview.find({ doctorId: me.userId, status: { $in: ["upcoming", "recording_due"] }, dueDate: { $lt: cutoff } });
    for (const r of stale) {
      await generateWeeklyReport(r._id.toString(), cutoff).catch((e) => console.error("[reviews] report failed:", e));
    }

    // "upcoming" reviews stay hidden until their day, except ones the patient already sent a recording for.
    const filter: Record<string, unknown> = { doctorId: me.userId, $or: [{ status: { $ne: "upcoming" } }, { recordingId: { $exists: true, $ne: null } }] };
    if (status && ["recording_due", "report_ready", "reviewed"].includes(status)) {
      delete filter.$or;
      filter.status = status;
    }
    const reviews = await WeeklyReview.find(filter).sort({ dueDate: -1 }).limit(100).lean();

    const patientIds = [...new Set(reviews.map((r) => r.patientId))];
    const users = await User.find({ clerkUserId: { $in: patientIds } }, { clerkUserId: 1, firstName: 1, lastName: 1, imageUrl: 1 }).lean<{ clerkUserId: string; firstName?: string; lastName?: string; imageUrl?: string }[]>();
    const nameOf = new Map(users.map((u) => [u.clerkUserId, u]));
    const lastReviewed = new Map<string, Date>();
    for (const r of reviews) if (r.reviewedAt && (!lastReviewed.get(r.patientId) || r.reviewedAt > lastReviewed.get(r.patientId)!)) lastReviewed.set(r.patientId, r.reviewedAt);

    return NextResponse.json({
      success: true,
      data: reviews.map((r) => {
        const u = nameOf.get(r.patientId);
        return {
          id: r._id.toString(),
          patientId: r.patientId,
          patientName: u?.firstName ? `${u.firstName} ${u.lastName ?? ""}`.trim() : "Patient",
          patientImage: u?.imageUrl,
          prescriptionId: r.prescriptionId,
          weekNumber: r.weekNumber,
          dueDate: r.dueDate,
          status: r.status,
          recordingRequired: r.recordingRequired,
          recordingAttached: Boolean(r.recordingId),
          adherencePercent: r.report?.adherencePercent ?? null,
          qualityChange: r.report?.qualityChange ?? null,
          reviewedAt: r.reviewedAt ?? null,
          lastReviewedAt: lastReviewed.get(r.patientId) ?? null,
        };
      }),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
