/**
 * lib/realtime/protocol/events.ts
 *
 * Canonical typed event dictionary for RehabLens realtime communication.
 * Shared between server and client — never use raw event strings elsewhere.
 */

export const RealtimeEvent = {
  // Connection lifecycle
  AUTHENTICATE: "AUTHENTICATE",
  AUTHENTICATED: "AUTHENTICATED",
  JOIN_ROOM: "JOIN_ROOM",
  ROOM_JOINED: "ROOM_JOINED",
  LEAVE_ROOM: "LEAVE_ROOM",
  ERROR: "ERROR",
  PING: "PING",
  PONG: "PONG",

  // Presence
  USER_JOINED: "USER_JOINED",
  USER_LEFT: "USER_LEFT",
  PRESENCE_UPDATE: "PRESENCE_UPDATE",

  // Chat (messages are persisted over REST, then delivered with CHAT_MESSAGE)
  CHAT_MESSAGE: "CHAT_MESSAGE",
  MESSAGE_READ: "MESSAGE_READ",
  TYPING_START: "TYPING_START",
  TYPING_STOP: "TYPING_STOP",

  // Call lifecycle (consultation-scoped)
  CALL_CREATE: "CALL_CREATE",
  CALL_ACCEPT: "CALL_ACCEPT",
  CALL_REJECT: "CALL_REJECT",
  CALL_CANCEL: "CALL_CANCEL",
  CALL_END: "CALL_END",
  /** Client → server: this client's peer connection reached `connected`. Only then is a call "connected". */
  CALL_CONNECTED: "CALL_CONNECTED",
  /** Server → creator only: acknowledges CALL_CREATE and carries the server-issued callId. */
  CALL_CREATED: "CALL_CREATED",

  // WebRTC signaling (media itself is peer-to-peer)
  WEBRTC_OFFER: "WEBRTC_OFFER",
  WEBRTC_ANSWER: "WEBRTC_ANSWER",
  WEBRTC_ICE_CANDIDATE: "WEBRTC_ICE_CANDIDATE",

  // Clinical
  PRESCRIPTION_RECEIVED: "PRESCRIPTION_RECEIVED",
  RECOVERY_PLAN_UPDATED: "RECOVERY_PLAN_UPDATED",
} as const;

export type RealtimeEventType = (typeof RealtimeEvent)[keyof typeof RealtimeEvent];

const EVENT_VALUES = new Set<string>(Object.values(RealtimeEvent));

export function isRealtimeEvent(value: unknown): value is RealtimeEventType {
  return typeof value === "string" && EVENT_VALUES.has(value);
}

/** Events a client is allowed to send to the server. Everything else is rejected. */
export const CLIENT_TO_SERVER_EVENTS: ReadonlySet<RealtimeEventType> = new Set([
  RealtimeEvent.AUTHENTICATE,
  RealtimeEvent.JOIN_ROOM,
  RealtimeEvent.LEAVE_ROOM,
  RealtimeEvent.PING,
  RealtimeEvent.TYPING_START,
  RealtimeEvent.TYPING_STOP,
  RealtimeEvent.CALL_CREATE,
  RealtimeEvent.CALL_ACCEPT,
  RealtimeEvent.CALL_REJECT,
  RealtimeEvent.CALL_CANCEL,
  RealtimeEvent.CALL_END,
  RealtimeEvent.CALL_CONNECTED,
  RealtimeEvent.WEBRTC_OFFER,
  RealtimeEvent.WEBRTC_ANSWER,
  RealtimeEvent.WEBRTC_ICE_CANDIDATE,
]);

/** Machine-readable error codes. Messages shown to users are mapped from these. */
export const RealtimeErrorCode = {
  AUTH_REQUIRED: "AUTH_REQUIRED",
  AUTH_FAILED: "AUTH_FAILED",
  FORBIDDEN: "FORBIDDEN",
  NOT_IN_ROOM: "NOT_IN_ROOM",
  MALFORMED: "MALFORMED",
  UNKNOWN_EVENT: "UNKNOWN_EVENT",
  CALL_NOT_ALLOWED: "CALL_NOT_ALLOWED",
  CALL_STATE: "CALL_STATE",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL: "INTERNAL",
} as const;

export type RealtimeErrorCodeType = (typeof RealtimeErrorCode)[keyof typeof RealtimeErrorCode];
