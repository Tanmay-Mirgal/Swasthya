import { NextResponse } from "next/server";
import ExerciseSession, { type IExerciseSession } from "@/models/ExerciseSession";
import { errorResponse, HttpError, readJson, requireIdentity, requirePatient } from "@/lib/rehab/auth";
import { avgRepSecondsOf, cleanQuality, formAccuracyOf } from "@/lib/rehab/chunkQuality";
import { issueLabel } from "@/lib/rehab/issueLabels";
import { getMovementTemplate } from "@/lib/movement/template/registry";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const me = await requireIdentity(req);
    const sessions = await ExerciseSession.find({ patientId: me.userId }).sort({ date: -1 }).limit(50).lean<IExerciseSession[]>();

    const totalSessions = sessions.length;
    const totalReps = sessions.reduce((acc, s) => acc + (s.completedReps || 0), 0);
    // A range in degrees and one in percent cannot be averaged together: only degrees are pooled.
    const inDegrees = sessions.filter((s) => (getMovementTemplate(s.exerciseId)?.rep.unit ?? "deg") === "deg");
    const avgRom = inDegrees.length > 0 ? Math.round(inDegrees.reduce((acc, s) => acc + (s.rom || 0), 0) / inDegrees.length) : 0;

    // The list needs the totals, not every chunk: trim the heavy parts and add what the trend view needs.
    const slim = sessions.map((s) => ({
      ...s,
      sets: undefined,
      avgRepSeconds: avgRepSecondsOf(s.sets),
      romUnit: getMovementTemplate(s.exerciseId)?.rep.unit ?? "deg",
      errorList: Object.entries(s.issueCounts ?? {})
        .map(([code, reps]) => ({ code, label: issueLabel(code), reps: Number(reps) }))
        .sort((x, y) => y.reps - x.reps),
    }));

    return NextResponse.json({
      success: true,
      data: { sessions: slim, stats: { totalSessions, totalReps, avgRom }, latestSession: slim[0] ?? null },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const me = await requirePatient(req);
    const body = await readJson<Record<string, unknown>>(req);
    const template = typeof body.exerciseId === "string" ? getMovementTemplate(body.exerciseId) : null;
    if (!template) throw new HttpError(400, "That exercise can’t be saved: it has no movement tracking.");

    const targetReps = Math.min(200, Math.max(1, Math.round(Number(body.targetReps) || template.defaultReps)));
    const completedReps = Math.min(targetReps, Math.max(0, Math.round(Number(body.completedReps) || 0)));
    const q = cleanQuality({ ...body, corrections: body.corrections }, completedReps);
    const judged = (q.engine ?? 0) >= 2 && q.validReps !== undefined;
    const date = body.date ? new Date(String(body.date)) : new Date();

    const doc = await ExerciseSession.create({
      patientId: me.userId,
      exerciseId: template.id,
      exerciseName: template.name,
      durationSeconds: Math.min(7200, Math.max(0, Math.round(Number(body.durationSeconds) || 0))),
      completedReps,
      targetReps,
      rom: Number.isFinite(Number(body.rom)) ? Math.min(360, Math.max(0, Number(body.rom))) : 0,
      targetRom: Number(body.targetRom) > 0 ? Number(body.targetRom) : undefined,
      formAccuracy: judged ? formAccuracyOf(q.validReps, q.invalidReps) : undefined,
      targetMet: completedReps >= targetReps,
      date: Number.isNaN(date.getTime()) ? new Date() : date,
      ...(judged
        ? {
            engineVersion: q.engine,
            validReps: q.validReps,
            invalidReps: q.invalidReps,
            partialReps: q.partialReps,
            avgConfidence: q.avgConfidence,
            correctionAttempts: q.corrections?.attempted,
            correctionsSucceeded: q.corrections?.succeeded,
            issueCounts: q.flags ? Object.fromEntries(Object.entries(q.flags).map(([c, e]) => [c, e.count])) : undefined,
            issueSeverity: q.flags ? Object.fromEntries(Object.entries(q.flags).map(([c, e]) => [c, e.severity])) : undefined,
          }
        : {}),
    });

    return NextResponse.json({ success: true, data: { id: doc._id.toString() } });
  } catch (error) {
    return errorResponse(error);
  }
}
