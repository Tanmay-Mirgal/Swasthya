/**
 * lib/webrtc/callMachine.ts
 *
 * Pure client-side call lifecycle (no I/O, easy to test). One explicit state at a time:
 *
 *   IDLE
 *    ├─ LOCAL_REQUEST ─▶ OUTGOING_RINGING ─ REMOTE_ACCEPT ─┐
 *    └─ REMOTE_REQUEST ▶ INCOMING_RINGING ─ LOCAL_ACCEPT ─▶ ACCEPTING ─ NEGOTIATION_STARTED ─┐
 *                                                                                            ▼
 *                                                          CONNECTING ─ PEER_CONNECTED ─▶ CONNECTED
 *   any busy state ─ END_BEGIN ─▶ ENDING ─ END ─▶ ENDED ─ RESET ─▶ IDLE
 *
 * Why it ended (rejected, timeout, failed, disconnected, ...) is `endReason` on ENDED; it is
 * not a separate state. ENDED is terminal until the next call or RESET, and END is idempotent.
 */

export type CallPhase =
  | "IDLE"
  | "OUTGOING_RINGING"
  | "INCOMING_RINGING"
  | "ACCEPTING"
  | "CONNECTING"
  | "CONNECTED"
  | "ENDING"
  | "ENDED";

export type CallDirection = "outgoing" | "incoming";

export type CallEndReason =
  | "ended_by_therapist"
  | "ended_by_patient"
  | "ended_by_self"
  | "rejected"
  | "cancelled"
  | "timeout"
  | "answered_elsewhere"
  | "connection_failed"
  | "connection_lost"
  | "participant_disconnected"
  | "consultation_completed"
  | "media_unavailable"
  | "call_ended";

export interface CallState {
  phase: CallPhase;
  direction: CallDirection | null;
  /** Server-issued id of this call. Null only briefly while an outgoing call awaits its ack. */
  callId: string | null;
  peerName?: string;
  endReason?: CallEndReason;
  /** User-facing explanation of how/why the call ended. */
  message?: string;
}

export type CallAction =
  | { type: "LOCAL_REQUEST" }
  | { type: "REMOTE_REQUEST"; callId: string; peerName?: string }
  | { type: "CALL_ID"; callId: string }
  | { type: "LOCAL_ACCEPT" }
  | { type: "REMOTE_ACCEPT" }
  | { type: "NEGOTIATION_STARTED" }
  | { type: "PEER_CONNECTED" }
  | { type: "END_BEGIN" }
  | { type: "END"; reason: CallEndReason; message?: string }
  | { type: "RESET" };

export const initialCallState: CallState = { phase: "IDLE", direction: null, callId: null };

export const END_MESSAGES: Record<CallEndReason, string> = {
  ended_by_therapist: "Your therapist ended the call.",
  ended_by_patient: "The patient ended the call.",
  ended_by_self: "The call has ended.",
  rejected: "The call was declined.",
  cancelled: "The caller hung up before you answered.",
  timeout: "No answer. You can try calling again.",
  answered_elsewhere: "This call was answered on another device.",
  connection_failed: "We couldn't establish a video connection. Check your network and try again.",
  connection_lost: "The connection was lost. You can try calling again.",
  participant_disconnected: "The other participant disconnected.",
  consultation_completed: "The consultation has been completed.",
  media_unavailable: "We couldn't access your camera or microphone.",
  call_ended: "The call has ended.",
};

const BUSY: CallPhase[] = ["OUTGOING_RINGING", "INCOMING_RINGING", "ACCEPTING", "CONNECTING", "CONNECTED", "ENDING"];

export function callReducer(state: CallState, action: CallAction): CallState {
  switch (action.type) {
    case "LOCAL_REQUEST":
      if (state.phase !== "IDLE" && state.phase !== "ENDED") return state;
      return { phase: "OUTGOING_RINGING", direction: "outgoing", callId: null };

    case "REMOTE_REQUEST":
      if (state.phase !== "IDLE" && state.phase !== "ENDED") return state;
      return { phase: "INCOMING_RINGING", direction: "incoming", callId: action.callId, peerName: action.peerName };

    case "CALL_ID":
      if (state.direction !== "outgoing" || state.callId || !BUSY.includes(state.phase)) return state;
      return { ...state, callId: action.callId };

    case "LOCAL_ACCEPT":
      if (state.phase !== "INCOMING_RINGING") return state;
      return { ...state, phase: "ACCEPTING" };

    case "REMOTE_ACCEPT":
      if (state.phase !== "OUTGOING_RINGING") return state;
      return { ...state, phase: "CONNECTING" };

    case "NEGOTIATION_STARTED":
      if (state.phase !== "ACCEPTING") return state;
      return { ...state, phase: "CONNECTING" };

    case "PEER_CONNECTED":
      if (state.phase !== "CONNECTING" && state.phase !== "ACCEPTING" && state.phase !== "CONNECTED") return state;
      return { ...state, phase: "CONNECTED" };

    case "END_BEGIN":
      if (!BUSY.includes(state.phase) || state.phase === "ENDING") return state;
      return { ...state, phase: "ENDING" };

    case "END":
      if (state.phase === "IDLE" || state.phase === "ENDED") return state;
      return {
        phase: "ENDED",
        direction: state.direction,
        callId: state.callId,
        peerName: state.peerName,
        endReason: action.reason,
        message: action.message ?? END_MESSAGES[action.reason],
      };

    case "RESET":
      return initialCallState;
  }
}

export const isBusy = (s: CallState) => BUSY.includes(s.phase);
export const isRinging = (s: CallState) => s.phase === "OUTGOING_RINGING" || s.phase === "INCOMING_RINGING";
export const isIncomingRing = (s: CallState) => s.phase === "INCOMING_RINGING";
/** Accepted but media is not flowing yet. */
export const isConnecting = (s: CallState) => s.phase === "ACCEPTING" || s.phase === "CONNECTING";
export const isCallActive = (s: CallState) => s.phase === "CONNECTED";
