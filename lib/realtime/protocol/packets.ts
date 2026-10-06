/**
 * lib/realtime/protocol/packets.ts
 *
 * Strongly-typed payloads for every realtime event and the wire envelope.
 */

import type { RealtimeEventType } from "./events";

export type RealtimeRole = "patient" | "doctor" | "system";

export interface RealtimeIdentityInfo {
  userId: string;
  role: RealtimeRole;
  name?: string;
}

/** Wire envelope, both directions. `from` is set by the server on relayed events. */
export interface RealtimePacket<T = unknown> {
  event: RealtimeEventType;
  roomId?: string;
  payload: T;
  from?: RealtimeIdentityInfo;
  timestamp?: number;
  eventId?: string;
}

// ── Connection ─────────────────────────────────────────────────────────────
export interface AuthenticatePayload { token: string }
export interface AuthenticatedPayload {
  userId: string;
  role: RealtimeRole;
  name?: string;
  sessionId: string;
}
export interface JoinRoomPayload { roomId: string }
export interface RoomJoinedPayload { roomId: string }
export interface LeaveRoomPayload { roomId: string }
export interface ErrorPayload {
  code: string;
  message: string;
  roomId?: string;
}

// ── Presence ───────────────────────────────────────────────────────────────
export interface PresenceUpdatePayload {
  roomId: string;
  activeUserCount: number;
  online: boolean;
  users: RealtimeIdentityInfo[];
}
export interface UserPresencePayload {
  roomId: string;
  userId: string;
  role: RealtimeRole;
}

// ── Chat ───────────────────────────────────────────────────────────────────
export interface ChatMessageDTO {
  _id: string;
  consultationId?: string;
  conversationId?: string;
  senderId: string;
  senderRole: RealtimeRole;
  receiverId?: string;
  content: string;
  type: "text" | "prescription" | "call_summary" | "exercise_card" | "system";
  prescriptionData?: Record<string, unknown>;
  read: boolean;
  clientId?: string;
  createdAt: string;
}
export type ChatMessagePayload = ChatMessageDTO;

export interface MessageReadPayload {
  messageIds: string[];
  readerId: string;
  consultationId?: string;
  conversationId?: string;
}

export interface TypingPayload {
  roomId?: string;
}
export interface TypingRelayPayload {
  roomId: string;
  userId: string;
  role: RealtimeRole;
  isTyping: boolean;
}

// ── Calls ──────────────────────────────────────────────────────────────────
// Every call event after CALL_CREATE carries the server-issued `callId`. The server
// only honours events for the consultation's CURRENT call; a late event from an older
// call is ignored, so it can never end or corrupt a newer one.

/** Why a call ended, as reported by a client (the server adds who ended it). */
export type CallEndReasonWire = "hangup" | "timeout" | "connection_failed" | "participant_disconnected";
/** Who ended the call, derived by the server from the authenticated identity. */
export type CallEndedBy = "doctor" | "patient" | "system";

export interface CallCreatePayload { consultationId: string; callerName?: string }
export interface CallAcceptPayload { consultationId: string; callId: string }
export interface CallRejectPayload { consultationId: string; callId: string; reason?: string }
export interface CallCancelPayload { consultationId: string; callId: string; reason?: "cancelled" | "timeout" }
export interface CallConnectedPayload { consultationId: string; callId: string }
export interface CallEndPayload {
  consultationId: string;
  /** Optional: a doctor concluding the consultation may do so with no live call. */
  callId?: string;
  duration?: number;
  /** Doctor only: also close the consultation (status COMPLETED). */
  concludeConsultation?: boolean;
  reason?: CallEndReasonWire;
}

export interface WebrtcOfferPayload {
  consultationId: string;
  callId: string;
  sdp: { type: "offer"; sdp: string };
}
export interface WebrtcAnswerPayload {
  consultationId: string;
  callId: string;
  sdp: { type: "answer"; sdp: string };
}
export interface WebrtcIcePayload {
  consultationId: string;
  callId: string;
  candidate: {
    candidate?: string;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
    usernameFragment?: string | null;
  };
}

// ── Clinical ───────────────────────────────────────────────────────────────
export interface PrescriptionReceivedPayload {
  consultationId: string;
  prescription: unknown;
  message?: ChatMessageDTO;
}
export interface RecoveryPlanUpdatedPayload {
  patientId: string;
  exercisesCount: number;
}

// ── Server → client payload map (drives typed `client.on(...)`) ─────────────
export interface CallRelayBase { consultationId: string; callId: string }
export interface CallRejectRelay extends CallRelayBase { reason?: string }
export interface CallEndRelay {
  consultationId: string;
  callId?: string;
  duration?: number;
  reason?: CallEndReasonWire;
  endedBy?: CallEndedBy;
  consultationCompleted?: boolean;
}
/** CALL_ACCEPT / CALL_REJECT / CALL_CANCEL / CALL_END mirrored to the sender's OTHER connections. */
export interface CallMirrorInfo { mirrored?: boolean }

export interface ServerEventPayloads {
  AUTHENTICATED: AuthenticatedPayload;
  ROOM_JOINED: RoomJoinedPayload & { requestedRoomId?: string };
  ERROR: ErrorPayload;
  PONG: { timestamp: number };
  PRESENCE_UPDATE: PresenceUpdatePayload;
  USER_JOINED: UserPresencePayload;
  USER_LEFT: UserPresencePayload;
  CHAT_MESSAGE: ChatMessageDTO;
  MESSAGE_READ: MessageReadPayload;
  TYPING_START: TypingRelayPayload;
  TYPING_STOP: TypingRelayPayload;
  CALL_CREATE: CallRelayBase & { callerName?: string };
  CALL_CREATED: CallRelayBase;
  CALL_ACCEPT: CallRelayBase & CallMirrorInfo;
  CALL_REJECT: CallRejectRelay & CallMirrorInfo;
  CALL_CANCEL: CallRelayBase & CallMirrorInfo & { reason?: "cancelled" | "timeout" };
  CALL_END: CallEndRelay & CallMirrorInfo;
  WEBRTC_OFFER: WebrtcOfferPayload;
  WEBRTC_ANSWER: WebrtcAnswerPayload;
  WEBRTC_ICE_CANDIDATE: WebrtcIcePayload;
  PRESCRIPTION_RECEIVED: PrescriptionReceivedPayload;
  RECOVERY_PLAN_UPDATED: RecoveryPlanUpdatedPayload;
}
