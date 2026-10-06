/**
 * lib/realtime/client/useConsultation.ts
 *
 * Orchestrates one consultation room: realtime room membership, presence, the call
 * lifecycle (callMachine) and WebRTC signaling (offer/answer/ICE) on top of useWebRTC.
 * Components render from the returned state and call requestCall/acceptCall/endCall;
 * they never touch sockets or RTCPeerConnection.
 *
 * Authority lives on the server (callService.ts). This hook only reflects it and
 * cleans up locally when the server or peer says the call is over.
 */

"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { RealtimeEvent } from "../protocol/events";
import { Rooms } from "../protocol/rooms";
import type { CallEndPayload, PrescriptionReceivedPayload } from "../protocol/packets";
import {
  CallAction,
  CallEndReason,
  CallState,
  callReducer,
  END_MESSAGES,
  initialCallState,
  isBusy,
} from "@/lib/webrtc/callMachine";
import { PeerSession } from "@/lib/webrtc/peerSession";
import { useWebRTC, UseWebRTCResult } from "@/lib/webrtc/useWebRTC";
import { ConnectionStatus } from "./realtimeClient";
import { useRealtime } from "./useRealtime";

const RING_TIMEOUT_MS = 45_000;
const INCOMING_RING_MS = 60_000;
const PEER_GONE_GRACE_MS = 15_000;
const ICE_DISCONNECT_GRACE_MS = 8_000;
const ENDED_BANNER_MS = 6_000;

export interface ServerCallState {
  callStatus: string;
  callInitiatorId?: string;
  callUpdatedAt?: string | Date;
  completed: boolean;
}

export interface UseConsultationOptions {
  /** Canonical consultation _id. Null until the consultation has loaded. */
  consultationId: string | null;
  selfId: string | undefined;
  peerName?: string;
  /** False when the room is closed (outside the join window / completed). */
  enabled: boolean;
  /** Loads the server-side call state (used to reconcile after a reconnect). */
  loadCallState?: () => Promise<ServerCallState | null>;
  onConsultationCompleted?: () => void;
  onPrescription?: (payload: PrescriptionReceivedPayload) => void;
}

export interface UseConsultationResult extends Omit<UseWebRTCResult, "prepareMedia" | "startSession" | "getSession" | "releaseCall"> {
  call: CallState;
  isIncomingRing: boolean;
  incomingCallerName?: string;
  callDuration: number;
  connectionStatus: ConnectionStatus;
  peerOnline: boolean;
  onlineUsers: number;
  error: string | null;
  clearError: () => void;
  consultationCompleted: boolean;
  /** Camera preview before/without a call. */
  startPreview: () => Promise<boolean>;
  requestCall: () => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  /** Hang up / cancel / decline as appropriate for the current phase. */
  endCall: (opts?: { concludeConsultation?: boolean }) => void;
  /** Apply the server-side call state fetched with the consultation (e.g. a call already ringing). */
  syncServerCallState: (state: ServerCallState) => void;
}

