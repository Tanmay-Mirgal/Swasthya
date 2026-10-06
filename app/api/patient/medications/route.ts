import { NextResponse } from "next/server";
import Prescription from "@/models/Prescription";
import { errorResponse, requirePatient } from "@/lib/rehab/auth";

export const dynamic = "force-dynamic";

/**
 * The patient's own medication records, exactly as entered by their therapist.
 * Never generated or suggested by the app. Scoped to the signed-in patient.
 */
export async function GET(req: Request) {
  try {
    const me = await requirePatient(req);
    const docs = await Prescription.find({ patientId: me.userId, "medicines.0": { $exists: true }, status: { $ne: "draft" } })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    return NextResponse.json({
      success: true,
      data: docs.map((d) => ({
        prescriptionId: d._id.toString(),
        prescribedBy: d.doctorName,
        prescribedAt: d.createdAt,
        status: d.status,
        medicines: d.medicines,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
