import { NextResponse } from "next/server";
import { errorResponse, readJson, requireIdentity } from "@/lib/rehab/auth";
import { ensureSessionReport, getExistingReport, loadSessionFor, toView } from "@/lib/rehab/reportService";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** The report for a session, only if it already exists. Patients get their own; a therapist gets assigned patients'. */
export async function GET(req: Request) {
  try {
    const me = await requireIdentity(req);
    const sessionId = new URL(req.url).searchParams.get("sessionId") ?? "";
    await loadSessionFor(me, sessionId);
    const report = await getExistingReport(sessionId);
    return NextResponse.json({ success: true, data: report ? toView(report, me.role === "doctor" ? "doctor" : "patient") : null });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Creates (or refreshes) the report from the stored session, then returns it. The body names the session only. */
export async function POST(req: Request) {
  try {
    const me = await requireIdentity(req);
    const body = await readJson<{ sessionId?: string }>(req);
    const session = await loadSessionFor(me, String(body.sessionId ?? ""));
    const report = await ensureSessionReport(session, { allowModel: true, userIdForLimit: me.userId });
    return NextResponse.json({ success: true, data: toView(report, me.role === "doctor" ? "doctor" : "patient") });
  } catch (error) {
    return errorResponse(error);
  }
}
