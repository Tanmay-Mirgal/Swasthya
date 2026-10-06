import { NextResponse } from "next/server";
import { errorResponse, rememberTimezone, requirePatient } from "@/lib/rehab/auth";
import { getPlanSnapshot } from "@/lib/rehab/sessionService";

export const dynamic = "force-dynamic";

/** The signed-in patient's rehabilitation plan for today, derived from their prescription and stored sets. */
export async function GET(req: Request) {
  try {
    const me = await requirePatient(req);
    const tz = await rememberTimezone(me.userId, new URL(req.url).searchParams.get("tz"));
    const snapshot = await getPlanSnapshot(me.userId, tz);
    return NextResponse.json({ success: true, data: snapshot });
  } catch (error) {
    return errorResponse(error);
  }
}
