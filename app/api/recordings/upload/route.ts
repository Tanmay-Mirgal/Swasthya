import { NextResponse } from "next/server";
import mongoose from "mongoose";
import type { HandleUploadBody } from "@vercel/blob/client";
import WeeklyReview from "@/models/WeeklyReview";
import { HttpError, errorResponse, requirePatient } from "@/lib/rehab/auth";
import { recordingStorage } from "@/lib/storage/recordingStorage";
import { dateKeyInTimezone } from "@/lib/rehab/dates";
import { patientTimezone } from "@/lib/rehab/auth";

export const dynamic = "force-dynamic";

/** Whether recording storage is configured, so the app only offers a recording it can actually keep. */
export async function GET(req: Request) {
  try {
    await requirePatient(req);
    return NextResponse.json({ success: true, data: { available: recordingStorage().available() } });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Issues a short-lived upload token for ONE recording on the signed-in patient's own
 * weekly review. The browser then uploads straight to private storage (so the clip is not
 * limited by the function body size). The token is bound to this patient's path prefix,
 * to video types only, and to a size cap. Nothing is uploaded unless a review requires it.
 */
export async function POST(req: Request) {
  try {
    const me = await requirePatient(req);
    const storage = recordingStorage();
    if (!storage.available()) throw new HttpError(503, "Recording storage is not set up yet. Your therapist can still review your sets.");

    const body = (await req.json().catch(() => null)) as HandleUploadBody | null;
    if (!body || typeof body !== "object" || !("type" in body)) throw new HttpError(400, "The upload request is not valid.");

    // Both the token request and the (unused) completion callback carry a clientPayload; we only serve token requests.
    if (body.type !== "blob.generate-client-token") throw new HttpError(400, "Unsupported upload step.");
    const reviewId = (() => {
      try {
        return String(JSON.parse(body.payload.clientPayload ?? "{}").reviewId ?? "");
      } catch {
        return "";
      }
    })();
    if (!mongoose.isValidObjectId(reviewId)) throw new HttpError(400, "Choose which weekly review this recording is for.");

    const review = await WeeklyReview.findById(reviewId);
    if (!review || review.patientId !== me.userId) throw new HttpError(404, "Review not found.");
    if (!review.recordingRequired) throw new HttpError(409, "Your therapist did not ask for a recording this week.");
    if (review.status === "reviewed") throw new HttpError(409, "This week has already been reviewed.");
    const today = dateKeyInTimezone(new Date(), await patientTimezone(me.userId));
    if (review.dueDate > today) throw new HttpError(409, "This recording is not due yet.");

    const result = await storage.issueUploadToken({
      body,
      request: req,
      pathnamePrefix: `recordings/${me.userId}/${reviewId}/`,
      tokenPayload: JSON.stringify({ patientId: me.userId, reviewId }),
    });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
