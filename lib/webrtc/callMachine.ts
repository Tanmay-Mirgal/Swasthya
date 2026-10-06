/**
 * lib/webrtc/callMachine.ts
 *
 * Pure client-side call lifecycle (no I/O, easy to test):
 *
 *   IDLE → CALL_REQUESTED → CALL_ACCEPTED → NEGOTIATING → CONNECTED → ENDED
 *
 * "CALL_REQUESTED" covers both ringing directions (`direction` says who rang).
 * ENDED is terminal until the user starts a new call (RESET / LOCAL_REQUEST / REMOTE_REQUEST).
 */

export type CallPhase = "IDLE" | "CALL_REQUESTED" | "CALL_ACCEPTED" | "NEGOTIATING" | "CONNECTED" | "ENDED";
export type CallDirection = "outgoing" | "incoming";
export type CallEndReason =
  | "hangup"
  | "rejected"
  | "cancelled"
  | "missed"
  | "peer_disconnected"
  | "negotiation_failed"
  | "connection_lost"
  | "consultation_completed";

export interface CallState {
  phase: CallPhase;
  direction: CallDirection | null;
  peerName?: string;
  endReason?: CallEndReason;
  /** User-facing explanation when the call ended abnormally. */
  message?: string;
}

export type CallAction =
  | { type: "LOCAL_REQUEST" }
  | { type: "REMOTE_REQUEST"; peerName?: string }
  | { type: "LOCAL_ACCEPT" }
  | { type: "REMOTE_ACCEPT" }
  | { type: "NEGOTIATION_STARTED" }
  | { type: "PEER_CONNECTED" }
  | { type: "END"; reason: CallEndReason; message?: string }
  | { type: "RESET" };

export const initialCallState: CallState = { phase: "IDLE", direction: null };

export const END_MESSAGES: Record<CallEndReason, string> = {
  hangup: "The call has ended.",
  rejected: "The call was declined.",
  cancelled: "The caller hung up before you answered.",
  missed: "No answer. You can try calling again.",
  peer_disconnected: "The other participant disconnected.",
  negotiation_failed: "We couldn't establish a video connection. Check your network and try again.",
  connection_lost: "The connection was lost. You can try calling again.",
  consultation_completed: "The consultation has been completed.",
};

export function callReducer(state: CallState, action: CallAction): CallState {
  switch (action.type) {
    case "LOCAL_REQUEST":
      if (state.phase !== "IDLE" && state.phase !== "ENDED") return state;
      return { phase: "CALL_REQUESTED", direction: "outgoing" };

    case "REMOTE_REQUEST":
      if (state.phase !== "IDLE" && state.phase !== "ENDED") return state;
      return { phase: "CALL_REQUESTED", direction: "incoming", peerName: action.peerName };

    case "LOCAL_ACCEPT":
      if (state.phase !== "CALL_REQUESTED" || state.direction !== "incoming") return state;
      return { ...state, phase: "CALL_ACCEPTED" };

    case "REMOTE_ACCEPT":
      if (state.phase !== "CALL_REQUESTED" || state.direction !== "outgoing") return state;
      return { ...state, phase: "CALL_ACCEPTED" };

    case "NEGOTIATION_STARTED":
      if (state.phase !== "CALL_ACCEPTED" && state.phase !== "NEGOTIATING") return state;
      return { ...state, phase: "NEGOTIATING" };

    case "PEER_CONNECTED":
      if (state.phase !== "NEGOTIATING" && state.phase !== "CALL_ACCEPTED" && state.phase !== "CONNECTED") return state;
      return { ...state, phase: "CONNECTED" };

    case "END":
      if (state.phase === "IDLE" || state.phase === "ENDED") return state;
      return {
        phase: "ENDED",
        direction: state.direction,
        peerName: state.peerName,
        endReason: action.reason,
        message: action.message ?? END_MESSAGES[action.reason],
      };

    case "RESET":
      return initialCallState;
  }
}

export const isCallActive = (s: CallState) =>
  s.phase === "CALL_ACCEPTED" || s.phase === "NEGOTIATING" || s.phase === "CONNECTED";
export const isRinging = (s: CallState) => s.phase === "CALL_REQUESTED";
export const isIncomingRing = (s: CallState) => s.phase === "CALL_REQUESTED" && s.direction === "incoming";
export const isBusy = (s: CallState) => s.phase !== "IDLE" && s.phase !== "ENDED";
