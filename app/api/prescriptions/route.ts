import { NextResponse } from "next/server";
import Prescription from "@/models/Prescription";
import { assertTherapistOfPatient, errorResponse, readJson, requireTherapist } from "@/lib/rehab/auth";
import { createPrescription, type PrescriptionInput } from "@/lib/rehab/prescriptionService";
import { serializePrescription } from "@/lib/rehab/sessionService";
import { notifyPrescriptionChange } from "@/lib/rehab/notifier";
import { publish } from "@/lib/realtime/server/bus";
import { RealtimeEvent } from "@/lib/realtime/protocol/events";
import { Rooms } from "@/lib/realtime/protocol/rooms";

export const dynamic = "force-dynamic";

/** Therapist: create a plan for a patient in their care (or revise the live one). */
export async function POST(req: Request) {
  try {
    const me = await requireTherapist(req);
    const body = await readJson<PrescriptionInput>(req);
    await assertTherapistOfPatient(me.userId, body.patientId);

    const doc = await createPrescription(me.userId, body);
    const isRevision = doc.version > 1;

    await publish({
      roomId: Rooms.user(doc.patientId),
      event: RealtimeEvent.RECOVERY_PLAN_UPDATED,
      payload: { patientId: doc.patientId, exercisesCount: doc.exercises.length },
      from: { userId: me.userId, role: "doctor", name: me.name },
    }).catch((e) => console.error("[rehab] plan realtime publish failed:", e));

    // Email/notification is best effort: a mail outage must never undo a saved plan.
    const notified = await notifyPrescriptionChange(doc, isRevision).catch((e) => {
      console.error("[rehab] prescription notification failed:", e);
      return null;
    });

    return NextResponse.json({ success: true, data: { prescription: serializePrescription(doc), revision: isRevision, notification: notified } }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Therapist: the history of plans they have written for one patient (newest first). */
export async function GET(req: Request) {
  try {
    const me = await requireTherapist(req);
    const patientId = new URL(req.url).searchParams.get("patientId") ?? "";
    await assertTherapistOfPatient(me.userId, patientId);
    const docs = await Prescription.find({ patientId, doctorId: me.userId }).sort({ createdAt: -1 }).limit(50);
    return NextResponse.json({
      success: true,
      data: docs.map((d) => ({ ...serializePrescription(d), statusHistory: d.statusHistory, closedReason: d.closedReason, supersedesId: d.supersedesId })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
