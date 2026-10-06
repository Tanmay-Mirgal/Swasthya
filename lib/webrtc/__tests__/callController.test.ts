import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { RealtimeEvent as E } from "../../realtime/protocol/events";
import { CID, FakeServer, connectedCall, disposeAll, settle, sleep } from "./harness";

afterEach(disposeAll);

// ── 1-3: start, ring, accept ─────────────────────────────────────────────────

test("1-2. the caller starts a call and the receiver gets an incoming call carrying the server's callId", async () => {
  const server = new FakeServer();
  const a = server.add("doctor", "Dr. A");
  const b = server.add("patient", "Pat B");
  await a.ctrl.startCall();
  await settle();
  assert.equal(a.ctrl.state.phase, "OUTGOING_RINGING");
  assert.equal(a.ctrl.state.callId, server.callId);
  assert.equal(b.ctrl.state.phase, "INCOMING_RINGING");
  assert.equal(b.ctrl.state.callId, server.callId);
  assert.equal(a.prepared, 1, "camera/mic are acquired before ringing");
});

test("3, 19. accepting is immediate and single-shot: a second click sends nothing and makes no second peer", async () => {
  const server = new FakeServer();
  const a = server.add("doctor", "Dr. A");
  const b = server.add("patient", "Pat B");
  await a.ctrl.startCall();
  await settle();
  const first = b.ctrl.acceptIncoming();
  const second = b.ctrl.acceptIncoming();
  await Promise.all([first, second]);
  await settle(12);
  assert.equal(server.count(b, E.CALL_ACCEPT), 1);
  assert.equal(b.peers.length, 1);
  assert.equal(a.peers.length, 1);
});

test("accept is sent BEFORE the camera prompt resolves, so a slow permission dialog is not 'no answer'", async () => {
  const server = new FakeServer();
  const a = server.add("doctor", "Dr. A");
  const b = server.add("patient", "Pat B");
  let release!: () => void;
  b.mediaResult = () => new Promise((r) => (release = () => r({ ok: true, stream: null })));
  await a.ctrl.startCall();
  await settle();
  const accepting = b.ctrl.acceptIncoming();
  await settle();
  assert.equal(server.count(b, E.CALL_ACCEPT), 1, "caller already told");
  assert.equal(a.ctrl.state.phase, "CONNECTING");
  release();
  await accepting;
});

// ── 4-9: negotiation, ICE, connection ───────────────────────────────────────

test("4-6. offer from the caller → answer from the receiver → caller applies the answer", async () => {
  const { a, b } = await connectedCall();
  assert.equal(a.peers[0].offers, 1);
  assert.equal(b.peers[0].answers, 1);
  assert.deepEqual(a.peers[0].acceptedAnswers, ["answer-1"]);
  assert.equal(a.peers[0].local !== null, true, "local tracks were added before the offer");
});

test("7. ICE flows both ways; candidates that arrive before the peer exists are held and applied", async () => {
  const server = new FakeServer();
  const a = server.add("doctor", "Dr. A");
  const b = server.add("patient", "Pat B");
  await a.ctrl.startCall();
  await settle();
  // An early candidate for a call whose peer is not created yet.
  b.ctrl.handle(E.WEBRTC_ICE_CANDIDATE, { consultationId: CID, callId: server.callId, candidate: { candidate: "early" } });
  await b.ctrl.acceptIncoming();
  await settle(12);
  assert.deepEqual(b.peers[0].ice.map((c) => c.candidate), ["early"]);
  a.peers[0].handlers.onIceCandidate({ candidate: "from-a" });
  b.peers[0].handlers.onIceCandidate({ candidate: "from-b" });
  await settle();
  assert.ok(b.peers[0].ice.some((c) => c.candidate === "from-a"));
  assert.ok(a.peers[0].ice.some((c) => c.candidate === "from-b"));
});

