/**
 * lib/webrtc/peerSession.ts
 *
 * One RTCPeerConnection + its local media for a single call. Framework-free so the
 * hooks stay thin. Media flows peer-to-peer; this class only produces/consumes SDP and
 * ICE which the signaling layer relays.
 *
 * `close()` releases everything: tracks, connection, handlers and the ICE queue.
 */

import { DEFAULT_RTC_CONFIG } from "./config";

export type LocalStream = MediaStream & { isFallback?: boolean };

export interface PeerSessionHandlers {
  onIceCandidate: (candidate: RTCIceCandidateInit) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionState: (state: RTCPeerConnectionState) => void;
}

export class PeerSession {
  private pc: RTCPeerConnection | null = null;
  private handlers: PeerSessionHandlers | null;
  private iceQueue: RTCIceCandidateInit[] = [];
  private closed = false;

  public constructor(handlers: PeerSessionHandlers, localStream: MediaStream | null) {
    this.handlers = handlers;
    const pc = new RTCPeerConnection(DEFAULT_RTC_CONFIG);
    this.pc = pc;

    localStream?.getTracks().forEach((track) => pc.addTrack(track, localStream));

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
  }

  private requirePc(): RTCPeerConnection {
    if (!this.pc || this.closed) throw new Error("Peer connection is closed");
    return this.pc;
  }

  public async createOffer(): Promise<RTCSessionDescriptionInit> {
    const pc = this.requirePc();
    const offer = await pc.createOffer();
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
    if (pc.signalingState !== "have-local-offer") return; // duplicate/late answer
    await pc.setRemoteDescription(sdp);
    await this.flushIceQueue();
  }

  /** Candidates may arrive before the remote description; queue them until it is set. */
  public async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    const pc = this.pc;
    if (!pc || this.closed) return;
    if (!pc.remoteDescription) {
      this.iceQueue.push(candidate);
      return;
    }
    try {
      await pc.addIceCandidate(candidate);
    } catch {
      /* stale candidate for a previous negotiation — safe to ignore */
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

  public get connectionState(): RTCPeerConnectionState | "closed" {
    return this.pc?.connectionState ?? "closed";
  }

  public close(): void {
    if (this.closed) return;
    this.closed = true;
    const pc = this.pc;
    this.pc = null;
    this.handlers = null;
    this.iceQueue = [];
    if (pc) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.getSenders().forEach((s) => {
        try {
          s.track?.stop();
        } catch {
          /* ignore */
        }
      });
      pc.close();
    }
  }
}
