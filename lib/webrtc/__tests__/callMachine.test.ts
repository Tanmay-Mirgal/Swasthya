import test from "node:test";
import assert from "node:assert/strict";
import { callReducer, initialCallState, isBusy, type CallState } from "../callMachine";

const run = (actions: Parameters<typeof callReducer>[1][], from: CallState = initialCallState) => actions.reduce(callReducer, from);

test("outgoing path: IDLE → OUTGOING_RINGING → CONNECTING → CONNECTED", () => {
  let s = run([{ type: "LOCAL_REQUEST" }]);
  assert.equal(s.phase, "OUTGOING_RINGING");
  s = run([{ type: "CALL_ID", callId: "c1" }, { type: "REMOTE_ACCEPT" }], s);
  assert.equal(s.phase, "CONNECTING");
  assert.equal(run([{ type: "PEER_CONNECTED" }], s).phase, "CONNECTED");
});

test("incoming path: INCOMING_RINGING → ACCEPTING → CONNECTING → CONNECTED", () => {
  let s = run([{ type: "REMOTE_REQUEST", callId: "c1", peerName: "Dr. A" }]);
  assert.equal(s.phase, "INCOMING_RINGING");
  assert.equal(s.callId, "c1");
  s = run([{ type: "LOCAL_ACCEPT" }], s);
  assert.equal(s.phase, "ACCEPTING");
  s = run([{ type: "NEGOTIATION_STARTED" }], s);
  assert.equal(s.phase, "CONNECTING");
  assert.equal(run([{ type: "PEER_CONNECTED" }], s).phase, "CONNECTED");
});

test("a second accept or a second request while busy changes nothing", () => {
  const ringing = run([{ type: "REMOTE_REQUEST", callId: "c1" }]);
  const accepting = run([{ type: "LOCAL_ACCEPT" }], ringing);
  assert.equal(run([{ type: "LOCAL_ACCEPT" }], accepting), accepting);
  assert.equal(run([{ type: "REMOTE_REQUEST", callId: "c2" }], accepting), accepting);
  assert.equal(run([{ type: "LOCAL_REQUEST" }], accepting), accepting);
});

test("ending goes ENDING → ENDED with a reason, END is idempotent, RESET returns to IDLE", () => {
  const connected = run([{ type: "REMOTE_REQUEST", callId: "c1" }, { type: "LOCAL_ACCEPT" }, { type: "PEER_CONNECTED" }]);
  const ending = run([{ type: "END_BEGIN" }], connected);
  assert.equal(ending.phase, "ENDING");
  const ended = run([{ type: "END", reason: "ended_by_therapist" }], ending);
  assert.equal(ended.phase, "ENDED");
  assert.equal(ended.endReason, "ended_by_therapist");
  assert.ok(ended.message);
  assert.equal(run([{ type: "END", reason: "timeout" }], ended), ended);
  assert.equal(run([{ type: "END", reason: "timeout" }], initialCallState), initialCallState);
  assert.equal(run([{ type: "RESET" }], ended).phase, "IDLE");
});

test("a new call can start from ENDED; callId is not overwritten once known", () => {
  const ended = run([{ type: "LOCAL_REQUEST" }, { type: "END", reason: "timeout" }]);
  assert.equal(run([{ type: "LOCAL_REQUEST" }], ended).phase, "OUTGOING_RINGING");
  const out = run([{ type: "LOCAL_REQUEST" }, { type: "CALL_ID", callId: "a" }, { type: "CALL_ID", callId: "b" }]);
  assert.equal(out.callId, "a");
});

test("only the right side can move the call forward", () => {
  const out = run([{ type: "LOCAL_REQUEST" }]);
  assert.equal(run([{ type: "LOCAL_ACCEPT" }], out), out); // the caller cannot accept their own call
  const inc = run([{ type: "REMOTE_REQUEST", callId: "c" }]);
  assert.equal(run([{ type: "REMOTE_ACCEPT" }], inc), inc);
  assert.equal(run([{ type: "PEER_CONNECTED" }], inc), inc); // cannot be connected before accepting
  assert.equal(isBusy(inc), true);
  assert.equal(isBusy(initialCallState), false);
});