test("8. CONNECTED only when the peer connection connects; the timer starts then, and the server is told once", async () => {
  const server = new FakeServer();
  const a = server.add("doctor", "Dr. A");
  const b = server.add("patient", "Pat B");
  await a.ctrl.startCall();
  await settle();
  await b.ctrl.acceptIncoming();
  await settle(12);
  assert.equal(a.ctrl.state.phase, "CONNECTING", "an answer is not a connection");
  assert.equal(a.ctrl.snapshot.duration, 0);
  assert.equal(server.status, "accepted");
  a.peers[0].handlers.onConnectionState("connected");
  a.peers[0].handlers.onConnectionState("connected");
  b.peers[0].handlers.onConnectionState("connected");
  await settle();
  assert.equal(a.ctrl.state.phase, "CONNECTED");
  assert.equal(b.ctrl.state.phase, "CONNECTED");
  assert.equal(server.status, "connected");
  assert.equal(server.count(a, E.CALL_CONNECTED), 1, "duplicate connected reports are suppressed");
  await sleep(1150);
  assert.ok(a.ctrl.snapshot.duration >= 1, "timer runs after connect");
  a.ctrl.endCall();
  b.ctrl.cleanup();
});

test("9. the remote stream is handed to the UI, and cleared on cleanup", async () => {
  const { a, b } = await connectedCall();
  const stream = { id: "remote" } as unknown as MediaStream;
  b.peers[0].handlers.onRemoteStream(stream);
  assert.equal(b.remote.at(-1), stream);
  a.ctrl.endCall();
  await settle();
  assert.equal(b.remote.at(-1), null);
});

// ── 10-14: ending, both directions ──────────────────────────────────────────

test("10-12. the caller ends: the receiver is told immediately and cleans up fully; the timer stops", async () => {
  const { a, b } = await connectedCall();
  a.ctrl.endCall();
  await settle();
  assert.equal(a.ctrl.state.phase, "ENDED");
  assert.equal(b.ctrl.state.phase, "ENDED");
  assert.equal(b.ctrl.state.endReason, "ended_by_therapist");
  assert.equal(b.peers[0].closed, 1, "peer connection closed");
  assert.ok(b.released >= 1, "camera and microphone released");
  assert.equal(b.remote.at(-1), null, "remote stream cleared");
  assert.equal(b.ctrl.snapshot.duration, 0, "timer reset");
  assert.equal(a.peers[0].closed, 1);
});

test("13-14. the receiver ends: the caller is told and cleans up", async () => {
  const { a, b } = await connectedCall();
  b.ctrl.endCall();
  await settle();
  assert.equal(a.ctrl.state.phase, "ENDED");
  assert.equal(b.ctrl.state.phase, "ENDED");
  assert.equal(a.peers[0].closed, 1);
  assert.ok(a.released >= 1);
});

test("ENDED returns to IDLE after the banner, and a new call can start", async () => {
  const { server, a, b } = await connectedCall({ endedBannerMs: 60 });
  a.ctrl.endCall();
  await sleep(150);
  assert.equal(a.ctrl.state.phase, "IDLE");
  assert.equal(b.ctrl.state.phase, "IDLE");
  await b.ctrl.startCall();
  await settle();
  assert.equal(a.ctrl.state.phase, "INCOMING_RINGING");
  assert.notEqual(a.ctrl.state.callId, null);
  assert.equal(server.status, "calling");
});

// REGRESSION: ending and immediately leaving the page (unmount) used to drop the end signal.
test("ending then immediately disposing (page unmount) still notifies the peer, exactly once", async () => {
  const { server, a, b } = await connectedCall();
  a.ctrl.endCall({ concludeConsultation: true });
  a.ctrl.dispose(); // what leaving the page does, a few ms later
  await settle();
  assert.equal(b.ctrl.state.phase, "ENDED");
  assert.equal(b.ctrl.state.endReason, "consultation_completed");
  assert.equal(b.completed, 1);
  assert.equal(server.count(a, E.CALL_END), 1, "no duplicate end from the unmount");
});

test("disposing mid-call (tab closed / navigation) tells the peer", async () => {
  const { a, b } = await connectedCall();
  a.ctrl.dispose();
  await settle();
  assert.equal(b.ctrl.state.phase, "ENDED");
});

