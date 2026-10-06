import { NextResponse } from "next/server";
import mongoose from "mongoose";
import WeeklyReview from "@/models/WeeklyReview";
import Recording from "@/models/Recording";
import Prescription from "@/models/Prescription";
import { HttpError, errorResponse, patientTimezone, readJson, requirePatient } from "@/lib/rehab/auth";
import { recordingStorage, ALLOWED_RECORDING_TYPES, MAX_RECORDING_BYTES } from "@/lib/storage/recordingStorage";
import { dateKeyInTimezone } from "@/lib/rehab/dates";
import { generateWeeklyReport } from "@/lib/rehab/weeklyReport";

export const dynamic = "force-dynamic";

/**
 * Confirms an upload. The server re-checks the object in storage (it exists, is a video,
 * is within the size cap, and lives under this patient's own path for this review) before
 * recording it, so a client cannot attach somebody else's file or an arbitrary blob.
 * A retake replaces the earlier clip, which is deleted from storage.
 */
export async function POST(req: Request) {
  try {
    const me = await requirePatient(req);
    const body = await readJson<{ reviewId?: string; pathname?: string; durationSeconds?: number }>(req);
    if (!body.reviewId || !mongoose.isValidObjectId(body.reviewId)) throw new HttpError(400, "Choose which weekly review this recording is for.");
    const review = await WeeklyReview.findById(body.reviewId);
    if (!review || review.patientId !== me.userId) throw new HttpError(404, "Review not found.");
    if (!review.recordingRequired) throw new HttpError(409, "Your therapist did not ask for a recording this week.");
    if (review.status === "reviewed") throw new HttpError(409, "This week has already been reviewed.");

    const prefix = `recordings/${me.userId}/${review._id.toString()}/`;
    const pathname = typeof body.pathname === "string" ? body.pathname : "";
    if (!pathname.startsWith(prefix) || pathname.includes("..")) throw new HttpError(400, "That file is not part of this review.");

    const storage = recordingStorage();
    const meta = await storage.head(pathname);
    if (!meta) throw new HttpError(404, "The upload could not be found. Please record again.");
    const type = meta.contentType.split(";")[0].trim().toLowerCase();
    if (!(ALLOWED_RECORDING_TYPES as readonly string[]).includes(type) || meta.size > MAX_RECORDING_BYTES || meta.size <= 0) {
      await storage.remove(pathname).catch(() => {});
      throw new HttpError(400, "That file is not an accepted exercise recording.");
    }

    const prescription = await Prescription.findById(review.prescriptionId, { exercises: 1 }).lean<{ exercises: { _id: mongoose.Types.ObjectId; exerciseId: string }[] }>();
    const exercise = prescription?.exercises.find((e) => e._id.toString() === review.recordingExerciseKey);
    const dur = Number(body.durationSeconds);

    const previous = review.recordingId ? await Recording.findById(review.recordingId) : null;
    const recording = await Recording.create({
      patientId: me.userId,
      doctorId: review.doctorId,
      prescriptionId: review.prescriptionId,
      reviewId: review._id.toString(),
      weekNumber: review.weekNumber,
      exerciseKey: review.recordingExerciseKey,
      exerciseId: exercise?.exerciseId,
      dateKey: dateKeyInTimezone(new Date(), await patientTimezone(me.userId)),
      pathname,
      contentType: type,
      sizeBytes: meta.size,
      durationSeconds: Number.isFinite(dur) && dur > 0 && dur < 3600 ? Math.round(dur) : undefined,
    });
    review.recordingId = recording._id.toString();
    await review.save();

    if (previous) {
      await storage.remove(previous.pathname).catch((e) => console.error("[recordings] could not delete replaced clip:", e));
      await previous.deleteOne();
    }
    // If the report already exists, refresh it so "recording attached" is true.
    if (review.report) await generateWeeklyReport(review._id.toString(), dateKeyInTimezone(new Date(), "Etc/GMT-14"), { force: true }).catch(() => {});

    return NextResponse.json({ success: true, data: { id: recording._id.toString(), sizeBytes: recording.sizeBytes, durationSeconds: recording.durationSeconds ?? null } }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
