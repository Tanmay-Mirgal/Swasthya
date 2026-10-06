/**
 * lib/rehab/auth.ts
 *
 * Server-side authorization for the rehabilitation routes. Identity comes only from
 * the verified Clerk token; ids sent by the browser (patientId, therapistId) are
 * never trusted. A therapist may act on a patient only through an active
 * TherapistAssignment on record.
 */

import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import TherapistAssignment from "@/models/TherapistAssignment";
import PatientProfile from "@/models/PatientProfile";
import { getIdentityFromRequest, type VerifiedIdentity } from "@/lib/realtime/auth/verifier";
import { DEFAULT_TIMEZONE, isValidTimezone } from "./dates";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("[rehab] unexpected error:", error);
  return NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });
}

export async function requireIdentity(req: Request): Promise<VerifiedIdentity> {
  const me = await getIdentityFromRequest(req);
  if (!me) throw new HttpError(401, "Please sign in again.");
  await connectToDatabase();
  return me;
}

export async function requirePatient(req: Request): Promise<VerifiedIdentity> {
  const me = await requireIdentity(req);
  if (me.role !== "patient") throw new HttpError(403, "This is only available to patients.");
  return me;
}

export async function requireTherapist(req: Request): Promise<VerifiedIdentity> {
  const me = await requireIdentity(req);
  if (me.role !== "doctor") throw new HttpError(403, "This is only available to therapists.");
  return me;
}

export async function assertTherapistOfPatient(therapistId: string, patientId: string): Promise<void> {
  if (!patientId || typeof patientId !== "string") throw new HttpError(400, "Missing patient.");
  const link = await TherapistAssignment.exists({ therapistId, patientId, status: "active" });
  if (!link) throw new HttpError(403, "This patient is not in your care.");
}

/** Reads a JSON body, turning malformed input into a 400. */
export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "The request body is not valid JSON.");
  }
}

/** The patient's timezone: stored on their profile, else the clinic default. */
export async function patientTimezone(patientId: string): Promise<string> {
  const profile = await PatientProfile.findOne({ clerkUserId: patientId }, { timezone: 1 }).lean<{ timezone?: string }>();
  return isValidTimezone(profile?.timezone) ? profile!.timezone! : DEFAULT_TIMEZONE;
}

/** Remembers the timezone the patient's browser reports, if it is a real IANA zone. */
export async function rememberTimezone(patientId: string, tz: unknown): Promise<string> {
  if (isValidTimezone(tz)) {
    await PatientProfile.updateOne({ clerkUserId: patientId }, { $set: { timezone: tz } });
    return tz;
  }
  return patientTimezone(patientId);
}