test("a doctor concluding with no live call still tells an idle patient", async () => {
  const server = new FakeServer();
  const a = server.add("doctor", "Dr. A");
  const b = server.add("patient", "Pat B");
  a.ctrl.endCall({ concludeConsultation: true });
  await settle();
  assert.equal(b.completed, 1);
  assert.equal(b.ctrl.state.phase, "IDLE");
});

// ── stale / duplicate protection ────────────────────────────────────────────

test("signals for another callId are ignored: a late end from an old call cannot kill the new one", async () => {
  const { b } = await connectedCall();
  b.ctrl.handle(E.CALL_END, { consultationId: CID, callId: "some-older-call", reason: "hangup", endedBy: "doctor" });
  b.ctrl.handle(E.WEBRTC_OFFER, { consultationId: CID, callId: "some-older-call", sdp: { type: "offer", sdp: "x" } });
  b.ctrl.handle(E.CALL_CANCEL, { consultationId: CID, callId: "some-older-call" });
  await settle();
  assert.equal(b.ctrl.state.phase, "CONNECTED");
  assert.equal(b.peers[0].closed, 0);
});

test("signals for another consultation are ignored", async () => {
  const { b } = await connectedCall();
  b.ctrl.handle(E.CALL_END, { consultationId: "other", callId: b.ctrl.state.callId, reason: "hangup" });
  assert.equal(b.ctrl.state.phase, "CONNECTED");
});

test("20. cleanup is idempotent: twice, and again after the call ended, breaks nothing", async () => {
  const { a } = await connectedCall();
  a.ctrl.endCall();
  await settle();
  assert.doesNotThrow(() => {
    a.ctrl.cleanup();
    a.ctrl.cleanup();
  });
  assert.equal(a.peers[0].closed, 1, "the peer is closed once");
  assert.equal(a.ctrl.state.phase, "ENDED");
});

test("a duplicate end from the peer does not re-end or re-notify", async () => {
  const { a, b } = await connectedCall();
  a.ctrl.endCall();
  await settle();
  const before = b.sent.length;
  b.ctrl.handle(E.CALL_END, { consultationId: CID, callId: a.ctrl.state.callId, reason: "hangup", endedBy: "doctor" });
  assert.equal(b.sent.length, before);
  assert.equal(b.ctrl.state.phase, "ENDED");
});

test("a duplicate offer is answered once", async () => {
  const { a, b } = await connectedCall();
  b.ctrl.handle(E.WEBRTC_OFFER, { consultationId: CID, callId: b.ctrl.state.callId, sdp: { type: "offer", sdp: "offer-1" } });
  await settle();
  assert.equal(b.peers[0].answers, 1);
  assert.equal(a.peers.length, 1);
});

// ── 15-18: timeout, reject, failure, socket ─────────────────────────────────

test("15. nobody answers: the caller times out, cancels, and the callee's ring stops", async () => {
  const server = new FakeServer();
  const a = server.add("doctor", "Dr. A", { outgoingRingMs: 80, incomingRingMs: 5_000 });
  const b = server.add("patient", "Pat B", { incomingRingMs: 5_000 });
  await a.ctrl.startCall();
  await settle();
  await sleep(160);
  assert.equal(a.ctrl.state.endReason, "timeout");
  assert.equal(server.count(a, E.CALL_CANCEL), 1);
  assert.equal(b.ctrl.state.phase, "ENDED", "the callee's ring is withdrawn");
  assert.equal(b.ctrl.state.endReason, "timeout");
  assert.equal(b.ctrl.state.message, "You missed this call.");
  assert.equal(a.released >= 1, true);
});

test("15b. an unanswered incoming ring stops showing on its own", async () => {
  const server = new FakeServer();
  const a = server.add("doctor", "Dr. A", { outgoingRingMs: 5_000 });
  const b = server.add("patient", "Pat B", { incomingRingMs: 60 });
  await a.ctrl.startCall();
  await settle();
  assert.equal(b.ctrl.state.phase, "INCOMING_RINGING");
  await sleep(140);
  assert.equal(b.ctrl.state.phase, "IDLE");
  a.ctrl.endCall();
});

