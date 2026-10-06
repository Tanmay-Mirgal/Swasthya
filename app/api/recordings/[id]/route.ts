import mongoose from "mongoose";
import { NextResponse } from "next/server";
import Recording from "@/models/Recording";
import WeeklyReview from "@/models/WeeklyReview";
import { HttpError, errorResponse, requireIdentity } from "@/lib/rehab/auth";
import { recordingStorage } from "@/lib/storage/recordingStorage";

export const dynamic = "force-dynamic";

async function authorised(id: string, userId: string) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, "That recording id is not valid.");
  const rec = await Recording.findById(id);
  // Only the patient who made it or the therapist who owns the review. Everyone else gets the same 404.
  if (!rec || (rec.patientId !== userId && rec.doctorId !== userId)) throw new HttpError(404, "Recording not found.");
  return rec;
}

/**
 * Streams the clip to the patient or their therapist. The storage pathname and any
 * storage URL are never sent to the browser; the stream is private and uncached.
 * Browsers ask for byte ranges when seeking, so Range is forwarded to storage.
 *
 * The caller's token must come in the Authorization header, which a <video src> cannot
 * send. The app fetches the clip as a blob (see components/review/RecordingPlayer).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const me = await requireIdentity(req);
    const rec = await authorised(id, me.userId);
    const opened = await recordingStorage().open(rec.pathname, req.headers.get("range"));
    if (!opened) throw new HttpError(404, "The recording file is no longer available.");
    const headers = new Headers({
      "Content-Type": opened.contentType,
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Accept-Ranges": "bytes",
    });
    const range = opened.headers.get("content-range");
    if (range) headers.set("Content-Range", range);
    const length = opened.headers.get("content-length");
    headers.set("Content-Length", length ?? String(opened.size));
    return new Response(opened.stream, { status: opened.status, headers });
  } catch (error) {
    return errorResponse(error);
  }
}

/** The patient can delete their own clip (for example before re-recording). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const me = await requireIdentity(req);
    const rec = await authorised(id, me.userId);
    if (rec.patientId !== me.userId) throw new HttpError(403, "Only the patient can delete a recording.");
    const review = await WeeklyReview.findById(rec.reviewId);
    if (review?.status === "reviewed") throw new HttpError(409, "This week has already been reviewed.");
    await recordingStorage().remove(rec.pathname).catch((e) => console.error("[recordings] storage delete failed:", e));
    await rec.deleteOne();
    if (review && review.recordingId === rec._id.toString()) {
      review.recordingId = undefined;
      await review.save();
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
