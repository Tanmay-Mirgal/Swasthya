/**
 * lib/webrtc/callController.ts
 *
 * The whole client-side life of ONE call, with no React and no socket dependency (both are
 * injected through `CallEnv`), so it is unit-testable with a fake signaling hub and fake peer.
 *
 * It owns: the state machine (callMachine), the server-issued callId, the peer connection,
 * pending-offer / early-ICE handling, every timer, the call timer, and exactly ONE cleanup
 * routine that is safe to call any number of times.
 *
 * Rules it enforces:
 *  - Signals for any other callId are ignored (a late event from an old call cannot touch this one).
 *  - Accepting is immediate and single-shot: the caller is told first, camera/mic and the peer
 *    connection are brought up while the offer waits; a second click does nothing.
 *  - The call timer starts only when the peer connection reports `connected`.
 *  - Ending (either side, any reason) tells the other participant FIRST, then cleans up:
 *    tracks stopped, peer closed, timers cleared, remote stream cleared, state reset.
 *  - Nothing here depends on which rooms a socket joined.
 */

import { RealtimeEvent, type RealtimeEventType } from "../realtime/protocol/events";
import type { CallEndReasonWire, RealtimePacket } from "../realtime/protocol/packets";
import { callLog } from "./callLog";
import {
  callReducer,
  END_MESSAGES,
  initialCallState,
  isBusy,
  type CallAction,
  type CallEndReason,
  type CallState,
} from "./callMachine";
import { DEFAULT_CALL_TIMEOUTS, type CallTimeouts } from "./config";
import type { PeerLike, PeerSessionHandlers } from "./peerSession";

export type MediaPrepareResult =
  | { ok: true; stream: MediaStream | null; /** e.g. "Camera blocked: joining with audio only." */ notice?: string }
  | { ok: false; message: string };

export interface CallEnv {
  /** Canonical consultation _id. */
  consultationId: string;
  /** Read live (may be getters): the signed-in user's id and the other participant's name. */
  readonly selfId?: string;
  readonly peerName?: string;
  /** Sends a client event; `consultationId` is added. Returns false when the socket is not up. */
  send(event: RealtimeEventType, payload: Record<string, unknown>): boolean;
  signalingUp(): boolean;
  prepareMedia(): Promise<MediaPrepareResult>;
  releaseMedia(): void;
  /** Creates the peer connection (fetching ICE servers first). */
  createPeer(handlers: PeerSessionHandlers): Promise<PeerLike>;
  onRemoteStream(stream: MediaStream | null): void;
  onChange(snapshot: CallSnapshot): void;
  onNotice?(message: string | null): void;
  onConsultationCompleted?(): void;
  timeouts?: Partial<CallTimeouts>;
}

export interface CallSnapshot {
  call: CallState;
  /** Seconds since media actually connected. */
  duration: number;
  pc: { connection: string; ice: string; signaling: string };
  pendingIce: number;
}

export interface ServerCallState {
  callStatus: string;
  callInitiatorId?: string;
  callId?: string;
  callUpdatedAt?: string | Date;
  completed: boolean;
}

type Payload = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

interface FinishOptions {
  /** Tell the other participant. true = sensible default for the phase. */
  notify?: boolean | CallEndReasonWire;
  message?: string;
  /** Go straight back to IDLE with no "call ended" banner (the user did this themselves). */
  quiet?: boolean;
}

export class CallController {
  private env: CallEnv;
  private T: CallTimeouts;
  private call: CallState = initialCallState;
  private duration = 0;
  private connectedAt: number | null = null;

  private peer: PeerLike | null = null;
  private peerPromise: Promise<PeerLike> | null = null;
  private localStream: MediaStream | null = null;
  private mediaGate: { promise: Promise<void>; resolve: () => void } | null = null;
  private earlyIce: RTCIceCandidateInit[] = [];
  private lastOfferSdp: string | null = null;
  private negotiation: Promise<void> = Promise.resolve();
  private pcStates = { connection: "new", ice: "new", signaling: "stable" };
  private pcConnected = false;
  private restartedOnce = false;
  private generation = 0;
  private disposed = false;
  /** We sent CALL_CREATE but ended before the server's ack arrived: cancel it when the ack lands. */
  private orphanCreate = false;
  private createSent = false;
  private unsentEnd: { event: RealtimeEventType; payload: Record<string, unknown> } | null = null;
  private recentlyEnded: string[] = [];
  private completedNotified = false;