export function useConsultation(options: UseConsultationOptions): UseConsultationResult {
  const { consultationId, enabled } = options;
  const { client, status } = useRealtime();
  const media = useWebRTC();

  const [call, setCall] = useReducer(
    (s: CallState, a: CallAction | { type: "SET"; state: CallState }) => ("state" in a ? a.state : callReducer(s, a)),
    initialCallState
  );
  const [callDuration, setCallDuration] = useState(0);
  const [peerOnline, setPeerOnline] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [consultationCompleted, setConsultationCompleted] = useState(false);

  // Synchronous mirrors for use inside async handlers.
  const callRef = useRef<CallState>(initialCallState);
  const optsRef = useRef(options);
  const mediaRef = useRef(media);
  const durationRef = useRef(0);
  const connectedAtRef = useRef<number | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const peerWasOnline = useRef(false);

  const timers = useRef<{
    ring?: ReturnType<typeof setTimeout>;
    peerGone?: ReturnType<typeof setTimeout>;
    iceDown?: ReturnType<typeof setTimeout>;
    duration?: ReturnType<typeof setInterval>;
    ended?: ReturnType<typeof setTimeout>;
  }>({});

  useEffect(() => {
    optsRef.current = options;
    mediaRef.current = media;
  });

  const apply = useCallback((action: CallAction) => {
    const next = callReducer(callRef.current, action);
    callRef.current = next;
    setCall({ type: "SET", state: next });
    return next;
  }, []);

  const clearTimers = useCallback(() => {
    const t = timers.current;
    if (t.ring) clearTimeout(t.ring);
    if (t.peerGone) clearTimeout(t.peerGone);
    if (t.iceDown) clearTimeout(t.iceDown);
    if (t.duration) clearInterval(t.duration);
    t.ring = t.peerGone = t.iceDown = t.duration = undefined;
    connectedAtRef.current = null;
  }, []);

  const send = useCallback(
    (event: (typeof RealtimeEvent)[keyof typeof RealtimeEvent], payload: Record<string, unknown>): boolean => {
      const consultation = optsRef.current.consultationId;
      if (!consultation) return false;
      return client.emit(event, { consultationId: consultation, ...payload }, Rooms.consultation(consultation));
    },
    [client]
  );

  /** Tear down media/timers and show the end state; optionally tell the peer. */
  const finish = useCallback(
    (reason: CallEndReason, opts?: { notify?: CallEndPayload["reason"]; message?: string }) => {
      const wasBusy = isBusy(callRef.current);
      if (opts?.notify && wasBusy) {
        send(RealtimeEvent.CALL_END, { duration: durationRef.current, reason: opts.notify });
      }
      clearTimers();
      mediaRef.current.releaseCall();
      pendingIce.current = [];
      if (wasBusy) {
        apply({ type: "END", reason, message: opts?.message });
        if (timers.current.ended) clearTimeout(timers.current.ended);
        timers.current.ended = setTimeout(() => apply({ type: "RESET" }), ENDED_BANNER_MS);
      }
      durationRef.current = 0;
      setCallDuration(0);
    },
    [apply, clearTimers, send]
  );

  const makeSession = useCallback((): PeerSession => {
    return mediaRef.current.startSession({
      onIceCandidate: (candidate) => {
        send(RealtimeEvent.WEBRTC_ICE_CANDIDATE, { candidate });
      },
      onRemoteStream: () => undefined,
      onConnectionState: (state) => {
        if (state === "connected") {
          if (timers.current.iceDown) clearTimeout(timers.current.iceDown);
          if (callRef.current.phase !== "CONNECTED") {
            apply({ type: "PEER_CONNECTED" });
            connectedAtRef.current = Date.now();
            timers.current.duration = setInterval(() => {
              const secs = connectedAtRef.current ? Math.floor((Date.now() - connectedAtRef.current) / 1000) : 0;
              durationRef.current = secs;
              setCallDuration(secs);
            }, 1000);
          }
        } else if (state === "disconnected") {
          if (timers.current.iceDown) clearTimeout(timers.current.iceDown);
          timers.current.iceDown = setTimeout(() => {
            const s = mediaRef.current.getSession()?.connectionState;
            if (s !== "connected") finish("connection_lost", { notify: "timeout" });
          }, ICE_DISCONNECT_GRACE_MS);
        } else if (state === "failed") {
          const wasConnected = callRef.current.phase === "CONNECTED";
          finish(wasConnected ? "connection_lost" : "negotiation_failed", { notify: "negotiation_failed" });
        }
      },
    });
  }, [apply, finish, send]);

  const flushPendingIce = useCallback(async (session: PeerSession) => {
    const queued = pendingIce.current;
    pendingIce.current = [];
    for (const c of queued) await session.addIceCandidate(c);
  }, []);

  // ── Local actions ─────────────────────────────────────────────────────────

  const startPreview = useCallback(() => mediaRef.current.prepareMedia(), []);

  const requestCall = useCallback(async () => {
    setError(null);
    if (!enabled || !optsRef.current.consultationId) return;
    if (isBusy(callRef.current)) return;
    if (!client.connected) {
      setError("You're reconnecting to the consultation room. Please try again in a moment.");
      return;
    }
    if (!(await mediaRef.current.prepareMedia())) {
      setError("We couldn't access a camera or microphone. Check your browser permissions and try again.");
      return;
    }
    if (timers.current.ended) clearTimeout(timers.current.ended);
    apply({ type: "LOCAL_REQUEST" });
    if (!send(RealtimeEvent.CALL_CREATE, {})) {
      finish("connection_lost", { message: "Couldn't reach the consultation room. Please try again." });
      return;
    }
    timers.current.ring = setTimeout(() => {
      if (callRef.current.phase === "CALL_REQUESTED") {
        send(RealtimeEvent.CALL_CANCEL, {});
        finish("missed");
      }
    }, RING_TIMEOUT_MS);
  }, [apply, client, enabled, finish, send]);

  const acceptCall = useCallback(async () => {
    setError(null);
    const cur = callRef.current;
    if (cur.phase !== "CALL_REQUESTED" || cur.direction !== "incoming") return;
    if (timers.current.ring) clearTimeout(timers.current.ring);
    apply({ type: "LOCAL_ACCEPT" });
    try {
      if (!(await mediaRef.current.prepareMedia())) throw new Error("media");
      const session = makeSession();
      await flushPendingIce(session);
      if (!send(RealtimeEvent.CALL_ACCEPT, {})) throw new Error("send");
    } catch {
      finish("negotiation_failed", { notify: "negotiation_failed" });
    }
  }, [apply, finish, flushPendingIce, makeSession, send]);

  const rejectCall = useCallback(() => {
    if (callRef.current.phase !== "CALL_REQUESTED" || callRef.current.direction !== "incoming") return;
    send(RealtimeEvent.CALL_REJECT, { reason: "The call was declined." });
    clearTimers();
    mediaRef.current.releaseCall();
    apply({ type: "RESET" });
  }, [apply, clearTimers, send]);

  const endCall = useCallback(
    (opts?: { concludeConsultation?: boolean }) => {
      const cur = callRef.current;
      if (cur.phase === "CALL_REQUESTED" && cur.direction === "outgoing") {
        send(RealtimeEvent.CALL_CANCEL, {});
        clearTimers();
        mediaRef.current.releaseCall();
        apply({ type: "RESET" });
        if (!opts?.concludeConsultation) return;
      } else if (cur.phase === "CALL_REQUESTED") {
        rejectCall();
        return;
      }
      const sent = send(RealtimeEvent.CALL_END, {
        duration: durationRef.current,
        concludeConsultation: opts?.concludeConsultation === true,
        reason: "hangup",
      });
      if (opts?.concludeConsultation && !sent) {
        // Realtime is down: the page falls back to the REST endpoint.
        setError("You're offline. Reconnect to conclude the consultation.");
      }
      clearTimers();
      mediaRef.current.releaseCall();
      if (isBusy(callRef.current)) {
        apply({ type: "END", reason: "hangup" });
        timers.current.ended = setTimeout(() => apply({ type: "RESET" }), ENDED_BANNER_MS);
      }
      durationRef.current = 0;
      setCallDuration(0);
    },
    [apply, clearTimers, rejectCall, send]
  );

  const syncServerCallState = useCallback(
    (s: ServerCallState) => {
      const o = optsRef.current;
      const fresh = s.callUpdatedAt ? Date.now() - new Date(s.callUpdatedAt).getTime() < INCOMING_RING_MS : false;
      if (s.callStatus === "calling" && s.callInitiatorId && s.callInitiatorId !== o.selfId && fresh && !isBusy(callRef.current)) {
        apply({ type: "REMOTE_REQUEST", peerName: o.peerName });
        timers.current.ring = setTimeout(() => {
          if (callRef.current.phase === "CALL_REQUESTED" && callRef.current.direction === "incoming") apply({ type: "RESET" });
        }, INCOMING_RING_MS);
      } else if (isBusy(callRef.current) && callRef.current.phase !== "CALL_REQUESTED" && (s.callStatus === "idle" || s.callStatus === "ended")) {
        finish("connection_lost", { message: END_MESSAGES.hangup });
      }
      if (s.completed) setConsultationCompleted(true);
    },
    [apply, finish]
  );

  // ── Realtime subscriptions ────────────────────────────────────────────────

  useEffect(() => {
    if (!consultationId || !enabled) return;
    const room = Rooms.consultation(consultationId);
    let cancelled = false;

    client.joinRoom(room).catch((e: Error) => {
      if (!cancelled) setError(e.message || "You don't have access to this consultation room.");
    });

    const isFromSelf = (userId?: string) => userId !== undefined && userId === optsRef.current.selfId;

    const offs = [
      client.on(RealtimeEvent.PRESENCE_UPDATE, (p) => {
        if (p.roomId !== room) return;
        const peerHere = p.users.some((u) => !isFromSelf(u.userId));
        setOnlineUsers(Math.max(1, p.users.length));
        setPeerOnline(peerHere);
        const phase = callRef.current.phase;
        if (peerHere) {
          peerWasOnline.current = true;
          if (timers.current.peerGone) clearTimeout(timers.current.peerGone);
        } else if (peerWasOnline.current && (phase === "CALL_ACCEPTED" || phase === "NEGOTIATING")) {
          if (timers.current.peerGone) clearTimeout(timers.current.peerGone);
          timers.current.peerGone = setTimeout(() => finish("peer_disconnected", { notify: "peer_disconnected" }), PEER_GONE_GRACE_MS);
        }
      }),

      client.on(RealtimeEvent.USER_JOINED, (p) => {
        // The callee arrived while we were ringing into an empty room: ring again.
        if (p.roomId === room && !isFromSelf(p.userId) && callRef.current.phase === "CALL_REQUESTED" && callRef.current.direction === "outgoing") {
          send(RealtimeEvent.CALL_CREATE, {});
        }
      }),

      client.on(RealtimeEvent.CALL_CREATE, (_p, packet) => {
        if (isBusy(callRef.current)) return;
        if (timers.current.ended) clearTimeout(timers.current.ended);
        apply({ type: "REMOTE_REQUEST", peerName: packet.from?.name || optsRef.current.peerName });
        if (timers.current.ring) clearTimeout(timers.current.ring);
        timers.current.ring = setTimeout(() => {
          if (callRef.current.phase === "CALL_REQUESTED" && callRef.current.direction === "incoming") apply({ type: "RESET" });
        }, INCOMING_RING_MS);
      }),

      client.on(RealtimeEvent.CALL_CANCEL, () => {
        if (callRef.current.phase === "CALL_REQUESTED" && callRef.current.direction === "incoming") finish("cancelled");
      }),

      client.on(RealtimeEvent.CALL_REJECT, (p) => {
        if (callRef.current.phase === "CALL_REQUESTED" && callRef.current.direction === "outgoing") {
          finish("rejected", { message: p.reason || END_MESSAGES.rejected });
        }
      }),

      client.on(RealtimeEvent.CALL_ACCEPT, async () => {
        if (callRef.current.phase !== "CALL_REQUESTED" || callRef.current.direction !== "outgoing") return;
        if (timers.current.ring) clearTimeout(timers.current.ring);
        apply({ type: "REMOTE_ACCEPT" });
        try {
          const session = makeSession();
          await flushPendingIce(session);
          const offer = await session.createOffer();
          apply({ type: "NEGOTIATION_STARTED" });
          if (!send(RealtimeEvent.WEBRTC_OFFER, { sdp: { type: "offer", sdp: offer.sdp } })) throw new Error("send");
        } catch {
          finish("negotiation_failed", { notify: "negotiation_failed" });
        }
      }),

      client.on(RealtimeEvent.WEBRTC_OFFER, async (p) => {
        if (callRef.current.direction !== "incoming" || (callRef.current.phase !== "CALL_ACCEPTED" && callRef.current.phase !== "NEGOTIATING")) return;
        try {
          const session = mediaRef.current.getSession() ?? makeSession();
          const answer = await session.acceptOffer(p.sdp);
          apply({ type: "NEGOTIATION_STARTED" });
          if (!send(RealtimeEvent.WEBRTC_ANSWER, { sdp: { type: "answer", sdp: answer.sdp } })) throw new Error("send");
        } catch {
          finish("negotiation_failed", { notify: "negotiation_failed" });
        }
      }),

      client.on(RealtimeEvent.WEBRTC_ANSWER, async (p) => {
        const session = mediaRef.current.getSession();
        if (!session) return;
        try {
          await session.acceptAnswer(p.sdp);
        } catch {
          finish("negotiation_failed", { notify: "negotiation_failed" });
        }
      }),

      client.on(RealtimeEvent.WEBRTC_ICE_CANDIDATE, async (p) => {
        const session = mediaRef.current.getSession();
        if (session) await session.addIceCandidate(p.candidate);
        else if (pendingIce.current.length < 100) pendingIce.current.push(p.candidate);
      }),

      client.on(RealtimeEvent.CALL_END, (p) => {
        if (p.consultationCompleted) {
          setConsultationCompleted(true);
          optsRef.current.onConsultationCompleted?.();
        }
        if (isBusy(callRef.current)) {
          finish(p.consultationCompleted ? "consultation_completed" : p.reason === "peer_disconnected" ? "peer_disconnected" : "hangup");
        }
      }),

      client.on(RealtimeEvent.PRESCRIPTION_RECEIVED, (p) => optsRef.current.onPrescription?.(p)),

      client.on(RealtimeEvent.ERROR, (p) => {
        if (p.roomId) return; // join errors are handled by joinRoom()
        const cur = callRef.current;
        if (p.code === "CALL_STATE" || p.code === "CALL_NOT_ALLOWED") {
          if (isBusy(cur)) finish("negotiation_failed", { message: p.message });
          else setError(p.message);
        } else if (p.code !== "RATE_LIMITED") {
          setError(p.message);
        }
      }),

      client.onReady(({ reconnected }) => {
        if (!reconnected) return;
        const load = optsRef.current.loadCallState;
        if (!load) return;
        void load().then((s) => {
          if (s) syncServerCallState(s);
        });
      }),
    ];

    const onPageHide = () => {
      if (isBusy(callRef.current) && callRef.current.phase !== "CALL_REQUESTED") {
        client.emit(RealtimeEvent.CALL_END, { consultationId, duration: durationRef.current, reason: "hangup" }, room);
      }
    };
    window.addEventListener("pagehide", onPageHide);

    return () => {
      cancelled = true;
      window.removeEventListener("pagehide", onPageHide);
      offs.forEach((off) => off());
      // Leaving the page ends any live call so the peer is never left on a stale one.
      const cur = callRef.current;
      if (isBusy(cur)) {
        if (cur.phase === "CALL_REQUESTED" && cur.direction === "outgoing") {
          client.emit(RealtimeEvent.CALL_CANCEL, { consultationId }, room);
        } else if (cur.phase !== "CALL_REQUESTED") {
          client.emit(RealtimeEvent.CALL_END, { consultationId, duration: durationRef.current, reason: "hangup" }, room);
        }
      }
      clearTimers();
      mediaRef.current.releaseCall();
      client.leaveRoom(room);
      peerWasOnline.current = false;
      setPeerOnline(false);
      callRef.current = initialCallState;
    };
  }, [client, consultationId, enabled, apply, clearTimers, finish, flushPendingIce, makeSession, send, syncServerCallState]);

  useEffect(
    () => () => {
      if (timers.current.ended) clearTimeout(timers.current.ended);
    },
    []
  );

  return {
    call,
    isIncomingRing: call.phase === "CALL_REQUESTED" && call.direction === "incoming",
    incomingCallerName: call.peerName,
    callDuration,
    connectionStatus: status,
    peerOnline,
    onlineUsers,
    error: error ?? media.mediaError,
    clearError: () => setError(null),
    consultationCompleted,
    startPreview,
    requestCall,
    acceptCall,
    rejectCall,
    endCall,
    syncServerCallState,
    localVideoRef: media.localVideoRef,
    remoteVideoRef: media.remoteVideoRef,
    hasLocalStream: media.hasLocalStream,
    hasRemoteStream: media.hasRemoteStream,
    isFallbackMedia: media.isFallbackMedia,
    mediaError: media.mediaError,
    isMuted: media.isMuted,
    isVideoDisabled: media.isVideoDisabled,
    toggleMute: media.toggleMute,
    toggleVideo: media.toggleVideo,
  };
}
