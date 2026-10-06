/**
 * Test harness: a fake signaling server that follows the real server's rules (it issues the
 * callId, acks the creator, routes each event to the peer, mirrors accept/reject/cancel/end to
 * the sender's other connections) plus a fake peer connection and fake media. Two or more
 * CallControllers are wired through it, with an asynchronous hop so ordering is realistic.
 */
import { CallController, type CallEnv } from "../callController";
import type { PeerLike, PeerSessionHandlers } from "../peerSession";
import { RealtimeEvent, type RealtimeEventType } from "../../realtime/protocol/events";

export const CID = "consult-1";
const all: CallController[] = [];
/** Call after every test: a live controller owns a 1s timer that would keep the process alive. */
export const disposeAll = () => {
  while (all.length) all.pop()!.dispose();
};
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Lets queued microtasks and the hub's async hop run. */
export const settle = async (n = 6) => {
  for (let i = 0; i < n; i++) await sleep(0);
};

export class FakePeer implements PeerLike {
  closed = 0;
  local: unknown = null;
  offers = 0;
  answers = 0;
  acceptedAnswers: string[] = [];
  ice: RTCIceCandidateInit[] = [];
  restartOffers = 0;
  pendingIceCount = 0;
  constructor(public handlers: PeerSessionHandlers) {}
  setLocalStream(s: MediaStream | null) {
    this.local = s;
  }
  async createOffer(opts?: { iceRestart?: boolean }) {
    if (opts?.iceRestart) this.restartOffers++;
    return { type: "offer" as const, sdp: `offer-${++this.offers}` };
  }
  async acceptOffer() {
    return { type: "answer" as const, sdp: `answer-${++this.answers}` };
  }
  async acceptAnswer(sdp: RTCSessionDescriptionInit) {
    this.acceptedAnswers.push(sdp.sdp ?? "");
  }
  async addIceCandidate(c: RTCIceCandidateInit) {
    this.ice.push(c);
  }
  close() {
    this.closed++;
  }
}

export interface Client {
  id: string;
  name: string;
  ctrl: CallController;
  peers: FakePeer[];
  sent: { event: string; payload: Record<string, unknown> }[];
  remote: (MediaStream | null)[];
  released: number;
  prepared: number;
  completed: number;
  notices: (string | null)[];
  up: boolean;
  mediaResult: () => Promise<
    { ok: true; stream: MediaStream | null; notice?: string } | { ok: false; message: string }
  >;
}

/** Everything the server would store/decide about the current call. */
export class FakeServer {
  clients: Client[] = [];
  callId: string | null = null;
  initiator: string | null = null;
  status: "idle" | "calling" | "accepted" | "connected" | "ended" = "idle";
  connectedReports = 0;
  private n = 0;

