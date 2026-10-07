import test from "node:test";
import assert from "node:assert/strict";
import { MovementEngine } from "../judge/engine";
import { getMovementTemplate } from "../template/registry";
import { eventsOf, run } from "../testing/synth";
import { LEAD_MS, repPlanSession, type RepPlan } from "../testing/scenarios";
import { PoseLandmark as L } from "../landmarks";
import { JOINT_ERROR } from "../types";

const knee = () => getMovementTemplate("seated-knee-extension")!;
const P = 4000;
const go = (plan: RepPlan[], ms: number, trace = false) => {
  const e = new MovementEngine(knee(), { targetReps: 10 });
  return { e, r: run(e, repPlanSession(plan, P), ms, { trace }) };
};

test("a flagged rep followed by a good one: the fix is acknowledged exactly once, by the good rep, and not before", () => {
  const { r } = go([{ peak: 1, lean: true }, { peak: 1 }], LEAD_MS + 2 * P + 400);
  const kinds = r.events.filter((e) => e.type === "rep_not_counted" || e.type === "rep_completed" || (e.type === "movement_corrected" && e.error === "trunk_lean")).map((e) => e.type);
  assert.deepEqual(kinds, ["rep_not_counted", "movement_corrected", "rep_completed"], "the acknowledgement arrives with the proof, the good rep");
  const fixed = eventsOf(r.events, "movement_corrected").filter((e) => e.error === "trunk_lean");
  assert.equal(fixed.length, 1);
  assert.ok(fixed[0].joint.length > 0, "and it names the part of the body");
});

test("a repeat of the same fault is not acknowledged: the loop stays open until a rep avoids it", () => {
  const { r } = go([{ peak: 1, lean: true }, { peak: 1, lean: true }], LEAD_MS + 2 * P + 400);
  assert.equal(eventsOf(r.events, "rep_not_counted").length, 2);
  assert.equal(eventsOf(r.events, "movement_corrected").filter((e) => e.error === "trunk_lean").length, 0);
});

test("a short attempt followed by a full one acknowledges the range fix", () => {
  const { r } = go([{ peak: 0.55 }, { peak: 1 }], LEAD_MS + 2 * P + 400);
  const kinds = r.events.filter((e) => e.type === "partial_rep" || e.type === "rep_completed" || (e.type === "movement_corrected" && e.error === "insufficient_extension")).map((e) => e.type);
  assert.deepEqual(kinds, ["partial_rep", "movement_corrected", "rep_completed"]);
});

test("the part of the body that made a rep not count stays marked red for a few seconds, then clears", () => {
  const { r } = go([{ peak: 1, lean: true }, { peak: 1 }], LEAD_MS + 2 * P + 400, true);
  const notCountedAt = eventsOf(r.events, "rep_not_counted")[0].t;
  const near = (from: number, to: number) => r.trace.filter((f) => f.t >= notCountedAt + from && f.t <= notCountedAt + to);
  const during = near(200, 2800);
  assert.ok(during.length > 10);
  assert.ok(during.every((f) => f.joints[L.LEFT_SHOULDER] === JOINT_ERROR && f.joints[L.LEFT_HIP] === JOINT_ERROR), "shoulder and hip are still red after the rep ended");
  assert.ok(during.every((f) => f.joints[L.LEFT_KNEE] !== JOINT_ERROR), "and only the part that was at fault");
  const goodAt = eventsOf(r.events, "rep_completed")[0].t;
  assert.ok(r.trace.filter((f) => f.t >= goodAt + 100).every((f) => f.joints[L.LEFT_SHOULDER] !== JOINT_ERROR), "a good rep clears it");
});

test("a short attempt marks the limb that fell short, not the trunk", () => {
  const { r } = go([{ peak: 0.55 }], LEAD_MS + P + 400, true);
  const at = eventsOf(r.events, "partial_rep")[0].t;
  const during = r.trace.filter((f) => f.t >= at + 200 && f.t <= at + 1800);
  assert.ok(during.some((f) => f.joints[L.LEFT_KNEE] === JOINT_ERROR));
  assert.ok(during.every((f) => f.joints[L.LEFT_SHOULDER] !== JOINT_ERROR));
});
