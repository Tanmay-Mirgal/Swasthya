/**
 * lib/realtime/server/callService.ts
 *
 * Server-side call state machine. The authoritative state lives on the Consultation
 * document (`callStatus`, `callInitiatorId`, `callUpdatedAt`), never in process memory:
 *
 *   idle|ended ──CALL_CREATE──▶ calling ──CALL_ACCEPT──▶ accepted ──WEBRTC_ANSWER──▶ connected
 *        ▲                         │ reject/cancel              │ end                     │ end
 *        └─────────────────────────┴────────────────────────────┴─────────────────────────┘
 *
 * Media never touches the server; this only gates and relays signaling.
 */

import connectToDatabase from "@/lib/mongodb";
import Consultation, { IConsultation } from "@/models/Consultation";
import AppointmentRequest from "@/models/AppointmentRequest";
import { canJoinConsultation } from "@/types/appointment";
import { Rooms } from "../protocol/rooms";
import { resolveConsultation, type VerifiedIdentity } from "../auth/verifier";
import { isUserPresent } from "./presence";
import { RealtimeErrorCode, type RealtimeErrorCodeType } from "../protocol/events";

export type CallRole = "patient" | "doctor";

export interface CallContext {
  consultation: IConsultation;
  consultationId: string;
  roomId: string;
  role: CallRole;
  peerUserId: string;
}

export class CallError extends Error {
  constructor(public code: RealtimeErrorCodeType, message: string) {
    super(message);
  }
}

const RINGING_STALE_MS = 60_000;

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

/** Atomically move callStatus from an expected value; returns false if someone else changed it first. */
async function transition(
  ctx: CallContext,
  expected: IConsultation["callStatus"][] ,
  update: Record<string, unknown>
): Promise<boolean> {
  const res = await Consultation.findOneAndUpdate(
    { _id: ctx.consultation._id, callStatus: { $in: expected } },
    { $set: { ...update, callUpdatedAt: new Date() } },
    { returnDocument: "after" }
  );
  return Boolean(res);
}

export async function createCall(identity: VerifiedIdentity, consultationId: string): Promise<CallContext> {
  const ctx = await loadCallContext(identity, consultationId);
  const c = ctx.consultation;

  if (c.status !== "ACTIVE") {
    throw new CallError(RealtimeErrorCode.CALL_NOT_ALLOWED, "This consultation is not open for calls.");
  }
  if (!(await scheduledWindowOk(c))) {
    throw new CallError(RealtimeErrorCode.CALL_NOT_ALLOWED, "The consultation room is not open yet.");
  }

  const current = c.callStatus || "idle";
  let startable = current === "idle" || current === "ended" || c.callInitiatorId === identity.userId;
  if (!startable && current === "calling") {
    startable = !c.callUpdatedAt || Date.now() - new Date(c.callUpdatedAt).getTime() > RINGING_STALE_MS;
  }
  if (!startable && (current === "accepted" || current === "connected")) {
    // A stuck call whose other side is no longer present anywhere is stale.
    startable = !(await isUserPresent(ctx.roomId, ctx.peerUserId));
  }
  if (!startable) {
    throw new CallError(RealtimeErrorCode.CALL_STATE, "A call is already in progress for this consultation.");
  }

  const ok = await transition(ctx, [current], {
    callStatus: "calling",
    callInitiatorId: identity.userId,
    startedAt: new Date(),
  });
  if (!ok) throw new CallError(RealtimeErrorCode.CALL_STATE, "The call state just changed. Please try again.");
  return ctx;
}

export async function acceptCall(identity: VerifiedIdentity, consultationId: string): Promise<CallContext> {
  const ctx = await loadCallContext(identity, consultationId);
  if (ctx.consultation.callInitiatorId === identity.userId) {
    throw new CallError(RealtimeErrorCode.CALL_STATE, "You cannot accept your own call.");
  }
  const ok = await transition(ctx, ["calling"], { callStatus: "accepted" });
  if (!ok) throw new CallError(RealtimeErrorCode.CALL_STATE, "This call is no longer ringing.");
  return ctx;
}

