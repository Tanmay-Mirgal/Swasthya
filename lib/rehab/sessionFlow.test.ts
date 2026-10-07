import test from "node:test";
import assert from "node:assert/strict";
import { COUNTDOWN_FROM, flowReducer, initialFlow, isJudging, showsCamera, type FlowEvent, type FlowState } from "./sessionFlow";

const run = (events: FlowEvent[], from: FlowState = initialFlow()) => events.reduce(flowReducer, from);
const phases = (events: FlowEvent[]) => {
  const out: string[] = [];
  events.reduce((s, e) => {
    const n = flowReducer(s, e);
    out.push(n.phase);
    return n;
  }, initialFlow());
  return out;
};
const tick = (n: number): FlowEvent[] => Array.from({ length: n }, () => ({ type: "tick" }) as FlowEvent);

test("a normal set: intro, camera check, a 3-2-1 countdown, then active", () => {
  assert.deepEqual(phases([{ type: "loaded", complete: false }, { type: "start" }, { type: "ready" }, ...tick(COUNTDOWN_FROM)]), ["intro", "ready", "countdown", "countdown", "countdown", "active"]);
  const counted = run([{ type: "loaded", complete: false }, { type: "start" }, { type: "ready" }]);
  assert.equal(counted.count, COUNTDOWN_FROM);
});

test("the countdown shows 3, 2, 1 and only then starts judging", () => {
  let s = run([{ type: "loaded", complete: false }, { type: "start" }, { type: "ready" }]);
  const shown: number[] = [];
  while (s.phase === "countdown") {
    shown.push(s.count);
    assert.equal(isJudging(s), false, "nothing is judged while counting down");
    s = flowReducer(s, { type: "tick" });
  }
  assert.deepEqual(shown, [3, 2, 1]);
  assert.equal(isJudging(s), true);
});

test("a finished exercise opens straight on the summary", () => {
  assert.equal(run([{ type: "loaded", complete: true }]).phase, "done");
});

test("a set that is not the last goes to rest; the next set starts with a countdown, not immediately", () => {
  const active = run([{ type: "loaded", complete: false }, { type: "start" }, { type: "ready" }, ...tick(3)]);
  assert.equal(active.phase, "active");
  const rest = flowReducer(active, { type: "set_complete", exerciseComplete: false });
  assert.equal(rest.phase, "rest");
  assert.equal(flowReducer(rest, { type: "tick" }), rest, "rest never advances by itself");
  const next = flowReducer(rest, { type: "begin_set" });
  assert.deepEqual([next.phase, next.count], ["countdown", COUNTDOWN_FROM]);
});

test("the last set ends the exercise instead of resting", () => {
  const active = run([{ type: "loaded", complete: false }, { type: "start" }, { type: "ready" }, ...tick(3)]);
  assert.equal(flowReducer(active, { type: "set_complete", exerciseComplete: true }).phase, "done");
});

test("pausing never penalises: resume goes through the countdown again", () => {
  const active = run([{ type: "loaded", complete: false }, { type: "start" }, { type: "ready" }, ...tick(3)]);
  const paused = flowReducer(active, { type: "pause" });
  assert.equal(paused.phase, "paused");
  assert.equal(flowReducer(paused, { type: "tick" }), paused, "a pause does not advance");
  assert.equal(flowReducer(paused, { type: "begin_set" }).phase, "countdown");
});

test("pausing during the countdown cancels it", () => {
  const counting = run([{ type: "loaded", complete: false }, { type: "start" }, { type: "ready" }, { type: "tick" }]);
  const paused = flowReducer(counting, { type: "pause" });
  assert.deepEqual([paused.phase, paused.count], ["paused", 0]);
});

test("a pause that completes the exercise ends it rather than leaving the patient stuck", () => {
  const paused = run([{ type: "loaded", complete: false }, { type: "start" }, { type: "ready" }, ...tick(3), { type: "pause" }]);
  assert.equal(flowReducer(paused, { type: "set_complete", exerciseComplete: true }).phase, "done");
  assert.equal(flowReducer(paused, { type: "set_complete", exerciseComplete: false }).phase, "rest");
});

test("the camera is shown from the camera check until the exercise ends, and is judged only while active", () => {
  const ready = run([{ type: "loaded", complete: false }, { type: "start" }]);
  assert.equal(ready.phase, "ready");
  assert.deepEqual([showsCamera(ready), isJudging(ready)], [true, false]);
  const active = run([{ type: "ready" }, ...tick(3)], ready);
  assert.deepEqual([showsCamera(active), isJudging(active)], [true, true]);
  const rest = flowReducer(active, { type: "set_complete", exerciseComplete: false });
  assert.deepEqual([showsCamera(rest), isJudging(rest)], [true, false]);
  const done = flowReducer(active, { type: "set_complete", exerciseComplete: true });
  assert.deepEqual([showsCamera(done), isJudging(done)], [false, false]);
});

test("events that do not apply in the current phase change nothing", () => {
  const loading = initialFlow();
  for (const e of [{ type: "start" }, { type: "ready" }, { type: "begin_set" }, { type: "tick" }, { type: "pause" }, { type: "set_complete", exerciseComplete: true }] as FlowEvent[]) {
    assert.equal(flowReducer(loading, e), loading);
  }
  const done = run([{ type: "loaded", complete: true }]);
  for (const e of [{ type: "start" }, { type: "begin_set" }, { type: "tick" }, { type: "pause" }] as FlowEvent[]) assert.equal(flowReducer(done, e), done);
  assert.equal(flowReducer(done, { type: "finish" }), done);
});

test("stopping can end the exercise from anywhere", () => {
  for (const phase of ["intro", "ready", "countdown", "active", "paused", "rest"] as const) {
    assert.equal(flowReducer({ phase, count: 0 }, { type: "finish" }).phase, "done");
  }
});

test("a plan that cannot be loaded is unavailable, and only from loading", () => {
  assert.equal(run([{ type: "unavailable" }]).phase, "unavailable");
  const intro = run([{ type: "loaded", complete: false }]);
  assert.equal(flowReducer(intro, { type: "unavailable" }), intro);
});
