import { NextResponse } from "next/server";
import { errorResponse, readJson, requirePatient } from "@/lib/rehab/auth";
import { parseCueRequest } from "@/lib/movement/coach/cueRequest";
import { generateCue, llmConfigured } from "@/lib/movement/coach/serverCue";
import { consume } from "@/lib/rehab/rateLimit";

export const dynamic = "force-dynamic";

/**
 * One coaching cue from the language model, for a problem the on-device engine has already
 * confirmed. Signed-in patients only, rate limited, and every field is validated against the
 * exercise template. It never fails the exercise: any problem returns `{cue: null, fallback: true}`
 * and the app uses its built-in wording.
 */
export async function POST(req: Request) {
  try {
    const me = await requirePatient(req);
    const parsed = parseCueRequest(await readJson(req));
    if (!parsed) return NextResponse.json({ error: "That coaching request is not valid." }, { status: 400 });
    if (!llmConfigured()) return NextResponse.json({ cue: null, fallback: true });

    const allowed = await consume(me.userId, "coach", [
      { name: "min", seconds: 60, max: 12 },
      { name: "hour", seconds: 3600, max: 150 },
    ]);
    if (!allowed) return NextResponse.json({ cue: null, fallback: true }, { status: 429 });

    const cue = await generateCue(parsed);
    return NextResponse.json({ cue, fallback: cue === null });
  } catch (error) {
    return errorResponse(error);
  }
}