test("16. rejection: the caller is told, both are clean, and the server call is closed", async () => {
  const server = new FakeServer();
  const a = server.add("doctor", "Dr. A");
  const b = server.add("patient", "Pat B");
  await a.ctrl.startCall();
  await settle();
  b.ctrl.rejectIncoming();
  await settle();
  assert.equal(b.ctrl.state.phase, "IDLE");
  assert.equal(a.ctrl.state.phase, "ENDED");
  assert.equal(a.ctrl.state.endReason, "rejected");
  assert.equal(server.status, "idle");
  assert.equal(b.peers.length, 0, "no peer connection was ever created for a declined call");
});

test("17. connection never establishes: both sides end with a failure and are told", async () => {
  const server = new FakeServer();
  const a = server.add("doctor", "Dr. A", { connectMs: 80 });
  const b = server.add("patient", "Pat B", { connectMs: 5_000 });
  await a.ctrl.startCall();
  await settle();
  await b.ctrl.acceptIncoming();
  await settle(12);
  await sleep(170);
  assert.equal(a.ctrl.state.endReason, "connection_failed");
  assert.equal(b.ctrl.state.endReason, "connection_failed");
  assert.equal(a.peers[0].closed, 1);
  assert.equal(b.peers[0].closed, 1);
});

test("17b. the browser reports the connection failed after connecting: ended and peer notified", async () => {
  const { a, b } = await connectedCall();
  a.peers[0].handlers.onConnectionState("failed");
  await settle();
  assert.equal(a.ctrl.state.endReason, "connection_lost");
  assert.equal(b.ctrl.state.phase, "ENDED");
  assert.equal(b.ctrl.state.endReason, "connection_failed");
});

test("17c. a dropped connection gets one ICE restart; if it recovers the call continues", async () => {
  const { a, b } = await connectedCall();
  a.peers[0].handlers.onConnectionState("disconnected");
  await settle();
  assert.equal(a.peers[0].restartOffers, 1);
  a.peers[0].handlers.onConnectionState("connected");
  await sleep(200);
  assert.equal(a.ctrl.state.phase, "CONNECTED");
  assert.equal(b.ctrl.state.phase, "CONNECTED");
});

test("17d. a dropped connection that never recovers ends the call on both sides", async () => {
  const { a, b } = await connectedCall();
  a.peers[0].handlers.onConnectionState("disconnected");
  await sleep(250);
  assert.equal(a.ctrl.state.endReason, "connection_lost");
  assert.equal(b.ctrl.state.phase, "ENDED");
});

test("18. the socket is down: starting says so; a hang-up made offline is delivered after reconnect", async () => {
  const server = new FakeServer();
  const a = server.add("doctor", "Dr. A");
  const b = server.add("patient", "Pat B");
  a.up = false;
  await a.ctrl.startCall();
  assert.equal(a.ctrl.state.phase, "IDLE");
  assert.ok(a.notices.some((n) => n && /reconnecting/i.test(n)));

  a.up = true;
  await a.ctrl.startCall();
  await settle();
  await b.ctrl.acceptIncoming();
  await settle(12);
  a.peers[0].handlers.onConnectionState("connected");
  b.peers[0].handlers.onConnectionState("connected");
  await settle();
  a.up = false;
  a.ctrl.endCall(); // cannot be sent
  await settle();
  assert.equal(b.ctrl.state.phase, "CONNECTED", "the peer has not heard yet");
  a.up = true;
  a.ctrl.flushPending(); // socket re-authenticated
  await settle();
  assert.equal(b.ctrl.state.phase, "ENDED");
});

// ── multi-device and permissions ────────────────────────────────────────────

test("answered on another device: the second tab's ring is dismissed, with no signal back", async () => {
  const server = new FakeServer();
  const a = server.add("doctor", "Dr. A");
  const tab1 = server.add("patient", "Pat B");
  const tab2 = server.add("patient", "Pat B");
  await a.ctrl.startCall();
  await settle();
  assert.equal(tab1.ctrl.state.phase, "INCOMING_RINGING");
  assert.equal(tab2.ctrl.state.phase, "INCOMING_RINGING");
  await tab1.ctrl.acceptIncoming();
  await settle(12);
  assert.equal(tab2.ctrl.state.phase, "ENDED");
  assert.equal(tab2.ctrl.state.endReason, "answered_elsewhere");
  assert.equal(tab2.sent.length, 0, "the other tab sends nothing back");
});

