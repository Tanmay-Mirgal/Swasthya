import { NextResponse } from "next/server";
import mongoose from "mongoose";
import Prescription from "@/models/Prescription";
import ExerciseSession from "@/models/ExerciseSession";
import { HttpError, errorResponse, patientTimezone, readJson, requirePatient } from "@/lib/rehab/auth";
import { dateKeyInTimezone } from "@/lib/rehab/dates";

export const dynamic = "force-dynamic";

const LEVELS = ["none", "mild", "moderate", "severe"] as const;

/** The patient's own words about how an exercise felt today. Optional, and never interpreted by the app. */
export async function POST(req: Request) {
  try {
    const me = await requirePatient(req);
    const body = await readJson<{ prescriptionId?: string; exerciseKey?: string; discomfort?: string }>(req);
    if (!body.prescriptionId || !mongoose.isValidObjectId(body.prescriptionId) || !body.exerciseKey) throw new HttpError(400, "Missing exercise.");
    if (!LEVELS.includes(body.discomfort as (typeof LEVELS)[number])) throw new HttpError(400, "Choose none, mild, moderate or severe.");
    const plan = await Prescription.findById(body.prescriptionId, { patientId: 1 }).lean<{ patientId: string }>();
    if (!plan || plan.patientId !== me.userId) throw new HttpError(404, "Plan not found.");
    const dateKey = dateKeyInTimezone(new Date(), await patientTimezone(me.userId));
    const res = await ExerciseSession.updateOne(
      { patientId: me.userId, prescriptionId: body.prescriptionId, prescriptionExerciseKey: body.exerciseKey, dateKey },
      { $set: { discomfort: body.discomfort } }
    );
    if (res.matchedCount === 0) throw new HttpError(404, "Nothing has been recorded for this exercise today.");
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
