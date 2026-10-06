/**
 * lib/realtime/server/callService.ts
 *
 * Server-side call state machine. The authoritative state lives on the Consultation
 * document (`callStatus`, `callId`, `callInitiatorId`, `callUpdatedAt`), never in process
 * memory, and every call is also recorded in `CallSession` (history / audit):
 *
 *   idle|ended ─CREATE─▶ calling ─ACCEPT─▶ accepted ─CONNECTED─▶ connected
 *        ▲                  │ reject/cancel        │ end                │ end
 *        └──────────────────┴──────────────────────┴────────────────────┘
 *
 * - `callId` is issued here. Every later event must carry the CURRENT callId; anything
 *   else is stale (an event from an older call) and is refused or ignored, so a late
 *   CALL_END / offer / ICE can never touch a newer call.
 * - `connected` means media really connected: a client reports it with CALL_CONNECTED.
 *   Relaying an answer no longer flips the state.
 * - Ending is idempotent: only the transition out of a live state returns `changed`.
 *
 * Authorisation is always derived from the verified identity and the consultation record
 * (patient / doctor participants), never from ids the client supplies. Media never touches
 * the server; this only gates and describes signaling.
 */

import { randomUUID } from "crypto";
import connectToDatabase from "@/lib/mongodb";
import Consultation, { IConsultation } from "@/models/Consultation";
import CallSession from "@/models/CallSession";
import AppointmentRequest from "@/models/AppointmentRequest";
import { canJoinConsultation } from "@/types/appointment";
import { Rooms } from "../protocol/rooms";
import { resolveConsultation, type VerifiedIdentity } from "../auth/verifier";
import { isUserPresent } from "./presence";
import { RealtimeErrorCode, type RealtimeErrorCodeType } from "../protocol/events";
import type { CallEndedBy } from "../protocol/packets";

export type CallRole = "patient" | "doctor";
type CallStatus = IConsultation["callStatus"];

export interface CallContext {
  consultation: IConsultation;
  consultationId: string;
  roomId: string;
  role: CallRole;
  /** Server-derived (from the consultation record), never client-supplied. */
  peerUserId: string;
  selfUserId: string;
}

export class CallError extends Error {
  constructor(public code: RealtimeErrorCodeType, message: string) {
    super(message);
  }
}

/** A ringing call older than this can no longer be answered. */
export const RINGING_STALE_MS = 60_000;
/** An accepted call that never connected within this is dead and may be replaced. */
export const NEGOTIATING_STALE_MS = 90_000;

export async function loadCallContext(identity: VerifiedIdentity, consultationIdOrAlias: string): Promise<CallContext> {
  const doc = (await resolveConsultation(consultationIdOrAlias)) as IConsultation | null;
  if (!doc) throw new CallError(RealtimeErrorCode.FORBIDDEN, "Consultation not found");
  const isPatient = doc.patientId === identity.userId;
  const isDoctor = doc.doctorId === identity.userId;
  if (!isPatient && !isDoctor) {
    throw new CallError(RealtimeErrorCode.FORBIDDEN, "You are not a participant in this consultation");
  }
  const consultationId = doc._id.toString();
  return {
    consultation: doc,
    consultationId,
    roomId: Rooms.consultation(consultationId),
    role: isDoctor ? "doctor" : "patient",
    peerUserId: isDoctor ? doc.patientId : doc.doctorId,
    selfUserId: identity.userId,
  };
}

async function scheduledWindowOk(c: IConsultation): Promise<boolean> {
  let scheduledAt: Date | undefined = c.scheduledAt;
  let duration = c.duration || 30;
  if (!scheduledAt && c.appointmentId) {
    const appt = await AppointmentRequest.findById(c.appointmentId).lean<{ scheduledAt?: Date; duration?: number }>();
    scheduledAt = appt?.scheduledAt;
    duration = c.duration || appt?.duration || 30;
  }
  scheduledAt = scheduledAt || c.createdAt;
  return canJoinConsultation(c.status, scheduledAt, duration, new Date());
}