export async function rejectCall(identity: VerifiedIdentity, consultationId: string): Promise<CallContext> {
  const ctx = await loadCallContext(identity, consultationId);
  if (ctx.consultation.callInitiatorId === identity.userId) {
    throw new CallError(RealtimeErrorCode.CALL_STATE, "Use cancel to withdraw your own call.");
  }
  const ok = await transition(ctx, ["calling"], { callStatus: "idle" });
  if (!ok) throw new CallError(RealtimeErrorCode.CALL_STATE, "This call is no longer ringing.");
  return ctx;
}

export async function cancelCall(identity: VerifiedIdentity, consultationId: string): Promise<CallContext> {
  const ctx = await loadCallContext(identity, consultationId);
  if (ctx.consultation.callInitiatorId !== identity.userId) {
    throw new CallError(RealtimeErrorCode.CALL_STATE, "Only the caller can cancel a call.");
  }
  const ok = await transition(ctx, ["calling", "accepted"], { callStatus: "idle" });
  if (!ok) throw new CallError(RealtimeErrorCode.CALL_STATE, "There is no outgoing call to cancel.");
  return ctx;
}

/** Offer must come from the caller after the callee accepted. */
export async function authorizeOffer(identity: VerifiedIdentity, consultationId: string): Promise<CallContext> {
  const ctx = await loadCallContext(identity, consultationId);
  if (ctx.consultation.callStatus !== "accepted" || ctx.consultation.callInitiatorId !== identity.userId) {
    throw new CallError(RealtimeErrorCode.CALL_STATE, "Offer not expected right now.");
  }
  return ctx;
}

/** Answer must come from the callee while the call is accepted; marks the call connected. */
export async function authorizeAnswer(identity: VerifiedIdentity, consultationId: string): Promise<CallContext> {
  const ctx = await loadCallContext(identity, consultationId);
  if (ctx.consultation.callInitiatorId === identity.userId) {
    throw new CallError(RealtimeErrorCode.CALL_STATE, "Answer not expected from the caller.");
  }
  const ok = await transition(ctx, ["accepted"], { callStatus: "connected" });
  if (!ok) throw new CallError(RealtimeErrorCode.CALL_STATE, "Answer not expected right now.");
  return ctx;
}

export async function authorizeIce(identity: VerifiedIdentity, consultationId: string): Promise<CallContext> {
  const ctx = await loadCallContext(identity, consultationId);
  const s = ctx.consultation.callStatus;
  if (s !== "accepted" && s !== "connected") {
    throw new CallError(RealtimeErrorCode.CALL_STATE, "No active call negotiation.");
  }
  return ctx;
}

export async function endCall(
  identity: VerifiedIdentity,
  consultationId: string,
  opts: { duration?: number; concludeConsultation?: boolean }
): Promise<CallContext> {
  const ctx = await loadCallContext(identity, consultationId);
  const update: Record<string, unknown> = { callStatus: "ended", callUpdatedAt: new Date() };
  if (opts.duration) update.duration = Math.max(1, Math.round(opts.duration / 60));

  if (opts.concludeConsultation) {
    if (ctx.role !== "doctor") {
      throw new CallError(RealtimeErrorCode.FORBIDDEN, "Only the consulting doctor can conclude a consultation.");
    }
    update.status = "COMPLETED";
    update.roomStatus = "COMPLETED";
    update.endedAt = new Date();
    if (ctx.consultation.appointmentId) {
      await AppointmentRequest.findByIdAndUpdate(ctx.consultation.appointmentId, { status: "completed" });
    }
  }
  await connectToDatabase();
  await Consultation.findByIdAndUpdate(ctx.consultation._id, { $set: update });
  return ctx;
}
