import { NextResponse } from "next/server";
import { errorResponse, readJson, requirePatient } from "@/lib/rehab/auth";
import { recordChunk, type RecordChunkInput } from "@/lib/rehab/sessionService";

export const dynamic = "force-dynamic";

/**
 * Records one chunk of reps for a set (8 reps, rest, 7 reps is two chunks of one set).
 * `chunkId` makes the request idempotent, so a retry never counts reps twice.
 */
export async function POST(req: Request) {
  try {
    const me = await requirePatient(req);
    const body = await readJson<RecordChunkInput>(req);
    const result = await recordChunk(me.userId, body);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return errorResponse(error);
  }
}
