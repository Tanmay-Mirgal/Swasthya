import { NextResponse } from "next/server";
import { errorResponse, HttpError, requirePatient } from "@/lib/rehab/auth";
import { getMovementTemplate } from "@/lib/movement/template/registry";
import { progressFacts } from "@/lib/rehab/progressFacts";
import { historyFor } from "@/lib/rehab/progressService";
import { creditsGoodRepsOnly } from "@/lib/rehab/chunkQuality";

export const dynamic = "force-dynamic";

/**
 * What can honestly be said at the start of the next session of an exercise: how last time went and the best range
 * so far. Patient-only, and only ever about the signed-in patient's own prescribed sessions.
 */
export async function GET(req: Request) {
  try {
    const me = await requirePatient(req);
    const exerciseId = new URL(req.url).searchParams.get("exerciseId") ?? "";
    if (!getMovementTemplate(exerciseId)) throw new HttpError(400, "Unknown exercise.");
    const history = await historyFor(me.userId, exerciseId);
    const facts = progressFacts(null, history);
    // The range the live screen compares a finished set with is taken only from sessions measured by the current engine,
    // so a range is never set beside one that was measured a different way.
    const best = progressFacts(null, history.filter((h) => creditsGoodRepsOnly(h.engine))).personalBest;
    return NextResponse.json({ success: true, data: { lastTime: facts.lastTime, personalBest: best } });
  } catch (error) {
    return errorResponse(error);
  }
}
