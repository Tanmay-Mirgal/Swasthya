import { after, NextResponse } from "next/server";
import { errorResponse, readJson, requirePatient } from "@/lib/rehab/auth";
import { recordChunk, type RecordChunkInput } from "@/lib/rehab/sessionService";
import ExerciseSession from "@/models/ExerciseSession";
import { ensureSessionReport } from "@/lib/rehab/reportService";

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
    // When the exercise is finished, write its performance summary after the response has gone.
    if (result.exerciseComplete && !result.duplicate) {
      const job = async () => {
        try {
          const session = await ExerciseSession.findById(result.sessionId).lean();
          if (session) await ensureSessionReport(session as never, { allowModel: true, userIdForLimit: me.userId });
        } catch (e) {
          console.warn("[report] could not create the session report:", e);
        }
      };
      try {
        after(job);
      } catch {
        void job(); // outside a request (tests): just run it
      }
    }
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return errorResponse(error);
  }
}
