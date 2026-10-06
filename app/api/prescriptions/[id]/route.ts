import { NextResponse } from "next/server";
import mongoose from "mongoose";
import Prescription from "@/models/Prescription";
import { HttpError, errorResponse, readJson, requireIdentity, requireTherapist } from "@/lib/rehab/auth";
import { transitionPrescription } from "@/lib/rehab/prescriptionService";
import { serializePrescription } from "@/lib/rehab/sessionService";
import type { PrescriptionStatus } from "@/models/Prescription";

export const dynamic = "force-dynamic";

/** The patient who owns a plan, or the therapist who wrote it. Nobody else. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const me = await requireIdentity(req);
    if (!mongoose.isValidObjectId(id)) throw new HttpError(400, "That prescription id is not valid.");
    const doc = await Prescription.findById(id);
    const allowed = doc && (doc.patientId === me.userId || doc.doctorId === me.userId);
    if (!doc || !allowed) throw new HttpError(404, "Prescription not found.");
    return NextResponse.json({
      success: true,
      data: { ...serializePrescription(doc), statusHistory: doc.statusHistory, medicines: doc.medicines, closedReason: doc.closedReason },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Therapist: pause, resume, complete or cancel a plan. Content changes go through POST /api/prescriptions as a new version. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const me = await requireTherapist(req);
    const body = await readJson<{ status?: PrescriptionStatus; note?: string }>(req);
    if (!body.status || !["active", "paused", "completed", "cancelled"].includes(body.status)) {
      throw new HttpError(400, "Choose a status: active, paused, completed or cancelled.");
    }
    const doc = await transitionPrescription(id, me.userId, body.status, body.note);
    return NextResponse.json({ success: true, data: serializePrescription(doc) });
  } catch (error) {
    return errorResponse(error);
  }
}
