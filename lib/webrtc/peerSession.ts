/**
 * lib/webrtc/peerSession.ts
 *
 * One RTCPeerConnection for a single call. Framework-free; it only produces and consumes
 * SDP and ICE, which the signaling layer relays. Media flows peer-to-peer.
 *
 * - Local media may be attached after construction (`setLocalStream`), but before the offer
 *   or answer is created, so tracks are always in the SDP.
 * - ICE candidates that arrive before the remote description are queued here (the only queue)
 *   and applied right after `setRemoteDescription`.
 * - Connection, ICE and signaling state changes are all reported.
 * - `close()` is idempotent and releases the connection, handlers and queue.
 */

import { STUN_ONLY_CONFIG } from "./config";

export type LocalStream = MediaStream & { isFallback?: boolean };

export interface PeerSessionHandlers {
  onIceCandidate: (candidate: RTCIceCandidateInit) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionState: (state: RTCPeerConnectionState) => void;
  onIceState?: (state: RTCIceConnectionState) => void;
  onSignalingState?: (state: RTCSignalingState) => void;
}

/** What the call controller needs from a peer connection (a fake implements this in tests). */
export interface PeerLike {
  setLocalStream(stream: MediaStream | null): void;
  createOffer(opts?: { iceRestart?: boolean }): Promise<RTCSessionDescriptionInit>;
  acceptOffer(sdp: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit>;
  acceptAnswer(sdp: RTCSessionDescriptionInit): Promise<void>;
  addIceCandidate(candidate: RTCIceCandidateInit): Promise<void>;
  readonly pendingIceCount: number;
  close(): void;
}

export class PeerSession implements PeerLike {
  private pc: RTCPeerConnection | null = null;
  private handlers: PeerSessionHandlers | null;
  private iceQueue: RTCIceCandidateInit[] = [];
  private closed = false;
  private attached = new Set<string>();

  public constructor(handlers: PeerSessionHandlers, rtcConfig: RTCConfiguration = STUN_ONLY_CONFIG) {
    this.handlers = handlers;
    const pc = new RTCPeerConnection(rtcConfig);
    this.pc = pc;

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) this.handlers?.onRemoteStream(stream);
    };
    pc.onicecandidate = (event) => {
      if (event.candidate) this.handlers?.onIceCandidate(event.candidate.toJSON());
    };
    pc.onconnectionstatechange = () => {
      if (this.pc) this.handlers?.onConnectionState(this.pc.connectionState);
    };
    pc.oniceconnectionstatechange = () => {
      if (this.pc) this.handlers?.onIceState?.(this.pc.iceConnectionState);
    };
    pc.onsignalingstatechange = () => {
      if (this.pc) this.handlers?.onSignalingState?.(this.pc.signalingState);
    };
  }

  private requirePc(): RTCPeerConnection {
    if (!this.pc || this.closed) throw new Error("Peer connection is closed");
    return this.pc;
  }

  /** Adds the local tracks once each. Call before creating the offer or answer. */
  public setLocalStream(stream: MediaStream | null): void {
    const pc = this.pc;
    if (!pc || this.closed || !stream) return;
    for (const track of stream.getTracks()) {
      if (this.attached.has(track.id)) continue;
      this.attached.add(track.id);
      pc.addTrack(track, stream);
    }
  }

  public async createOffer(opts?: { iceRestart?: boolean }): Promise<RTCSessionDescriptionInit> {
    const pc = this.requirePc();
    const offer = await pc.createOffer(opts?.iceRestart ? { iceRestart: true } : undefined);
    await pc.setLocalDescription(offer);
    return { type: "offer", sdp: offer.sdp };
  }

  public async acceptOffer(sdp: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    const pc = this.requirePc();
    await pc.setRemoteDescription(sdp);
    await this.flushIceQueue();
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    return { type: "answer", sdp: answer.sdp };
  }

  public async acceptAnswer(sdp: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.requirePc();
    if (pc.signalingState !== "have-local-offer") return; // duplicate or late answer
    await pc.setRemoteDescription(sdp);
    await this.flushIceQueue();
  }

  /** Candidates may arrive before the remote description; they wait here until it is set. */
  public async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    const pc = this.pc;
    if (!pc || this.closed) return;
    if (!pc.remoteDescription) {
      if (this.iceQueue.length < 200) this.iceQueue.push(candidate);
      return;
    }
    try {
      await pc.addIceCandidate(candidate);
    } catch {
      /* stale candidate from an earlier negotiation: safe to ignore */
    }
  }

  private async flushIceQueue(): Promise<void> {
    const pc = this.pc;
    if (!pc) return;
    const queued = this.iceQueue;
    this.iceQueue = [];
    for (const c of queued) {
      try {
        await pc.addIceCandidate(c);
      } catch {
        /* ignore */
      }
    }
  }

  public get pendingIceCount(): number {
    return this.iceQueue.length;
  }

  public get states(): { connection: string; ice: string; signaling: string } {
    const pc = this.pc;
    return { connection: pc?.connectionState ?? "closed", ice: pc?.iceConnectionState ?? "closed", signaling: pc?.signalingState ?? "closed" };
  }

  public close(): void {
    if (this.closed) return;
    this.closed = true;
    const pc = this.pc;
    this.pc = null;
    this.handlers = null;
    this.iceQueue = [];
    this.attached.clear();
    if (pc) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;
      pc.onsignalingstatechange = null;
      try {
        pc.getReceivers().forEach((r) => r.track?.stop());
      } catch {
        /* ignore */
      }
      pc.close();
    }
  }
}
