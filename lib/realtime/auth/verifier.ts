/**
 * lib/realtime/auth/verifier.ts
 *
 * Server-side identity verification and authorization for realtime connections
 * and the REST routes that feed the realtime bus. Identity is derived ONLY from a
 * Clerk JWT; roles come from MongoDB. Nothing the client says about who it is,
 * which room it is in, or what role it has is trusted.
 */

import connectToDatabase from "@/lib/mongodb";
import User from "@/models/User";
import Consultation from "@/models/Consultation";
import TherapistAssignment from "@/models/TherapistAssignment";
import AppointmentRequest from "@/models/AppointmentRequest";
import TherapistProfile from "@/models/TherapistProfile";
import { otherParticipantOfConversation, parseRoom, Rooms } from "../protocol/rooms";

export interface VerifiedIdentity {
  userId: string;
  role: "patient" | "doctor" | "system";
  name?: string;
  email?: string;
}

export interface RoomAuthorizationResult {
  authorized: boolean;
  role: "patient" | "doctor" | "system";
  /** Canonical room id the connection must actually join (e.g. consultation alias → _id). */
  roomId?: string;
  reason?: string;
}

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

/**
 * Explicit opt-in test identities (`dev_test_<userId>:<role>:<name>`).
 * Only honoured when REALTIME_DEV_AUTH=1 AND NODE_ENV !== "production".
 */
function devTestAllowed(): boolean {
  return process.env.REALTIME_DEV_AUTH === "1" && process.env.NODE_ENV !== "production";
}

export async function verifyRealtimeToken(token: string): Promise<VerifiedIdentity | null> {
  if (!token || typeof token !== "string" || token.length > 8_000) return null;

  if (devTestAllowed() && token.startsWith("dev_test_")) {
    const [userId, roleRaw, nameRaw] = token.replace("dev_test_", "").split(":");
    if (!userId) return null;
    const role = roleRaw === "doctor" ? "doctor" : "patient";
    return {
      userId,
      role,
      name: nameRaw ? decodeURIComponent(nameRaw) : role === "doctor" ? "Dr. Test" : "Test Patient",
    };
  }

  try {
    const { verifyToken } = await import("@clerk/backend");
    const verified = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
    const clerkUserId = verified?.sub;
    if (!clerkUserId) return null;

    await connectToDatabase();
    const [userDoc, therapistDoc] = await Promise.all([
      User.findOne({ clerkUserId }).lean(),
      TherapistProfile.findOne({ clerkUserId }).lean(),
    ]);

    const isTherapist = userDoc?.role === "therapist" || Boolean(therapistDoc);
    const role: "patient" | "doctor" = isTherapist ? "doctor" : "patient";
    const name =
      therapistDoc?.professionalName ||
      (userDoc?.firstName ? `${userDoc.firstName} ${userDoc.lastName || ""}`.trim() : role === "doctor" ? "Doctor" : "Patient");

    return { userId: clerkUserId, role, name, email: userDoc?.email };
  } catch {
    // Never leak verification internals; callers only learn "not authenticated".
    return null;
  }
}

/** Authenticates a REST request via its `Authorization: Bearer <clerk jwt>` header. */
export async function getIdentityFromRequest(req: Request): Promise<VerifiedIdentity | null> {
  const header = req.headers.get("Authorization");
  if (!header || !header.startsWith("Bearer ")) return null;
  return verifyRealtimeToken(header.slice("Bearer ".length).trim());
}

export async function resolveConsultation(idOrAppointmentId: string) {
  await connectToDatabase();
  let consultation = null;
  if (OBJECT_ID.test(idOrAppointmentId)) {
    consultation = await Consultation.findById(idOrAppointmentId);
  }
  if (!consultation) {
    consultation = await Consultation.findOne({ appointmentId: idOrAppointmentId });
  }
  return consultation;
}

/** True when the two users have any real therapist↔patient relationship on record. */
export async function usersHaveRelationship(userA: string, userB: string): Promise<boolean> {
  await connectToDatabase();
  const pair = [
    { patientId: userA, therapistId: userB },
    { patientId: userB, therapistId: userA },
  ];
  const [assignment, appointment, consultation] = await Promise.all([
    TherapistAssignment.exists({ $or: pair }),
    AppointmentRequest.exists({ $or: pair }),
    Consultation.exists({
      $or: [
        { patientId: userA, doctorId: userB },
        { patientId: userB, doctorId: userA },
      ],
    }),
  ]);
  return Boolean(assignment || appointment || consultation);
}

export async function authorizeUserForRoom(
  userId: string,
  roomId: string,
  fallbackRole: "patient" | "doctor" | "system" = "patient"
): Promise<RoomAuthorizationResult> {
  const parsed = parseRoom(roomId);
  if (!userId || !parsed) {
    return { authorized: false, role: fallbackRole, reason: "Invalid room" };
  }

  if (parsed.kind === "user") {
    return parsed.id === userId
      ? { authorized: true, role: fallbackRole, roomId }
      : { authorized: false, role: fallbackRole, reason: "Cannot subscribe to another user's channel" };
  }

  if (parsed.kind === "conversation") {
    const other = otherParticipantOfConversation(parsed.id, userId);
    if (!other) {
      return { authorized: false, role: fallbackRole, reason: "Not a participant in this conversation" };
    }
    if (!(await usersHaveRelationship(userId, other))) {
      return { authorized: false, role: fallbackRole, reason: "No therapist–patient relationship for this conversation" };
    }
    return { authorized: true, role: fallbackRole, roomId };
  }

  // consultation
  const consultation = await resolveConsultation(parsed.id);
  if (!consultation) {
    return { authorized: false, role: fallbackRole, reason: "Consultation not found" };
  }
  const canonical = Rooms.consultation(consultation._id.toString());
  if (consultation.patientId === userId) return { authorized: true, role: "patient", roomId: canonical };
  if (consultation.doctorId === userId) return { authorized: true, role: "doctor", roomId: canonical };
  return { authorized: false, role: fallbackRole, reason: "Not a participant in this consultation" };
}
