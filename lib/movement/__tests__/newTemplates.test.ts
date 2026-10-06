import test from "node:test";
import assert from "node:assert/strict";
import { MovementEngine } from "../judge/engine";
import { getMovementTemplate } from "../template/registry";
import { eventsOf, frontFrame, lerp, repCurve, run, sideFrame, type FrameBuilder } from "../testing/synth";
import { PoseLandmark as L } from "../landmarks";
import { JOINT_ERROR } from "../types";

const LEAD = 2000;
const mk = (id: string, reps = 10) => new MovementEngine(getMovementTemplate(id)!, { targetReps: reps });
const k = (t: number, period: number, peak = 1) => (t - LEAD < 0 ? 0 : repCurve(t - LEAD, period, peak));
const errorsOf = (events: ReturnType<typeof run>["events"]) => eventsOf(events, "movement_error").map((e) => e.error);

// ── Sit to stand (side view) ──────────────────────────────────────────────────

const sitStand =
  (opts: { period?: number; peak?: number; extraLean?: (t: number) => number } = {}): FrameBuilder =>
  (t) => {
    const p = k(t, opts.period ?? 6000, opts.peak ?? 1);
    return sideFrame(
      { thighTilt: 90 * (1 - p), knee: 95 + 83 * p, torsoTilt: 10 + 28 * Math.sin(Math.PI * p) + (opts.extraLean?.(t) ?? 0), groundFixed: true },
      { noisePx: 1.2, seed: Math.round(t) }
    );
  };

test("sit to stand: full stands are counted and valid, with the normal forward lean not flagged", () => {
  const r = run(mk("sit-to-stand"), sitStand(), LEAD + 3 * 6000 + 400);
  assert.equal(eventsOf(r.events, "rep_completed").length, 3);
  assert.ok(eventsOf(r.events, "rep_completed").every((e) => e.valid));
  assert.deepEqual(errorsOf(r.events), []);
});

test("sit to stand: a half stand is counted-but-invalid or partial, and coached to stand fully", () => {
  const r = run(mk("sit-to-stand"), sitStand({ peak: 0.82 }), LEAD + 2 * 6000 + 400);
  assert.ok(errorsOf(r.events).includes("incomplete_stand"));
  assert.ok(eventsOf(r.events, "rep_completed").every((e) => !e.valid));
});

test("sit to stand: leaning far forward is flagged on the trunk", () => {
  const r = run(mk("sit-to-stand"), sitStand({ extraLean: (t) => (t > LEAD + 800 ? 32 : 0) }), LEAD + 6000 + 400, { trace: true });
  assert.ok(errorsOf(r.events).includes("trunk_lean_forward"));
  assert.ok(r.trace.some((f) => f.joints[L.LEFT_SHOULDER] === JOINT_ERROR));
});

test("sit to stand: dropping into the chair is flagged as too fast", () => {
  const r = run(mk("sit-to-stand"), sitStand({ period: 2400 }), LEAD + 3 * 2400, { fps: 60 });
  assert.ok(errorsOf(r.events).includes("too_fast"));
});

// ── Shoulder abduction (front view) ───────────────────────────────────────────

const abduct =
  (o: { peakDeg?: number; shrug?: (t: number) => number; bend?: number; lean?: number } = {}): FrameBuilder =>
  (t) => {
    const a = 6 + ((o.peakDeg ?? 94) - 6) * k(t, 4500);
    return frontFrame({ armLeft: a, shrug: o.shrug?.(t) ?? 0, elbowBend: o.bend ?? 0, trunkTilt: o.lean ?? 0 }, { noisePx: 1.2, seed: Math.round(t), cy: 330 });
  };

test("shoulder abduction: clean raises are counted and valid", () => {
  const r = run(mk("shoulder-abduction"), abduct(), LEAD + 3 * 4500 + 400);
  assert.equal(eventsOf(r.events, "rep_completed").length, 3);
  assert.ok(eventsOf(r.events, "rep_completed").every((e) => e.valid));
  assert.deepEqual(errorsOf(r.events), []);
});

test("shoulder abduction: lifting above shoulder height, shrugging and a bent elbow are each caught", () => {
  assert.ok(errorsOf(run(mk("shoulder-abduction"), abduct({ peakDeg: 125 }), LEAD + 4500 + 400).events).includes("arm_too_high"));
  assert.ok(errorsOf(run(mk("shoulder-abduction"), abduct({ shrug: (t) => (t > LEAD + 800 ? 0.07 : 0) }), LEAD + 4500 + 400).events).includes("shoulder_shrug"));
  assert.ok(errorsOf(run(mk("shoulder-abduction"), abduct({ bend: 55 }), LEAD + 4500 + 400).events).includes("elbow_bent"));
});