test("camera/mic refused: a clear message, the call never starts, nothing is left open", async () => {
  const server = new FakeServer();
  const a = server.add("doctor", "Dr. A");
  server.add("patient", "Pat B");
  a.mediaResult = async () => ({ ok: false, message: "Camera access is required for video consultation." });
  await a.ctrl.startCall();
  await settle();
  assert.equal(a.ctrl.state.phase, "ENDED");
  assert.equal(a.ctrl.state.endReason, "media_unavailable");
  assert.match(a.ctrl.state.message ?? "", /Camera access is required/);
  assert.equal(server.count(a, E.CALL_CREATE), 0, "no call was placed");
});

test("the callee refuses camera/mic after accepting: the caller is told, not left connecting", async () => {
  const server = new FakeServer();
  const a = server.add("doctor", "Dr. A");
  const b = server.add("patient", "Pat B");
  b.mediaResult = async () => ({ ok: false, message: "Microphone access is blocked." });
  await a.ctrl.startCall();
  await settle();
  await b.ctrl.acceptIncoming();
  await settle(12);
  assert.equal(b.ctrl.state.endReason, "media_unavailable");
  assert.equal(a.ctrl.state.phase, "ENDED");
});

test("cancelling before the server's ack arrives still cancels the call", async () => {
  const server = new FakeServer();
  const a = server.add("doctor", "Dr. A");
  const b = server.add("patient", "Pat B");
  const starting = a.ctrl.startCall();
  await settle(2);
  a.ctrl.endCall(); // hang up while the create is still in flight
  await starting;
  await settle(12);
  assert.ok(["IDLE", "ENDED"].includes(a.ctrl.state.phase));
  assert.ok(["IDLE", "ENDED"].includes(b.ctrl.state.phase));
  assert.notEqual(server.status, "accepted");
});

test("page load: a ringing call from the other person is picked up from the stored state; a stale one is not", async () => {
  const server = new FakeServer();
  const b = server.add("patient", "Pat B");
  b.ctrl.syncServerCallState({ callStatus: "calling", callInitiatorId: "doctor", callId: "c9", callUpdatedAt: new Date(Date.now() - 400_000), completed: false });
  assert.equal(b.ctrl.state.phase, "IDLE");
  b.ctrl.syncServerCallState({ callStatus: "calling", callInitiatorId: "doctor", callId: "c9", callUpdatedAt: new Date(), completed: false });
  assert.equal(b.ctrl.state.phase, "INCOMING_RINGING");
  assert.equal(b.ctrl.state.callId, "c9");
  // The server then says it is over: the ring is dismissed.
  b.ctrl.syncServerCallState({ callStatus: "idle", callInitiatorId: "doctor", callId: "c9", callUpdatedAt: new Date(), completed: false });
  assert.notEqual(b.ctrl.state.phase, "INCOMING_RINGING");
});

test("after a reconnect, a call the server says is over is cleaned up locally", async () => {
  const { b } = await connectedCall();
  b.ctrl.syncServerCallState({ callStatus: "ended", callInitiatorId: "doctor", callId: b.ctrl.state.callId ?? "", callUpdatedAt: new Date(), completed: false });
  assert.equal(b.ctrl.state.phase, "ENDED");
  assert.equal(b.peers[0].closed, 1);
});

test("the other participant vanishing mid-negotiation ends the call after a grace period; coming back cancels it", async () => {
  const server = new FakeServer();
  const a = server.add("doctor", "Dr. A", { peerGoneGraceMs: 80 });
  const b = server.add("patient", "Pat B");
  await a.ctrl.startCall();
  await settle();
  await b.ctrl.acceptIncoming();
  await settle(12);
  a.ctrl.onPeerPresence(false, true);
  a.ctrl.onPeerPresence(true, true);
  await sleep(150);
  assert.equal(a.ctrl.state.phase, "CONNECTING", "they came back in time");
  a.ctrl.onPeerPresence(false, true);
  await sleep(150);
  assert.equal(a.ctrl.state.endReason, "participant_disconnected");
});
