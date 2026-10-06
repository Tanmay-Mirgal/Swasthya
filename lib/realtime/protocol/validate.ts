/**
 * lib/realtime/protocol/validate.ts
 *
 * Runtime validation for inbound packets. Nothing from the network is trusted;
 * each guard returns a cleaned payload or null (→ MALFORMED error).
 */

import { isRealtimeEvent, RealtimeEventType } from "./events";
import type {
  CallAcceptPayload,
  CallCancelPayload,
  CallCreatePayload,
  CallEndPayload,
  CallRejectPayload,
  WebrtcAnswerPayload,
  WebrtcIcePayload,
  WebrtcOfferPayload,
} from "./packets";

const MAX_PACKET_BYTES = 128 * 1024;
const MAX_SDP_LENGTH = 100_000;
const MAX_CANDIDATE_LENGTH = 2_000;

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function str(v: unknown, max = 200): string | null {
  return typeof v === "string" && v.length > 0 && v.length <= max ? v : null;
}

export interface ParsedEnvelope {
  event: RealtimeEventType;
  roomId?: string;
  payload: Obj;
}

export function parseEnvelope(raw: string): ParsedEnvelope | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_PACKET_BYTES) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(json) || !isRealtimeEvent(json.event)) return null;
  const roomId = json.roomId === undefined ? undefined : str(json.roomId);
  if (json.roomId !== undefined && !roomId) return null;
  const payload = json.payload === undefined ? {} : json.payload;
  if (!isObj(payload)) return null;
  return { event: json.event, roomId: roomId ?? undefined, payload };
}

export function isKnownEventName(raw: string): boolean {
  try {
    const json = JSON.parse(raw);
    return isObj(json) && isRealtimeEvent(json.event);
  } catch {
    return false;
  }
}

export function validateCallCreate(p: Obj): CallCreatePayload | null {
  const consultationId = str(p.consultationId);
  if (!consultationId) return null;
  return { consultationId, callerName: typeof p.callerName === "string" ? p.callerName.slice(0, 100) : undefined };
}
export function validateCallAccept(p: Obj): CallAcceptPayload | null {
  const consultationId = str(p.consultationId);
  return consultationId ? { consultationId } : null;
}
export function validateCallReject(p: Obj): CallRejectPayload | null {
  const consultationId = str(p.consultationId);
  if (!consultationId) return null;
  return { consultationId, reason: typeof p.reason === "string" ? p.reason.slice(0, 200) : undefined };
}
export function validateCallCancel(p: Obj): CallCancelPayload | null {
  const consultationId = str(p.consultationId);
  return consultationId ? { consultationId } : null;
}
export function validateCallEnd(p: Obj): CallEndPayload | null {
  const consultationId = str(p.consultationId);
  if (!consultationId) return null;
  const reasons = ["hangup", "peer_disconnected", "negotiation_failed", "timeout"] as const;
  const reason = reasons.find((r) => r === p.reason);
  return {
    consultationId,
    duration: typeof p.duration === "number" && p.duration >= 0 && p.duration < 86_400 ? Math.floor(p.duration) : undefined,
    concludeConsultation: p.concludeConsultation === true,
    reason,
  };
}

export function validateOffer(p: Obj): WebrtcOfferPayload | null {
  const consultationId = str(p.consultationId);
  if (!consultationId || !isObj(p.sdp)) return null;
  const sdp = str(p.sdp.sdp, MAX_SDP_LENGTH);
  if (p.sdp.type !== "offer" || !sdp) return null;
  return { consultationId, sdp: { type: "offer", sdp } };
}
export function validateAnswer(p: Obj): WebrtcAnswerPayload | null {
  const consultationId = str(p.consultationId);
  if (!consultationId || !isObj(p.sdp)) return null;
  const sdp = str(p.sdp.sdp, MAX_SDP_LENGTH);
  if (p.sdp.type !== "answer" || !sdp) return null;
  return { consultationId, sdp: { type: "answer", sdp } };
}
export function validateIce(p: Obj): WebrtcIcePayload | null {
  const consultationId = str(p.consultationId);
  if (!consultationId || !isObj(p.candidate)) return null;
  const c = p.candidate;
  if (c.candidate !== undefined && (typeof c.candidate !== "string" || c.candidate.length > MAX_CANDIDATE_LENGTH)) return null;
  return {
    consultationId,
    candidate: {
      candidate: c.candidate as string | undefined,
      sdpMid: typeof c.sdpMid === "string" ? c.sdpMid : null,
      sdpMLineIndex: typeof c.sdpMLineIndex === "number" ? c.sdpMLineIndex : null,
      usernameFragment: typeof c.usernameFragment === "string" ? c.usernameFragment : null,
    },
  };
}