  private timers: {
    ringOut?: ReturnType<typeof setTimeout>;
    ringIn?: ReturnType<typeof setTimeout>;
    connect?: ReturnType<typeof setTimeout>;
    iceDown?: ReturnType<typeof setTimeout>;
    peerGone?: ReturnType<typeof setTimeout>;
    tick?: ReturnType<typeof setInterval>;
    banner?: ReturnType<typeof setTimeout>;
  } = {};

  public constructor(env: CallEnv) {
    this.env = env;
    this.T = { ...DEFAULT_CALL_TIMEOUTS, ...env.timeouts };
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  public get state(): CallState {
    return this.call;
  }
  public get snapshot(): CallSnapshot {
    return { call: this.call, duration: this.duration, pc: { ...this.pcStates }, pendingIce: this.peer?.pendingIceCount ?? this.earlyIce.length };
  }
  // ── Local actions ─────────────────────────────────────────────────────────

  public async startCall(): Promise<void> {
    if (this.disposed || isBusy(this.call)) return;
    if (!this.env.signalingUp()) {
      this.env.onNotice?.("You're reconnecting to the consultation room. Please try again in a moment.");
      return;
    }
    this.env.onNotice?.(null);
    this.clearTimer("banner");
    this.orphanCreate = false;
    this.createSent = false;
    this.apply({ type: "LOCAL_REQUEST" }); // synchronous: a second click is ignored from here on
    const gen = this.generation;

    const media = await this.env.prepareMedia();
    if (this.generation !== gen || this.call.phase !== "OUTGOING_RINGING") {
      if (media.ok) this.env.releaseMedia();
      return;
    }
    if (!media.ok) {
      this.finish("media_unavailable", { message: media.message, quiet: false });
      return;
    }
    this.localStream = media.stream;
    if (media.notice) this.env.onNotice?.(media.notice);

    if (!this.env.send(RealtimeEvent.CALL_CREATE, {})) {
      this.finish("connection_failed", { message: "Couldn't reach the consultation room. Please try again." });
      return;
    }
    this.createSent = true;
    this.timers.ringOut = setTimeout(() => {
      if (this.call.phase === "OUTGOING_RINGING") this.finish("timeout", { notify: "timeout" });
    }, this.T.outgoingRingMs);
  }

  public async acceptIncoming(): Promise<void> {
    const cur = this.call;
    if (this.disposed || cur.phase !== "INCOMING_RINGING" || !cur.callId) return;
    this.clearTimer("ringIn");
    this.apply({ type: "LOCAL_ACCEPT" }); // synchronous: duplicate accepts do nothing
    const callId = cur.callId;
    const gen = this.generation;
    this.mediaGate = deferred();

    // Tell the caller NOW. A permission prompt can take a while and must not look like "no answer".
    if (!this.env.send(RealtimeEvent.CALL_ACCEPT, { callId })) {
      this.finish("connection_failed", { message: "Couldn't reach the consultation room. Please try again." });
      return;
    }
    this.startConnectTimer();

    try {
      const peerReady = this.ensurePeer();
      const media = await this.env.prepareMedia();
      if (this.generation !== gen) {
        if (media.ok) this.env.releaseMedia();
        return;
      }
      if (!media.ok) {
        this.finish("media_unavailable", { notify: "hangup", message: media.message });
        return;
      }
      this.localStream = media.stream;
      if (media.notice) this.env.onNotice?.(media.notice);
      const peer = await peerReady;
      if (this.generation !== gen) return;
      peer.setLocalStream(media.stream);
      this.mediaGate?.resolve(); // an offer that arrived early may now be answered
    } catch {
      if (this.generation === gen) this.finish("connection_failed", { notify: "connection_failed" });
    }
  }

  public rejectIncoming(): void {
    const cur = this.call;
    if (cur.phase !== "INCOMING_RINGING") return;
    this.finish("rejected", { notify: true, quiet: true });
  }

  /**
   * Hang up / cancel / decline as appropriate. A doctor concluding the consultation sends one
   * CALL_END(conclude) that also tells the patient, whatever phase the call is in.
   * Returns false if the signal could not be sent (the caller may fall back to REST).
   */
  public endCall(opts?: { concludeConsultation?: boolean }): boolean {
    const cur = this.call;
    if (opts?.concludeConsultation) {
      const sent = this.env.send(RealtimeEvent.CALL_END, {
        callId: cur.callId ?? undefined,
        duration: this.duration,
        concludeConsultation: true,
        reason: "hangup",
      });
      if (!sent) this.env.onNotice?.("You're offline. Reconnect to conclude the consultation.");
      if (isBusy(cur)) this.finish("ended_by_self", { notify: false, quiet: false });
      return sent;
    }
    switch (cur.phase) {
      case "OUTGOING_RINGING":
        this.finish("cancelled", { notify: "hangup", quiet: true });
        return true;
      case "INCOMING_RINGING":
        this.rejectIncoming();
        return true;
      case "ACCEPTING":
      case "CONNECTING":
      case "CONNECTED":
        this.finish("ended_by_self", { notify: "hangup", message: END_MESSAGES.ended_by_self });
        return true;
      default:
        return true;
    }
  }

  // ── Inbound signaling ─────────────────────────────────────────────────────

  public handle(event: string, payload: Payload, packet?: RealtimePacket): void {
    if (this.disposed || !payload || payload.consultationId !== this.env.consultationId) return;
    const mirrored = payload.mirrored === true;
    const cid: string | undefined = payload.callId;
    const mine = (id?: string) => Boolean(id) && this.call.callId === id;

    switch (event) {
      case RealtimeEvent.CALL_CREATED: {
        if (!cid) return;
        if (this.call.phase === "OUTGOING_RINGING" && !this.call.callId) {
          this.apply({ type: "CALL_ID", callId: cid });
          callLog(cid, "created");
        } else if (this.orphanCreate && !mine(cid)) {
          this.orphanCreate = false;
          this.env.send(RealtimeEvent.CALL_CANCEL, { callId: cid, reason: "cancelled" });
        }
        return;
      }

      case RealtimeEvent.CALL_CREATE: {
        if (!cid || mine(cid) || this.recentlyEnded.includes(cid)) return;
        if (this.call.phase === "INCOMING_RINGING") {
          this.cleanup(); // a newer call supersedes an unanswered one
          this.apply({ type: "RESET" });
        } else if (isBusy(this.call)) {
          return;
        }
        this.clearTimer("banner");
        this.env.onNotice?.(null);
        this.apply({ type: "REMOTE_REQUEST", callId: cid, peerName: packet?.from?.name || payload.callerName || this.env.peerName });
        this.startIncomingRing();
        return;
      }

      case RealtimeEvent.CALL_ACCEPT: {
        if (!mine(cid) && !(this.call.phase === "OUTGOING_RINGING" && !this.call.callId)) return;
        if (mirrored && this.call.phase === "INCOMING_RINGING") {
          this.finish("answered_elsewhere", { notify: false });
        } else if (this.call.phase === "OUTGOING_RINGING") {
          if (!this.call.callId && cid) this.apply({ type: "CALL_ID", callId: cid });
          void this.onRemoteAccepted();
        }
        return;
      }

      case RealtimeEvent.CALL_REJECT: {
        if (!mine(cid)) return;
        if (mirrored && this.call.phase === "INCOMING_RINGING") this.finish("answered_elsewhere", { notify: false, quiet: true });
        else if (this.call.phase === "OUTGOING_RINGING") this.finish("rejected", { notify: false, message: payload.reason || END_MESSAGES.rejected });
        return;
      }

      case RealtimeEvent.CALL_CANCEL: {
        if (!mine(cid)) return;
        if (this.call.phase === "INCOMING_RINGING") {
          const missed = payload.reason === "timeout";
          this.finish(missed ? "timeout" : "cancelled", { notify: false, message: missed ? "You missed this call." : undefined });
        }
        else if (mirrored && this.call.phase === "OUTGOING_RINGING") this.finish("cancelled", { notify: false, quiet: true });
        return;
      }

      case RealtimeEvent.WEBRTC_OFFER: {
        if (!mine(cid) || this.call.direction !== "incoming") return;
        const phase = this.call.phase;
        if (phase !== "ACCEPTING" && phase !== "CONNECTING" && phase !== "CONNECTED") return;
        this.queueNegotiation(() => this.processOffer(payload.sdp));
        return;
      }

      case RealtimeEvent.WEBRTC_ANSWER: {
        if (!mine(cid) || this.call.direction !== "outgoing") return;
        const phase = this.call.phase;
        if (phase !== "CONNECTING" && phase !== "CONNECTED") return;
        this.queueNegotiation(async () => {
          try {
            await this.peer?.acceptAnswer(payload.sdp);
          } catch {
            this.finish("connection_failed", { notify: "connection_failed" });
          }
        });
        return;
      }

      case RealtimeEvent.WEBRTC_ICE_CANDIDATE: {
        if (!mine(cid) || !isBusy(this.call)) return;
        if (this.peer) void this.peer.addIceCandidate(payload.candidate);
        else if (this.earlyIce.length < 100) this.earlyIce.push(payload.candidate);
        return;
      }

      case RealtimeEvent.CALL_END: {
        if (payload.consultationCompleted && !this.completedNotified) {
          this.completedNotified = true;
          this.env.onConsultationCompleted?.();
        }
        // An end with no callId (consultation concluded) applies to whatever call is live.
        if (!isBusy(this.call) || (cid && this.call.callId && cid !== this.call.callId)) return;
        callLog(this.call.callId, `END received (${payload.reason ?? "hangup"} by ${payload.endedBy ?? "?"})`);
        if (mirrored) return this.finish("ended_by_self", { notify: false, quiet: true });
        const reason: CallEndReason = payload.consultationCompleted
          ? "consultation_completed"
          : payload.reason === "connection_failed"
          ? "connection_failed"
          : payload.reason === "participant_disconnected"
          ? "participant_disconnected"
          : payload.reason === "timeout"
          ? "timeout"
          : payload.endedBy === "doctor"
          ? "ended_by_therapist"
          : payload.endedBy === "patient"
          ? "ended_by_patient"
          : "call_ended";
        this.finish(reason, { notify: false });
        return;
      }
    }
  }

  /** A server error that concerns the call (CALL_STATE / CALL_NOT_ALLOWED). */
  public handleServerError(code: string, message: string): void {
    if (code !== "CALL_STATE" && code !== "CALL_NOT_ALLOWED") return;
    const phase = this.call.phase;
    // Before media is flowing the server refused our request: show why and reset.
    if (phase === "OUTGOING_RINGING" || phase === "INCOMING_RINGING" || phase === "ACCEPTING") {
      this.finish("call_ended", { notify: false, message });
    } else if (!isBusy(this.call)) {
      this.env.onNotice?.(message);
    } else {
      callLog(this.call.callId, `server refused a signal during ${phase}: ${code}`);
    }
  }

  /** Reconcile with the stored call state (page load, or after a reconnect). */
  public syncServerCallState(s: ServerCallState): void {
    if (this.disposed) return;
    if (s.completed && !this.completedNotified) {
      this.completedNotified = true;
      this.env.onConsultationCompleted?.();
    }
    const age = s.callUpdatedAt ? Date.now() - new Date(s.callUpdatedAt).getTime() : Infinity;
    const ringing = s.callStatus === "calling" && age < this.T.incomingRingMs + 15_000;
    const theirs = Boolean(s.callInitiatorId) && s.callInitiatorId !== this.env.selfId;

    if (ringing && theirs && s.callId) {
      if (!isBusy(this.call) && !this.recentlyEnded.includes(s.callId)) {
        this.clearTimer("banner");
        this.apply({ type: "REMOTE_REQUEST", callId: s.callId, peerName: this.env.peerName });
        this.startIncomingRing();
      }
      return;
    }
    if (this.call.phase === "OUTGOING_RINGING" && !this.call.callId && s.callStatus === "calling" && !theirs && s.callId) {
      this.apply({ type: "CALL_ID", callId: s.callId }); // the ack was lost
      return;
    }
    const over = s.callStatus === "idle" || s.callStatus === "ended";
    const stale = !s.callId || s.callId !== this.call.callId;
    if (this.call.phase === "INCOMING_RINGING" && (over || stale || s.callStatus !== "calling")) {
      this.finish(s.callStatus === "accepted" || s.callStatus === "connected" ? "answered_elsewhere" : "cancelled", { notify: false });
    } else if ((this.call.phase === "ACCEPTING" || this.call.phase === "CONNECTING" || this.call.phase === "CONNECTED") && (over || stale)) {
      this.finish("call_ended", { notify: false });
    } else if (this.call.phase === "OUTGOING_RINGING" && this.call.callId && (over || stale)) {
      this.finish("call_ended", { notify: false });
    }
  }

  /** The room says whether the other participant is present. Used only to catch a vanished peer mid-negotiation. */
  public onPeerPresence(online: boolean, wasEverOnline: boolean): void {
    if (online) return this.clearTimer("peerGone");
    if (!wasEverOnline) return;
    const phase = this.call.phase;
    if ((phase === "ACCEPTING" || phase === "CONNECTING") && !this.timers.peerGone) {
      this.timers.peerGone = setTimeout(() => {
        this.timers.peerGone = undefined;
        if (this.call.phase === "ACCEPTING" || this.call.phase === "CONNECTING") this.finish("participant_disconnected", { notify: "participant_disconnected" });
      }, this.T.peerGoneGraceMs);
    }
  }

  /** The socket is (re)authenticated: deliver an end/cancel we could not send earlier. */
  public flushPending(): void {
    const u = this.unsentEnd;
    if (!u) return;
    if (this.env.send(u.event, u.payload)) this.unsentEnd = null;
  }

  /** The page is going away: tell the peer, best effort and synchronously. */
  public notifyLeaving(): void {
    if (isBusy(this.call)) this.sendLeaveSignal(this.call, true);
  }

  /** Unmount: tell the peer if a call is live, release everything, never touch state again. */
  public dispose(): void {
    if (this.disposed) return;
    if (isBusy(this.call)) this.sendLeaveSignal(this.call, true);
    this.cleanup();
    this.clearTimer("banner");
    this.disposed = true;
  }

  // ── Negotiation ───────────────────────────────────────────────────────────

  private queueNegotiation(task: () => Promise<void>): void {
    this.negotiation = this.negotiation.then(task).catch(() => undefined);
  }

  private async onRemoteAccepted(): Promise<void> {
    this.clearTimer("ringOut");
    this.apply({ type: "REMOTE_ACCEPT" });
    this.startConnectTimer();
    const gen = this.generation;
    try {
      const peer = await this.ensurePeer();
      if (this.generation !== gen) return;
      peer.setLocalStream(this.localStream);
      const offer = await peer.createOffer();
      if (this.generation !== gen) return;
      if (!this.env.send(RealtimeEvent.WEBRTC_OFFER, { callId: this.call.callId, sdp: { type: "offer", sdp: offer.sdp } })) {
        throw new Error("send");
      }
    } catch {
      if (this.generation === gen) this.finish("connection_failed", { notify: "connection_failed" });
    }
  }

  private async processOffer(sdp: RTCSessionDescriptionInit): Promise<void> {
    if (!sdp?.sdp || sdp.sdp === this.lastOfferSdp) return; // duplicate offer
    this.lastOfferSdp = sdp.sdp;
    const gen = this.generation;
    try {
      const peer = await this.ensurePeer();
      await this.mediaGate?.promise; // our tracks must be in the answer
      if (this.generation !== gen) return;
      const answer = await peer.acceptOffer(sdp);
      if (this.generation !== gen) return;
      this.apply({ type: "NEGOTIATION_STARTED" });
      if (!this.env.send(RealtimeEvent.WEBRTC_ANSWER, { callId: this.call.callId, sdp: { type: "answer", sdp: answer.sdp } })) {
        throw new Error("send");
      }
    } catch {
      if (this.generation === gen) this.finish("connection_failed", { notify: "connection_failed" });
    }
  }

  private ensurePeer(): Promise<PeerLike> {
    if (this.peer) return Promise.resolve(this.peer);
    if (this.peerPromise) return this.peerPromise;
    const gen = this.generation;
    const handlers: PeerSessionHandlers = {
      onIceCandidate: (candidate) => {
        if (this.generation === gen) this.env.send(RealtimeEvent.WEBRTC_ICE_CANDIDATE, { callId: this.call.callId, candidate });
      },
      onRemoteStream: (stream) => {
        if (this.generation === gen) this.env.onRemoteStream(stream);
      },
      onConnectionState: (state) => {
        if (this.generation !== gen) return;
        this.pcStates.connection = state;
        callLog(this.call.callId, `PEER: ${state}`);
        if (state === "connected") this.onPeerConnected();
        else if (state === "disconnected") this.onPeerDisconnected();
        else if (state === "failed") this.finish(this.call.phase === "CONNECTED" ? "connection_lost" : "connection_failed", { notify: "connection_failed" });
        this.emit();
      },
      onIceState: (state) => {
        if (this.generation !== gen) return;
        this.pcStates.ice = state;
        callLog(this.call.callId, `ICE: ${state}`);
        this.emit();
      },
      onSignalingState: (state) => {
        if (this.generation !== gen) return;
        this.pcStates.signaling = state;
        this.emit();
      },
    };
    const p = this.env.createPeer(handlers).then((peer) => {
      if (this.generation !== gen) {
        peer.close(); // the call ended while ICE servers were being fetched
        throw new Error("stale");
      }
      this.peer = peer;
      const early = this.earlyIce;
      this.earlyIce = [];
      for (const c of early) void peer.addIceCandidate(c);
      return peer;
    });
    this.peerPromise = p;
    p.catch(() => {
      if (this.peerPromise === p) this.peerPromise = null;
    });
    return p;
  }

  private onPeerConnected(): void {
    this.clearTimer("connect");
    this.clearTimer("iceDown");
    this.pcConnected = true;
    if (this.call.phase === "CONNECTED") return;
    if (!(this.call.phase === "CONNECTING" || this.call.phase === "ACCEPTING")) return;
    this.apply({ type: "PEER_CONNECTED" });
    this.connectedAt = Date.now();
    this.duration = 0;
    this.timers.tick = setInterval(() => {
      this.duration = this.connectedAt ? Math.floor((Date.now() - this.connectedAt) / 1000) : 0;
      this.emit();
    }, 1000);
    this.env.send(RealtimeEvent.CALL_CONNECTED, { callId: this.call.callId });
  }

  private onPeerDisconnected(): void {
    this.pcConnected = false;
    const phase = this.call.phase;
    if (phase !== "CONNECTING" && phase !== "CONNECTED") return;
    void this.tryIceRestart();
    if (this.timers.iceDown) return;
    this.timers.iceDown = setTimeout(() => {
      this.timers.iceDown = undefined;
      if (!this.pcConnected && isBusy(this.call)) this.finish("connection_lost", { notify: "connection_failed" });
    }, this.T.iceDisconnectGraceMs);
  }

  /** One attempt, by the original caller, to recover a dropped connection before giving up. */
  private async tryIceRestart(): Promise<void> {
    if (this.restartedOnce || this.call.direction !== "outgoing" || !this.peer) return;
    this.restartedOnce = true;
    const gen = this.generation;
    try {
      const offer = await this.peer.createOffer({ iceRestart: true });
      if (this.generation !== gen) return;
      this.env.send(RealtimeEvent.WEBRTC_OFFER, { callId: this.call.callId, sdp: { type: "offer", sdp: offer.sdp } });
      callLog(this.call.callId, "ICE restart offered");
    } catch {
      /* the grace timer will end the call if it does not recover */
    }
  }

  // ── Timers ────────────────────────────────────────────────────────────────

  private startConnectTimer(): void {
    this.clearTimer("connect");
    this.timers.connect = setTimeout(() => {
      this.timers.connect = undefined;
      if (this.call.phase === "ACCEPTING" || this.call.phase === "CONNECTING") this.finish("connection_failed", { notify: "connection_failed" });
    }, this.T.connectMs);
  }

  private startIncomingRing(): void {
    this.clearTimer("ringIn");
    this.timers.ringIn = setTimeout(() => {
      this.timers.ringIn = undefined;
      if (this.call.phase === "INCOMING_RINGING") this.finish("timeout", { notify: false, quiet: true });
    }, this.T.incomingRingMs);
  }

  private clearTimer(name: keyof CallController["timers"]): void {
    const t = this.timers[name];
    if (t === undefined) return;
    if (name === "tick") clearInterval(t as ReturnType<typeof setInterval>);
    else clearTimeout(t as ReturnType<typeof setTimeout>);
    this.timers[name] = undefined;
  }

  // ── Ending ────────────────────────────────────────────────────────────────

  /** Tell the peer how this call is over, in the way that fits the phase. */
  private sendLeaveSignal(cur: CallState, notify: true | CallEndReasonWire): void {
    const wire: CallEndReasonWire = notify === true ? "hangup" : notify;
    let event: RealtimeEventType;
    let payload: Record<string, unknown>;
    if (cur.phase === "OUTGOING_RINGING") {
      if (!cur.callId) {
        if (this.createSent) this.orphanCreate = true; // cancel it the moment the server's ack arrives
        return;
      }
      event = RealtimeEvent.CALL_CANCEL;
      payload = { callId: cur.callId, reason: wire === "timeout" ? "timeout" : "cancelled" };
    } else if (cur.phase === "INCOMING_RINGING") {
      event = RealtimeEvent.CALL_REJECT;
      payload = { callId: cur.callId, reason: "The call was declined." };
    } else {
      event = RealtimeEvent.CALL_END;
      payload = { callId: cur.callId ?? undefined, duration: this.duration, reason: wire };
    }
    if (!this.env.send(event, payload)) this.unsentEnd = { event, payload }; // delivered after reconnect
    else callLog(cur.callId, `${event} sent`);
  }

  private finish(reason: CallEndReason, opts: FinishOptions = {}): void {
    const cur = this.call;
    if (!isBusy(cur)) {
      this.cleanup();
      return;
    }
    if (opts.notify) this.sendLeaveSignal(cur, opts.notify);
    this.apply({ type: "END_BEGIN" });
    this.cleanup();
    if (cur.callId) {
      this.recentlyEnded.push(cur.callId);
      if (this.recentlyEnded.length > 10) this.recentlyEnded.shift();
    }
    this.apply({ type: "END", reason, message: opts.message });
    if (opts.quiet) {
      this.apply({ type: "RESET" });
    } else {
      this.timers.banner = setTimeout(() => {
        this.timers.banner = undefined;
        if (this.call.phase === "ENDED") this.apply({ type: "RESET" });
      }, this.T.endedBannerMs);
    }
  }

  /**
   * The ONE cleanup. Idempotent: stops every track, closes the peer, clears every timer, the
   * remote stream, the ICE/offer buffers and the call timer. Does not change the call state
   * (finish() does that) and leaves the "call ended" banner timer alone.
   */
  public cleanup(): void {
    const id = this.call.callId;
    this.generation++; // invalidates every in-flight async step of the old call
    (["ringOut", "ringIn", "connect", "iceDown", "peerGone", "tick"] as const).forEach((t) => this.clearTimer(t));
    this.peer?.close();
    this.peer = null;
    this.peerPromise = null;
    this.env.releaseMedia();
    this.env.onRemoteStream(null);
    this.localStream = null;
    this.mediaGate?.resolve();
    this.mediaGate = null;
    this.earlyIce = [];
    this.lastOfferSdp = null;
    this.negotiation = Promise.resolve();
    this.pcStates = { connection: "new", ice: "new", signaling: "stable" };
    this.pcConnected = false;
    this.restartedOnce = false;
    this.createSent = false;
    this.connectedAt = null;
    this.duration = 0;
    if (!this.disposed) callLog(id, "cleanup complete");
    this.emit();
  }

  // ── State plumbing ────────────────────────────────────────────────────────

  private apply(action: CallAction): void {
    const next = callReducer(this.call, action);
    if (next === this.call) return;
    this.call = next;
    callLog(next.callId, `STATE ${next.phase}${next.endReason ? ` (${next.endReason})` : ""}`);
    this.emit();
  }

  private emit(): void {
    if (!this.disposed) this.env.onChange(this.snapshot);
  }
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
