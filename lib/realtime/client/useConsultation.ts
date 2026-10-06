/**
 * lib/realtime/client/useConsultation.ts
 *
 * Thin React wrapper around CallController for one consultation: it creates the controller,
 * feeds it signaling events, and exposes its state plus the media (video elements, mute,
 * camera). Chat/presence room membership lives here too, but is deliberately separate from
 * the call: calls are routed to each person's private channel and the controller outlives
 * the `enabled` flag, so leaving a room, a reconnect, or the join window changing can never
 * tear down or swallow a live call.
 *
 * Components render from the returned state and call requestCall/acceptCall/endCall; they
 * never touch sockets or RTCPeerConnection.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { RealtimeEvent } from "../protocol/events";
import { Rooms } from "../protocol/rooms";
import type { PrescriptionReceivedPayload } from "../protocol/packets";
import { CallController, type CallSnapshot, type ServerCallState } from "@/lib/webrtc/callController";
import { initialCallState, isConnecting, isIncomingRing, type CallState } from "@/lib/webrtc/callMachine";
import { fetchRtcConfig } from "@/lib/webrtc/config";
import { PeerSession } from "@/lib/webrtc/peerSession";
import { useWebRTC, type UseWebRTCResult } from "@/lib/webrtc/useWebRTC";
import type { ConnectionStatus } from "./realtimeClient";
import { useRealtime } from "./useRealtime";

export type { ServerCallState } from "@/lib/webrtc/callController";

export interface UseConsultationOptions {
  /** Canonical consultation _id. Null until the consultation has loaded. */
  consultationId: string | null;
  selfId: string | undefined;
  peerName?: string;
  /** False when the room is closed (outside the join window / completed): no new calls, no chat room. */
  enabled: boolean;
  /** Loads the server-side call state (used to reconcile after a reconnect). */
  loadCallState?: () => Promise<ServerCallState | null>;
  onConsultationCompleted?: () => void;
  onPrescription?: (payload: PrescriptionReceivedPayload) => void;
}

export interface UseConsultationResult
  extends Omit<UseWebRTCResult, "prepareMedia" | "setRemoteStream" | "release"> {
  call: CallState;
  isIncomingRing: boolean;
  /** Accepted, waiting for media to connect (ACCEPTING / CONNECTING). */
  isConnecting: boolean;
  incomingCallerName?: string;
  callDuration: number;
  connectionStatus: ConnectionStatus;
  peerOnline: boolean;
  onlineUsers: number;
  error: string | null;
  clearError: () => void;
  consultationCompleted: boolean;
  /** Dev-only debug panel data. */
  debug: CallSnapshot;
  /** Camera preview before/without a call. */
  startPreview: () => Promise<boolean>;
  requestCall: () => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  /** Hang up / cancel / decline as appropriate. Returns false if the signal could not be sent. */
  endCall: (opts?: { concludeConsultation?: boolean }) => boolean;
  /** Apply the server-side call state fetched with the consultation (e.g. a call already ringing). */
  syncServerCallState: (state: ServerCallState) => void;
}

const CALL_EVENTS = [
  RealtimeEvent.CALL_CREATED,
  RealtimeEvent.CALL_CREATE,
  RealtimeEvent.CALL_ACCEPT,
  RealtimeEvent.CALL_REJECT,
  RealtimeEvent.CALL_CANCEL,
  RealtimeEvent.CALL_END,
  RealtimeEvent.WEBRTC_OFFER,
  RealtimeEvent.WEBRTC_ANSWER,
  RealtimeEvent.WEBRTC_ICE_CANDIDATE,
] as const;

const EMPTY_SNAPSHOT: CallSnapshot = { call: initialCallState, duration: 0, pc: { connection: "new", ice: "new", signaling: "stable" }, pendingIce: 0 };

