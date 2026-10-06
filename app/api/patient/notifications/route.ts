import { NextResponse } from "next/server";
import PatientProfile from "@/models/PatientProfile";
import { HttpError, errorResponse, patientTimezone, readJson, requirePatient } from "@/lib/rehab/auth";

export const dynamic = "force-dynamic";

/** The patient's reminder preferences. Email reminders are on unless they turn them off. */
export async function GET(req: Request) {
  try {
    const me = await requirePatient(req);
    const profile = await PatientProfile.findOne({ clerkUserId: me.userId }, { notifications: 1 }).lean<{ notifications?: { emailReminders?: boolean } }>();
    return NextResponse.json({
      success: true,
      data: { emailReminders: profile?.notifications?.emailReminders !== false, timezone: await patientTimezone(me.userId) },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const me = await requirePatient(req);
    const body = await readJson<{ emailReminders?: unknown }>(req);
    if (typeof body.emailReminders !== "boolean") throw new HttpError(400, "Choose on or off.");
    await PatientProfile.updateOne({ clerkUserId: me.userId }, { $set: { "notifications.emailReminders": body.emailReminders } });
    return NextResponse.json({ success: true, data: { emailReminders: body.emailReminders } });
  } catch (error) {
    return errorResponse(error);
  }
}
