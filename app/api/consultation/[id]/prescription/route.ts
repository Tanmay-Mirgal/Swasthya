import { NextResponse } from "next/server";
import Prescription from "@/models/Prescription";
import { HttpError, errorResponse, requireIdentity } from "@/lib/rehab/auth";
import { resolveConsultation } from "@/lib/realtime/auth/verifier";
import { serializePrescription } from "@/lib/rehab/sessionService";

export const dynamic = "force-dynamic";

/**
 * The rehabilitation plan written after this consultation, for the two people in it.
 * Plans are created through POST /api/prescriptions (the plan builder), not here.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const me = await requireIdentity(req);
    const consultation = await resolveConsultation(id);
    if (!consultation || (consultation.patientId !== me.userId && consultation.doctorId !== me.userId)) {
      throw new HttpError(403, "Forbidden");
    }
    const doc = await Prescription.findOne({ consultationId: consultation._id }).sort({ createdAt: -1 });
    if (!doc) throw new HttpError(404, "No plan has been written for this consultation yet.");
    return NextResponse.json({
      success: true,
      data: { ...serializePrescription(doc), medicines: doc.medicines, healthyTips: doc.healthyTips },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