export function useConsultation(options: UseConsultationOptions): UseConsultationResult {
  const { consultationId, enabled } = options;
  const { client, status } = useRealtime();
  const { getToken } = useAuth();
  const media = useWebRTC();

  const [snap, setSnap] = useState<CallSnapshot>(EMPTY_SNAPSHOT);
  const [notice, setNotice] = useState<string | null>(null);
  const [peerOnline, setPeerOnline] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(1);
  const [consultationCompleted, setConsultationCompleted] = useState(false);

  // Latest values for callbacks that outlive a render.
  const optsRef = useRef(options);
  const mediaRef = useRef(media);
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    optsRef.current = options;
    mediaRef.current = media;
    getTokenRef.current = getToken;
  });

  const controllerRef = useRef<CallController | null>(null);
  /** Server state fetched before the controller exists; applied the moment it does. */
  const pendingSync = useRef<ServerCallState | null>(null);
  const peerWasOnline = useRef(false);

  // ── The call controller: one per consultation, independent of `enabled` ───────────────
  useEffect(() => {
    if (!consultationId) return;
    const ctrl = new CallController({
      consultationId,
      get selfId() {
        return optsRef.current.selfId;
      },
      get peerName() {
        return optsRef.current.peerName;
      },
      send: (event, payload) => client.emit(event, { consultationId, ...payload }),
      signalingUp: () => client.connected,
      prepareMedia: () => mediaRef.current.prepareMedia(),
      releaseMedia: () => mediaRef.current.release(),
      createPeer: async (handlers) => new PeerSession(handlers, await fetchRtcConfig(() => getTokenRef.current())),
      onRemoteStream: (stream) => mediaRef.current.setRemoteStream(stream),
      onChange: setSnap,
      onNotice: setNotice,
      onConsultationCompleted: () => {
        setConsultationCompleted(true);
        optsRef.current.onConsultationCompleted?.();
      },
    });
    controllerRef.current = ctrl;
    if (pendingSync.current) {
      ctrl.syncServerCallState(pendingSync.current);
      pendingSync.current = null;
    }

    const offs = [
      ...CALL_EVENTS.map((ev) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client.on(ev, ((payload: any, packet: any) => ctrl.handle(ev, payload, packet)) as never)
      ),
      client.on(RealtimeEvent.ERROR, (p) => {
        if (p.roomId) return; // join errors are handled by joinRoom()
        if (p.code === "CALL_STATE" || p.code === "CALL_NOT_ALLOWED") ctrl.handleServerError(p.code, p.message);
        else if (p.code !== "RATE_LIMITED") setNotice(p.message);
      }),
      client.onReady(({ reconnected }) => {
        ctrl.flushPending();
        if (!reconnected) return;
        const load = optsRef.current.loadCallState;
        if (load) void load().then((s) => s && ctrl.syncServerCallState(s));
      }),
    ];

    const onPageHide = () => ctrl.notifyLeaving();
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      offs.forEach((off) => off());
      ctrl.dispose(); // tells the peer if a call is live, then releases everything
      controllerRef.current = null;
    };
  }, [client, consultationId]);

  // ── Chat/presence room (only while the room is open) ──────────────────────────────────
  useEffect(() => {
    if (!consultationId || !enabled) return;
    const room = Rooms.consultation(consultationId);
    let cancelled = false;
    client.joinRoom(room).catch((e: Error) => {
      if (!cancelled) setNotice(e.message || "You don't have access to this consultation room.");
    });
    const isSelf = (userId?: string) => userId !== undefined && userId === optsRef.current.selfId;

    const offs = [
      client.on(RealtimeEvent.PRESENCE_UPDATE, (p) => {
        if (p.roomId !== room) return;
        const peerHere = p.users.some((u) => !isSelf(u.userId));
        setOnlineUsers(Math.max(1, p.users.length));
        setPeerOnline(peerHere);
        controllerRef.current?.onPeerPresence(peerHere, peerWasOnline.current);
        if (peerHere) peerWasOnline.current = true;
      }),
      client.on(RealtimeEvent.PRESCRIPTION_RECEIVED, (p) => optsRef.current.onPrescription?.(p)),
    ];

    return () => {
      cancelled = true;
      offs.forEach((off) => off());
      client.leaveRoom(room); // calls do not depend on this
      peerWasOnline.current = false;
      setPeerOnline(false);
    };
  }, [client, consultationId, enabled]);

  // ── Actions ───────────────────────────────────────────────────────────────────────────
  const startPreview = useCallback(async () => (await mediaRef.current.prepareMedia()).ok, []);
  const requestCall = useCallback(async () => {
    if (!optsRef.current.enabled) return;
    setNotice(null);
    await controllerRef.current?.startCall();
  }, []);
  const acceptCall = useCallback(async () => {
    setNotice(null);
    await controllerRef.current?.acceptIncoming();
  }, []);
  const rejectCall = useCallback(() => controllerRef.current?.rejectIncoming(), []);
  const endCall = useCallback((opts?: { concludeConsultation?: boolean }) => controllerRef.current?.endCall(opts) ?? false, []);
  const syncServerCallState = useCallback((s: ServerCallState) => {
    if (controllerRef.current) controllerRef.current.syncServerCallState(s);
    else pendingSync.current = s;
  }, []);

  const call = snap.call;
  return useMemo(
    () => ({
      call,
      isIncomingRing: isIncomingRing(call),
      isConnecting: isConnecting(call),
      incomingCallerName: call.peerName,
      callDuration: snap.duration,
      connectionStatus: status,
      peerOnline,
      onlineUsers,
      error: notice ?? media.mediaError,
      clearError: () => setNotice(null),
      consultationCompleted,
      debug: snap,
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
      isAudioOnly: media.isAudioOnly,
      mediaError: media.mediaError,
      isMuted: media.isMuted,
      isVideoDisabled: media.isVideoDisabled,
      toggleMute: media.toggleMute,
      toggleVideo: media.toggleVideo,
    }),
    [call, snap, status, peerOnline, onlineUsers, notice, consultationCompleted, media, startPreview, requestCall, acceptCall, rejectCall, endCall, syncServerCallState]
  );
}
