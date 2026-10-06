import { NextResponse } from "next/server";
import mongoose from "mongoose";
import WeeklyReview from "@/models/WeeklyReview";
import Prescription from "@/models/Prescription";
import User from "@/models/User";
import { HttpError, errorResponse, readJson, requireIdentity, requireTherapist } from "@/lib/rehab/auth";
import { dayEndedEverywhere } from "@/lib/rehab/dates";
import { generateWeeklyReport } from "@/lib/rehab/weeklyReport";
import { issueLabel } from "@/lib/rehab/issueLabels";
import { notifyTherapistFeedback } from "@/lib/rehab/notifier";

export const dynamic = "force-dynamic";

async function loadFor(id: string, userId: string) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, "That review id is not valid.");
  const review = await WeeklyReview.findById(id);
  if (!review || (review.patientId !== userId && review.doctorId !== userId)) throw new HttpError(404, "Review not found.");
  return review;
}

/** The patient the review is about, or the therapist who owns it. Nobody else. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const me = await requireIdentity(req);
    let review = await loadFor(id, me.userId);
    const isTherapist = review.doctorId === me.userId;

    // A review day that has ended but has no report yet is completed on first look.
    if (isTherapist && !review.report && review.status !== "reviewed" && review.dueDate < dayEndedEverywhere()) {
      review = ((await generateWeeklyReport(review._id.toString(), dayEndedEverywhere())) as typeof review | null) ?? review;
    }

    const [patient, prescription] = await Promise.all([
      User.findOne({ clerkUserId: review.patientId }, { firstName: 1, lastName: 1, imageUrl: 1 }).lean<{ firstName?: string; lastName?: string; imageUrl?: string }>(),
      Prescription.findById(review.prescriptionId, { startDate: 1, endDate: 1, version: 1, doctorName: 1, status: 1 }).lean(),
    ]);

    const report = review.report
      ? { ...review.report, commonFeedback: (review.report.commonFeedback ?? []).map((f) => ({ ...f, label: issueLabel(f.code) })) }
      : null;

    return NextResponse.json({
      success: true,
      data: {
        id: review._id.toString(),
        weekNumber: review.weekNumber,
        dueDate: review.dueDate,
        status: review.status,
        recordingRequired: review.recordingRequired,
        recordingId: review.recordingId ?? null,
        patientId: review.patientId,
        patientName: patient?.firstName ? `${patient.firstName} ${patient.lastName ?? ""}`.trim() : "Patient",
        prescription: prescription ? { id: review.prescriptionId, startDate: prescription.startDate, endDate: prescription.endDate, version: prescription.version } : null,
        report,
        therapistNotes: review.therapistNotes ?? null,
        reviewedAt: review.reviewedAt ?? null,
        viewerRole: isTherapist ? "therapist" : "patient",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Therapist: write the review note and mark the week reviewed. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const me = await requireTherapist(req);
    const body = await readJson<{ notes?: string; markReviewed?: boolean }>(req);
    const review = await loadFor(id, me.userId);
    if (review.doctorId !== me.userId) throw new HttpError(404, "Review not found.");

    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 4000) : undefined;
    if (notes !== undefined) review.therapistNotes = notes || undefined;
    if (body.markReviewed) {
      if (!review.report) throw new HttpError(409, "The report is not ready yet.");
      review.status = "reviewed";
      review.reviewedAt = new Date();
      review.reviewedBy = me.userId;
    }
    await review.save();

    if (body.markReviewed && review.therapistNotes) {
      notifyTherapistFeedback({
        patientId: review.patientId,
        therapistName: me.name,
        sessionId: `week:${review._id.toString()}`,
        exerciseName: `week ${review.weekNumber}`,
        note: review.therapistNotes,
      }).catch((e) => console.error("[rehab] review notification failed:", e));
    }
    return NextResponse.json({ success: true, data: { status: review.status, therapistNotes: review.therapistNotes ?? null, reviewedAt: review.reviewedAt ?? null } });
  } catch (error) {
    return errorResponse(error);
  }
}