const ageMs = (d?: Date) => (d ? Date.now() - new Date(d).getTime() : Infinity);

/** Atomically move callStatus (for ONE callId when given); false if someone else changed it first. */
async function transition(
  ctx: CallContext,
  expected: CallStatus[],
  update: Record<string, unknown>,
  callId?: string
): Promise<boolean> {
  const filter: Record<string, unknown> = { _id: ctx.consultation._id, callStatus: { $in: expected } };
  if (callId) filter.callId = callId;
  const res = await Consultation.findOneAndUpdate(
    filter,
    { $set: { ...update, callUpdatedAt: new Date() } },
    { returnDocument: "after" }
  );
  return Boolean(res);
}

/** Audit writes are best-effort: a history failure must never break a live call. */
async function audit(callId: string, update: Record<string, unknown>): Promise<void> {
  try {
    await connectToDatabase();
    await CallSession.updateOne({ callId }, { $set: update });
  } catch (err) {
    console.warn("[Calls] audit write failed:", err instanceof Error ? err.message : err);
  }
}

const endedByOf = (role: CallRole): CallEndedBy => role;

/** The call this event is about must be the consultation's current one. */
function requireCurrent(ctx: CallContext, callId: string): void {
  if (!ctx.consultation.callId || ctx.consultation.callId !== callId) {
    throw new CallError(RealtimeErrorCode.CALL_STATE, "That call is no longer current.");
  }
}

export interface CallHandle {
  ctx: CallContext;
  callId: string;
}

export async function createCall(identity: VerifiedIdentity, consultationId: string): Promise<CallHandle & { reused: boolean }> {
  const ctx = await loadCallContext(identity, consultationId);
  const c = ctx.consultation;

  if (c.status !== "ACTIVE") {
    throw new CallError(RealtimeErrorCode.CALL_NOT_ALLOWED, "This consultation is not open for calls.");
  }
  if (!(await scheduledWindowOk(c))) {
    throw new CallError(RealtimeErrorCode.CALL_NOT_ALLOWED, "The consultation room is not open yet.");
  }

  const current: CallStatus = c.callStatus || "idle";

  // The caller re-ringing their own still-fresh call (e.g. the callee just came online): same call, same id.
  if (current === "calling" && c.callInitiatorId === identity.userId && c.callId && ageMs(c.callUpdatedAt) < RINGING_STALE_MS) {
    await transition(ctx, ["calling"], {}, c.callId);
    return { ctx, callId: c.callId, reused: true };
  }

  let startable = current === "idle" || current === "ended";
  if (!startable && current === "calling") startable = ageMs(c.callUpdatedAt) >= RINGING_STALE_MS;
  if (!startable && current === "accepted") {
    startable = ageMs(c.callUpdatedAt) >= NEGOTIATING_STALE_MS || !(await isUserPresent(ctx.roomId, ctx.peerUserId));
  }
  if (!startable && current === "connected") {
    // A call whose other side is no longer present anywhere is stale.
    startable = !(await isUserPresent(ctx.roomId, ctx.peerUserId));
  }
  if (!startable) {
    throw new CallError(RealtimeErrorCode.CALL_STATE, "A call is already in progress for this consultation.");
  }

  const callId = randomUUID();
  const now = new Date();
  const ok = await transition(ctx, [current], {
    callStatus: "calling",
    callInitiatorId: identity.userId,
    callId,
    startedAt: now,
  });
  if (!ok) throw new CallError(RealtimeErrorCode.CALL_STATE, "The call state just changed. Please try again.");

  // Whatever call this replaced is over.
  if (c.callId && (current === "calling" || current === "accepted" || current === "connected")) {
    await audit(c.callId, { status: "ended", endedAt: now, endedBy: "system", endReason: "superseded" });
  }
  try {
    await CallSession.create({
      callId,
      consultationId: ctx.consultationId,
      therapistId: c.doctorId,
      patientId: c.patientId,
      initiatorId: identity.userId,
      status: "ringing",
      startedAt: now,
    });
  } catch (err) {
    console.warn("[Calls] could not record call session:", err instanceof Error ? err.message : err);
  }
  return { ctx, callId, reused: false };
}