test("shoulder abduction: a low lift is coached to go higher", () => {
  const r = run(mk("shoulder-abduction"), abduct({ peakDeg: 74 }), LEAD + 2 * 4500 + 400);
  assert.ok(errorsOf(r.events).includes("insufficient_raise"));
});

// ── Heel raise (side view; the front view cannot show knee bend) ──────────────

const heel =
  (o: { peak?: number; knee?: number } = {}): FrameBuilder =>
  (t) => {
    const lift = 0.09 * k(t, 5000, o.peak ?? 1);
    return sideFrame({ thighTilt: o.knee ? 20 : 0, knee: o.knee ?? 180, heelLift: lift, groundFixed: true }, { noisePx: 1, seed: Math.round(t) });
  };

test("heel raise: clean raises with a hold are counted and valid", () => {
  const r = run(mk("heel-raise"), heel(), LEAD + 3 * 5000 + 400);
  assert.equal(eventsOf(r.events, "rep_completed").length, 3);
  assert.ok(eventsOf(r.events, "rep_completed").every((e) => e.valid), JSON.stringify(eventsOf(r.events, "rep_completed")));
  assert.deepEqual(errorsOf(r.events), []);
});

test("heel raise: a small rise and bent knees are caught", () => {
  assert.ok(errorsOf(run(mk("heel-raise"), heel({ peak: 0.62 }), LEAD + 2 * 5000 + 400).events).includes("insufficient_rise"));
  assert.ok(errorsOf(run(mk("heel-raise"), heel({ knee: 140 }), LEAD + 5000 + 400).events).includes("knee_bent"));
});

// ── Mini squat (front view) ───────────────────────────────────────────────────

const squat =
  (o: { peak?: number; valgus?: (t: number) => number } = {}): FrameBuilder =>
  (t) =>
    frontFrame({ squat: 45 * k(t, 6000, o.peak ?? 1), valgusLeft: o.valgus?.(t) ?? 0 }, { noisePx: 1, seed: Math.round(t), cy: 300 });

test("mini squat: clean squats are counted and valid, with no knee flags", () => {
  const r = run(mk("mini-squat"), squat(), LEAD + 3 * 6000 + 400);
  assert.equal(eventsOf(r.events, "rep_completed").length, 3);
  assert.ok(eventsOf(r.events, "rep_completed").every((e) => e.valid), JSON.stringify(eventsOf(r.events, "rep_completed")));
  assert.deepEqual(errorsOf(r.events), []);
});

test("mini squat: the knee that drifts inward is the one that turns red, and the other stays green", () => {
  const r = run(mk("mini-squat"), squat({ valgus: (t) => (t > LEAD + 1500 ? 0.06 : 0) }), LEAD + 6000 + 400, { trace: true });
  const errs = eventsOf(r.events, "movement_error");
  assert.ok(errs.some((e) => e.error === "knee_inward_left" && e.joint === "left knee" && e.severity === "moderate"));
  assert.ok(!errs.some((e) => e.error === "knee_inward_right"));
  assert.ok(r.trace.some((f) => f.joints[L.LEFT_KNEE] === JOINT_ERROR));
  assert.ok(r.trace.every((f) => f.joints[L.RIGHT_KNEE] !== JOINT_ERROR));
});

test("mini squat: too shallow is coached; a quick squat is flagged too fast", () => {
  assert.ok(errorsOf(run(mk("mini-squat"), squat({ peak: 0.75 }), LEAD + 2 * 6000 + 400).events).includes("insufficient_depth"));
  const fast = (t: number) => frontFrame({ squat: 45 * k(t, 2300) }, { noisePx: 1, seed: Math.round(t), cy: 300 });
  assert.ok(errorsOf(run(mk("mini-squat"), fast, LEAD + 3 * 2300, { fps: 60 }).events).includes("too_fast"));
});

test("every new template is registered, prescribable and has a valid camera spec", () => {
  for (const id of ["sit-to-stand", "shoulder-abduction", "heel-raise", "mini-squat"]) {
    const t = getMovementTemplate(id)!;
    assert.ok(t, id);
    assert.ok(t.commonMistakes.length >= 3);
    assert.ok(lerp(0, 1, 0.5) === 0.5);
  }
});
