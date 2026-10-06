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
export interface CallCreatePayload { consultationId: string; callerName?: string }
export interface CallAcceptPayload { consultationId: string }
export interface CallRejectPayload { consultationId: string; reason?: string }
export interface CallCancelPayload { consultationId: string }
export interface CallEndPayload {
  consultationId: string;
  duration?: number;
  /** Doctor only: also close the consultation (status COMPLETED). */
  concludeConsultation?: boolean;
  reason?: "hangup" | "peer_disconnected" | "negotiation_failed" | "timeout";
}

export interface WebrtcOfferPayload {
  consultationId: string;
  sdp: { type: "offer"; sdp: string };
}
export interface WebrtcAnswerPayload {
  consultationId: string;
  sdp: { type: "answer"; sdp: string };
}
export interface WebrtcIcePayload {
  consultationId: string;
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
export interface CallRelayBase { consultationId: string }
export interface CallRejectRelay extends CallRelayBase { reason?: string }
export interface CallEndRelay extends CallRelayBase {
  duration?: number;
  reason?: "hangup" | "peer_disconnected" | "negotiation_failed" | "timeout";
  consultationCompleted?: boolean;
}

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
  CALL_CREATE: CallRelayBase;
  CALL_ACCEPT: CallRelayBase;
  CALL_REJECT: CallRejectRelay;
  CALL_CANCEL: CallRelayBase;
  CALL_END: CallEndRelay;
  WEBRTC_OFFER: WebrtcOfferPayload;
  WEBRTC_ANSWER: WebrtcAnswerPayload;
  WEBRTC_ICE_CANDIDATE: WebrtcIcePayload;
  PRESCRIPTION_RECEIVED: PrescriptionReceivedPayload;
  RECOVERY_PLAN_UPDATED: RecoveryPlanUpdatedPayload;
}