export async function acceptCall(identity: VerifiedIdentity, consultationId: string, callId: string): Promise<CallHandle> {
  const ctx = await loadCallContext(identity, consultationId);
  requireCurrent(ctx, callId);
  if (ctx.consultation.callInitiatorId === identity.userId) {
    throw new CallError(RealtimeErrorCode.CALL_STATE, "You cannot accept your own call.");
  }
  if (ctx.consultation.callStatus === "calling" && ageMs(ctx.consultation.callUpdatedAt) >= RINGING_STALE_MS) {
    await transition(ctx, ["calling"], { callStatus: "idle" }, callId);
    await audit(callId, { status: "ended", endedAt: new Date(), endedBy: "system", endReason: "timeout" });
    throw new CallError(RealtimeErrorCode.CALL_STATE, "This call is no longer ringing.");
  }
  const ok = await transition(ctx, ["calling"], { callStatus: "accepted" }, callId);
  if (!ok) throw new CallError(RealtimeErrorCode.CALL_STATE, "This call is no longer ringing.");
  await audit(callId, { status: "accepted", acceptedAt: new Date() });
  return { ctx, callId };
}

export async function rejectCall(identity: VerifiedIdentity, consultationId: string, callId: string): Promise<CallHandle> {
  const ctx = await loadCallContext(identity, consultationId);
  requireCurrent(ctx, callId);
  if (ctx.consultation.callInitiatorId === identity.userId) {
    throw new CallError(RealtimeErrorCode.CALL_STATE, "Use cancel to withdraw your own call.");
  }
  const ok = await transition(ctx, ["calling"], { callStatus: "idle" }, callId);
  if (!ok) throw new CallError(RealtimeErrorCode.CALL_STATE, "This call is no longer ringing.");
  await audit(callId, { status: "ended", endedAt: new Date(), endedBy: endedByOf(ctx.role), endReason: "rejected" });
  return { ctx, callId };
}

export async function cancelCall(
  identity: VerifiedIdentity,
  consultationId: string,
  callId: string,
  reason: "cancelled" | "timeout" = "cancelled"
): Promise<CallHandle> {
  const ctx = await loadCallContext(identity, consultationId);
  requireCurrent(ctx, callId);
  if (ctx.consultation.callInitiatorId !== identity.userId) {
    throw new CallError(RealtimeErrorCode.CALL_STATE, "Only the caller can cancel a call.");
  }
  const ok = await transition(ctx, ["calling", "accepted"], { callStatus: "idle" }, callId);
  if (!ok) throw new CallError(RealtimeErrorCode.CALL_STATE, "There is no outgoing call to cancel.");
  await audit(callId, { status: "ended", endedAt: new Date(), endedBy: endedByOf(ctx.role), endReason: reason });
  return { ctx, callId };
}

/** Offer must come from the caller after the callee accepted (a later offer is an ICE restart). */
export async function authorizeOffer(identity: VerifiedIdentity, consultationId: string, callId: string): Promise<CallHandle> {
  const ctx = await loadCallContext(identity, consultationId);
  requireCurrent(ctx, callId);
  const s = ctx.consultation.callStatus;
  if ((s !== "accepted" && s !== "connected") || ctx.consultation.callInitiatorId !== identity.userId) {
    throw new CallError(RealtimeErrorCode.CALL_STATE, "Offer not expected right now.");
  }
  return { ctx, callId };
}

/** Answer must come from the callee. It does NOT mark the call connected: only real media does. */
export async function authorizeAnswer(identity: VerifiedIdentity, consultationId: string, callId: string): Promise<CallHandle> {
  const ctx = await loadCallContext(identity, consultationId);
  requireCurrent(ctx, callId);
  const s = ctx.consultation.callStatus;
  if ((s !== "accepted" && s !== "connected") || ctx.consultation.callInitiatorId === identity.userId) {
    throw new CallError(RealtimeErrorCode.CALL_STATE, "Answer not expected right now.");
  }
  return { ctx, callId };
}