  /** Users and their connections: userId -> clients (tabs). */
  peerOf(c: Client) {
    return this.clients.filter((x) => x.id !== c.id);
  }
  deliver(to: Client[], event: RealtimeEventType, payload: Record<string, unknown>, from?: Client) {
    for (const t of to) {
      queueMicrotask(() =>
        setTimeout(() => t.ctrl.handle(event, { consultationId: CID, ...payload }, from ? { event, payload, from: { userId: from.id, role: "doctor", name: from.name } } : undefined), 0)
      );
    }
  }
  /** Server-side handling of a client's event, mirroring realtimeServer/callService. */
  receive(from: Client, event: RealtimeEventType, p: Record<string, unknown>) {
    const peers = this.peerOf(from).filter((x) => x.id !== from.id);
    const sameUserOtherTabs = this.clients.filter((x) => x.id === from.id && x !== from);
    switch (event) {
      case RealtimeEvent.CALL_CREATE:
        this.callId = `call-${++this.n}`;
        this.initiator = from.id;
        this.status = "calling";
        this.deliver([from], RealtimeEvent.CALL_CREATED, { callId: this.callId });
        this.deliver(peers, RealtimeEvent.CALL_CREATE, { callId: this.callId }, from);
        return;
      case RealtimeEvent.CALL_ACCEPT:
        if (p.callId !== this.callId || this.status !== "calling") return this.err(from, "This call is no longer ringing.");
        this.status = "accepted";
        this.deliver(peers, RealtimeEvent.CALL_ACCEPT, { callId: this.callId }, from);
        this.deliver(sameUserOtherTabs, RealtimeEvent.CALL_ACCEPT, { callId: this.callId, mirrored: true }, from);
        return;
      case RealtimeEvent.CALL_REJECT:
        if (p.callId !== this.callId) return;
        this.status = "idle";
        this.deliver(peers, RealtimeEvent.CALL_REJECT, { callId: this.callId, reason: "The call was declined." }, from);
        this.deliver(sameUserOtherTabs, RealtimeEvent.CALL_REJECT, { callId: this.callId, mirrored: true }, from);
        return;
      case RealtimeEvent.CALL_CANCEL:
        if (p.callId !== this.callId) return;
        this.status = "idle";
        this.deliver(peers, RealtimeEvent.CALL_CANCEL, { callId: this.callId, reason: p.reason }, from);
        return;
      case RealtimeEvent.CALL_CONNECTED:
        if (p.callId === this.callId && this.status === "accepted") {
          this.status = "connected";
          this.connectedReports++;
        }
        return;
      case RealtimeEvent.CALL_END: {
        const stale = p.callId !== undefined && p.callId !== this.callId;
        const live = this.status === "calling" || this.status === "accepted" || this.status === "connected";
        const concluded = p.concludeConsultation === true;
        if ((!live || stale) && !concluded) return; // idempotent / stale end: says nothing
        if (live && !stale) this.status = "ended";
        this.deliver(peers, RealtimeEvent.CALL_END, { callId: this.callId, reason: p.reason, endedBy: "doctor", consultationCompleted: concluded }, from);
        this.deliver(sameUserOtherTabs, RealtimeEvent.CALL_END, { callId: this.callId, mirrored: true }, from);
        return;
      }
      case RealtimeEvent.WEBRTC_OFFER:
      case RealtimeEvent.WEBRTC_ANSWER:
      case RealtimeEvent.WEBRTC_ICE_CANDIDATE:
        if (p.callId !== this.callId || (this.status !== "accepted" && this.status !== "connected")) return;
        this.deliver(peers, event, p, from);
        return;
    }
  }
  err(c: Client, message: string) {
    queueMicrotask(() => c.ctrl.handleServerError("CALL_STATE", message));
  }

  add(id: string, name: string, opts: Partial<CallEnv["timeouts"]> = {}): Client {
    const c: Client = {
      id,
      name,
      peers: [],
      sent: [],
      remote: [],
      released: 0,
      prepared: 0,
      completed: 0,
      notices: [],
      up: true,
      mediaResult: async () => ({ ok: true, stream: { id: `local-${id}`, getTracks: () => [] } as unknown as MediaStream }),
      ctrl: undefined as unknown as CallController,
    };
    const env: CallEnv = {
      consultationId: CID,
      selfId: id,
      peerName: "Peer",
      send: (event, payload) => {
        if (!c.up) return false;
        c.sent.push({ event, payload });
        this.receive(c, event, payload);
        return true;
      },
      signalingUp: () => c.up,
      prepareMedia: async () => {
        c.prepared++;
        return c.mediaResult();
      },
      releaseMedia: () => void c.released++,
      createPeer: async (handlers) => {
        const p = new FakePeer(handlers);
        c.peers.push(p);
        return p;
      },
      onRemoteStream: (s) => void c.remote.push(s),
      onChange: () => undefined,
      onNotice: (m) => void c.notices.push(m),
      onConsultationCompleted: () => void c.completed++,
      timeouts: { outgoingRingMs: 300, incomingRingMs: 300, connectMs: 300, iceDisconnectGraceMs: 120, peerGoneGraceMs: 120, endedBannerMs: 5_000, ...opts },
    };
    c.ctrl = new CallController(env);
    all.push(c.ctrl);
    this.clients.push(c);
    return c;
  }
  count(c: Client, event: string) {
    return c.sent.filter((s) => s.event === event).length;
  }
}

/** Two people, a call started by `a`, accepted by `b`, and media connected on both ends. */
export async function connectedCall(opts: Partial<CallEnv["timeouts"]> = {}) {
  const server = new FakeServer();
  const a = server.add("doctor", "Dr. A", opts);
  const b = server.add("patient", "Pat B", opts);
  await a.ctrl.startCall();
  await settle();
  await b.ctrl.acceptIncoming();
  await settle(12);
  a.peers[0].handlers.onConnectionState("connected");
  b.peers[0].handlers.onConnectionState("connected");
  await settle();
  return { server, a, b };
}