export async function authorizeIce(identity: VerifiedIdentity, consultationId: string, callId: string): Promise<CallHandle> {
  const ctx = await loadCallContext(identity, consultationId);
  requireCurrent(ctx, callId);
  const s = ctx.consultation.callStatus;
  if (s !== "accepted" && s !== "connected") {
    throw new CallError(RealtimeErrorCode.CALL_STATE, "No active call negotiation.");
  }
  return { ctx, callId };
}

/**
 * A client reports its peer connection is `connected`. First report wins; later ones (the
 * other side, or an ICE restart recovering) are accepted silently. Returns null for a stale or
 * already-ended call, which the caller simply ignores.
 */
export async function markConnected(
  identity: VerifiedIdentity,
  consultationId: string,
  callId: string
): Promise<(CallHandle & { first: boolean }) | null> {
  const ctx = await loadCallContext(identity, consultationId);
  if (ctx.consultation.callId !== callId) return null;
  const s = ctx.consultation.callStatus;
  if (s === "connected") return { ctx, callId, first: false };
  if (s !== "accepted") return null;
  const ok = await transition(ctx, ["accepted"], { callStatus: "connected" }, callId);
  if (!ok) return null;
  await audit(callId, { status: "active", connectedAt: new Date() });
  return { ctx, callId, first: true };
}

export interface EndResult {
  ctx: CallContext;
  callId?: string;
  /** True only for the request that actually moved a live call to ended. */
  changed: boolean;
  endedBy: CallEndedBy;
  consultationCompleted: boolean;
}

/**
 * Ends the call (idempotent) and optionally concludes the consultation (doctor only). A late or
 * duplicate end for a call that is already over, or for an older call, changes nothing and
 * returns `changed: false` so nothing is re-broadcast and no newer call is disturbed.
 */
export async function endCall(
  identity: VerifiedIdentity,
  consultationId: string,
  opts: { callId?: string; duration?: number; concludeConsultation?: boolean; reason?: string }
): Promise<EndResult> {
  const ctx = await loadCallContext(identity, consultationId);
  const c = ctx.consultation;
  const endedBy = endedByOf(ctx.role);
  let consultationCompleted = false;

  if (opts.concludeConsultation) {
    if (ctx.role !== "doctor") {
      throw new CallError(RealtimeErrorCode.FORBIDDEN, "Only the consulting doctor can conclude a consultation.");
    }
    await connectToDatabase();
    await Consultation.findByIdAndUpdate(c._id, {
      $set: { status: "COMPLETED", roomStatus: "COMPLETED", endedAt: new Date(), ...(opts.duration ? { duration: Math.max(1, Math.round(opts.duration / 60)) } : {}) },
    });
    if (c.appointmentId) {
      await AppointmentRequest.findByIdAndUpdate(c.appointmentId, { status: "completed" });
    }
    consultationCompleted = true;
  }

  const live = c.callStatus === "calling" || c.callStatus === "accepted" || c.callStatus === "connected";
  const matches = !opts.callId || opts.callId === c.callId;
  if (!live || !matches || !c.callId) {
    return { ctx, callId: c.callId, changed: false, endedBy, consultationCompleted };
  }

  const set: Record<string, unknown> = { callStatus: "ended" };
  if (opts.duration && !opts.concludeConsultation) set.duration = Math.max(1, Math.round(opts.duration / 60));
  const ok = await transition(ctx, ["calling", "accepted", "connected"], set, c.callId);
  if (!ok) return { ctx, callId: c.callId, changed: false, endedBy, consultationCompleted };

  const reason = opts.reason === "hangup" || !opts.reason ? `ended_by_${ctx.role === "doctor" ? "therapist" : "patient"}` : opts.reason;
  await audit(c.callId, { status: "ended", endedAt: new Date(), endedBy, endReason: reason });
  return { ctx, callId: c.callId, changed: true, endedBy, consultationCompleted };
}
