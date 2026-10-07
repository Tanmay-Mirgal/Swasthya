import test from "node:test";
import assert from "node:assert/strict";
import { MovementEngine } from "../judge/engine";
import { getMovementTemplate } from "../template/registry";
import { eventsOf, frontFrame, lerp, repCurve, run, sideFrame, type FrameOpts } from "../testing/synth";
import { angle2D } from "../geometry/geometry";
import { PoseLandmark as L } from "../landmarks";
import { kneeExtensionSession, LEAD_MS } from "../testing/scenarios";
import { JOINT_ERROR, JOINT_OK, JOINT_UNCERTAIN } from "../types";

const knee = () => getMovementTemplate("seated-knee-extension")!;
const curl = () => getMovementTemplate("seated-bicep-curl")!;
const neck = () => getMovementTemplate("neck-rotation")!;

const LEAD = LEAD_MS;
const kneeSession = kneeExtensionSession;

test("synth is geometrically honest: the angle the engine measures equals the angle drawn", () => {
  for (const k of [90, 110, 135, 160, 175]) {
    const f = sideFrame({ knee: k });
    const got = angle2D(f.image[L.LEFT_HIP], f.image[L.LEFT_KNEE], f.image[L.LEFT_ANKLE], f.aspect);
    assert.ok(Math.abs(got - k) < 0.5, `knee ${k} measured ${got}`);
  }
  for (const e of [60, 90, 140, 175]) {
    const f = sideFrame({ elbow: e });
    const got = angle2D(f.image[L.LEFT_SHOULDER], f.image[L.LEFT_ELBOW], f.image[L.LEFT_WRIST], f.aspect);
    assert.ok(Math.abs(got - e) < 0.5, `elbow ${e} measured ${got}`);
  }
});

test("clean repetitions are counted, valid, and the range is reported", () => {
  const eng = new MovementEngine(knee(), { targetReps: 10 });
  const r = run(eng, kneeSession(), LEAD + 5 * 4000 + 500);
  const reps = eventsOf(r.events, "rep_completed");
  assert.equal(reps.length, 5);
  assert.ok(reps.every((e) => e.valid), "all reps valid");
  const s = eng.getSummary();
  assert.equal(s.counted, 5);
  assert.equal(s.valid, 5);
  assert.equal(s.invalid, 0);
  assert.ok(s.rom >= 70 && s.rom <= 82, `rom ${s.rom}`);
  assert.equal(eventsOf(r.events, "movement_error").length, 0, "no false errors on a clean session");
  assert.equal(eventsOf(r.events, "setup_ready").length, 1);
});

test("nothing is counted until the starting position has been held", () => {
  const eng = new MovementEngine(knee(), { targetReps: 10 });
  // Starts already extended and moving: never in the rest zone for 900ms.
  const r = run(eng, (t) => sideFrame({ knee: 140 + 25 * Math.sin(t / 300) }, { noisePx: 1 }), 4000);
  assert.equal(r.last.counted, 0);
  assert.equal(r.last.phase, "setup");
});

test("reps stop counting at the target and the engine reports done", () => {
  const eng = new MovementEngine(knee(), { targetReps: 3 });
  const r = run(eng, kneeSession(), LEAD + 6 * 4000);
  assert.equal(r.last.counted, 3);
  assert.equal(r.last.done, true);
  assert.equal(eventsOf(r.events, "rep_completed").length, 3);
});

test("a shallow rep is NOT counted: a partial attempt with a range error raised once", () => {
  const eng = new MovementEngine(knee(), { targetReps: 10 });
  // Peak 0.62 is about 139 degrees: past the old halfway-credit line (130) but short of the full range (150).
  const r = run(eng, kneeSession({ peak: 0.62 }), LEAD + 2 * 4000 + 500);
  assert.equal(eventsOf(r.events, "rep_completed").length, 0, "nothing is credited");
  const partials = eventsOf(r.events, "partial_rep");
  assert.equal(partials.length, 2);
  assert.ok(partials.every((e) => e.almost === true), "close enough to say 'almost'");
  const s0 = eng.getSummary();
  assert.deepEqual([s0.counted, s0.valid, s0.partial], [0, 0, 2]);
  const errs = eventsOf(r.events, "movement_error").filter((e) => e.error === "insufficient_extension");
  assert.equal(errs.length, 2, "one raise per shallow rep, not one per frame");
  assert.ok(errs.every((e) => e.oneShot && e.direction === "low"));
  assert.equal(eng.getSummary().errors["INSUFFICIENT_EXTENSION"].count, 2);
});

test("a partial attempt is recorded, not counted, and coached", () => {
  const eng = new MovementEngine(knee(), { targetReps: 10 });
  const r = run(eng, kneeSession({ peak: 0.48 }), LEAD + 2 * 4000 + 500);
  assert.equal(eventsOf(r.events, "rep_completed").length, 0);
  assert.equal(eventsOf(r.events, "partial_rep").length, 2);
  assert.equal(eng.getSummary().partial, 2);
  assert.equal(eng.getSummary().counted, 0);
});

test("a rep that is too fast is counted and flagged, not invalidated", () => {
  const eng = new MovementEngine(knee(), { targetReps: 10 });
  const r = run(eng, kneeSession({ period: 1700 }), LEAD + 3 * 1700 + 300, { fps: 60 });
  const fast = eventsOf(r.events, "movement_error").filter((e) => e.error === "too_fast");
  assert.ok(fast.length >= 1);
  const reps = eventsOf(r.events, "rep_completed");
  assert.ok(reps.length >= 1 && reps.every((e) => e.valid));
});

test("repeated partial/early reversals do not double count (debounce)", () => {
  const eng = new MovementEngine(knee(), { targetReps: 20 });
  const r = run(eng, kneeSession({ period: 1700 }), LEAD + 6 * 1700, { fps: 60 });
  const n = eventsOf(r.events, "rep_completed").length;
  assert.ok(n <= 6, `${n} reps counted in 6 cycles`);
});

test("sustained trunk lean turns shoulder and hip red, then green again after correction", () => {
  const eng = new MovementEngine(knee(), { targetReps: 10 });
  // Lean 28 degrees from 1.9s to 3.4s of the first rep; upright otherwise.
  const lean = (t: number) => (t > LEAD + 600 && t < LEAD + 2400 ? 28 : 0);
  // Two repetitions: the second is upright, so the flagged region clears and the fix is acknowledged.
  const r = run(eng, kneeSession({ lean }), LEAD + 2 * 4000 + 500, { trace: true });
  const errs = eventsOf(r.events, "movement_error").filter((e) => e.error === "trunk_lean");
  assert.equal(errs.length, 1);
  assert.equal(errs[0].severity, "major");
  assert.equal(errs[0].direction, "high");
  assert.ok(errs[0].confidence > 0.9);
  assert.equal(eventsOf(r.events, "movement_corrected").filter((e) => e.error === "trunk_lean").length, 1);
  const red = r.trace.filter((f) => f.joints[L.LEFT_SHOULDER] === JOINT_ERROR && f.joints[L.LEFT_HIP] === JOINT_ERROR);
  assert.ok(red.length > 10, "shoulder and hip were red for a sustained period");
  assert.ok(r.trace.every((f) => f.joints[L.LEFT_KNEE] !== JOINT_ERROR), "knee is not blamed for a trunk problem");
  assert.equal(r.trace[r.trace.length - 1].joints[L.LEFT_SHOULDER], JOINT_OK);
  // The leaning rep reached the full range but broke a mandatory rule: it is NOT counted, and it does not credit the set.
  const notCounted = eventsOf(r.events, "rep_not_counted")[0];
  assert.ok(notCounted.reasons.includes("trunk_lean"));
  assert.equal(notCounted.rep, 0, "the number of good reps did not move");
  // The second, upright repetition is good, and is the proof that the lean was fixed.
  assert.equal(eventsOf(r.events, "rep_completed").length, 1);
  const s1 = eng.getSummary();
  assert.deepEqual([s1.counted, s1.valid, s1.invalid], [1, 1, 1]);
});

test("a single noisy frame does not raise an error (sustain gate)", () => {
  const eng = new MovementEngine(knee(), { targetReps: 10 });
  const r = run(eng, kneeSession({ lean: (t) => (Math.abs(t - (LEAD + 1700)) < 20 ? 40 : 0) }), LEAD + 4500);
  assert.equal(eventsOf(r.events, "movement_error").length, 0);
});

test("a value hovering at the threshold does not flap (hysteresis)", () => {
  const eng = new MovementEngine(knee(), { targetReps: 10 });
  // 17..19 degrees oscillating around the 18 degree limit for most of a rep.
  const lean = (t: number) => (t > LEAD + 400 ? 18 + 1 * Math.sin(t / 90) : 0);
  const r = run(eng, kneeSession({ lean }), LEAD + 4500);
  const raised = eventsOf(r.events, "movement_error").filter((e) => e.error === "trunk_lean").length;
  const cleared = eventsOf(r.events, "movement_corrected").filter((e) => e.error === "trunk_lean").length;
  assert.ok(raised <= 1 && cleared <= 1, `raised ${raised}, cleared ${cleared}`);
});

test("low confidence freezes judgment: no rep, no error, no red; joints go yellow", () => {
  const eng = new MovementEngine(knee(), { targetReps: 10 });
  // Knee hidden through the whole first repetition, while the trunk also leans.
  const hide = (t: number) => (t > LEAD - 100 && t < LEAD + 4200 ? { [L.LEFT_KNEE]: 0.15 } : undefined);
  const r = run(eng, kneeSession({ vis: hide, lean: () => 30 }), LEAD + 4000, { trace: true });
  assert.equal(eventsOf(r.events, "rep_completed").length, 0);
  assert.equal(eventsOf(r.events, "movement_error").length, 0, "no error is declared while the knee cannot be seen");
  const mid = r.trace.filter((f) => f.t > LEAD + 1000);
  assert.ok(mid.every((f) => f.confidence === "LOW"));
  assert.ok(mid.every((f) => f.joints[L.LEFT_KNEE] === JOINT_UNCERTAIN), "knee is yellow");
  assert.ok(mid.every((f) => !f.joints.includes(JOINT_ERROR)), "no red while confidence is low");
  const cam = eventsOf(r.events, "camera_issue");
  assert.ok(cam.some((e) => e.advice.code === "low_visibility" && /knee/.test(e.advice.message)));
});

test("a long tracking loss mid-rep abandons the rep without counting it", () => {
  const eng = new MovementEngine(knee(), { targetReps: 10 });
  const gone = (t: number) => t > LEAD + 1200 && t < LEAD + 4600;
  const r = run(eng, (t) => (gone(t) ? { image: null, aspect: 1.78 } : kneeSession()(t)), LEAD + 5500);
  assert.equal(eventsOf(r.events, "rep_completed").length, 0);
  assert.equal(r.last.phase, "setup");
  assert.ok(eventsOf(r.events, "camera_issue").some((e) => e.advice.code === "no_person"));
});

test("a short tracking blip mid-rep does not lose the rep", () => {
  const eng = new MovementEngine(knee(), { targetReps: 10 });
  const blip = (t: number) => t > LEAD + 1500 && t < LEAD + 1900;
  const r = run(eng, (t) => (blip(t) ? { image: null, aspect: 1.78 } : kneeSession()(t)), LEAD + 4500);
  assert.equal(eventsOf(r.events, "rep_completed").length, 1);
});

test("the same exercise counts the same on other frame sizes, distances and aspect ratios", () => {
  const configs: FrameOpts[] = [
    { W: 1280, H: 720, pxPerM: 380 },
    { W: 640, H: 480, pxPerM: 280, cy: 190 },
    { W: 720, H: 1280, pxPerM: 380, cx: 200, cy: 520 },
    { W: 1920, H: 1080, pxPerM: 300, cy: 400 },
  ];
  for (const frame of configs) {
    const eng = new MovementEngine(knee(), { targetReps: 10 });
    const r = run(eng, kneeSession({ frame }), LEAD + 4 * 4000 + 400);
    assert.equal(eventsOf(r.events, "rep_completed").length, 4, JSON.stringify(frame));
    assert.equal(eventsOf(r.events, "movement_error").length, 0, JSON.stringify(frame));
  }
});

test("works from either side of the body, and picks the better-seen side", () => {
  for (const near of ["left", "right"] as const) {
    const eng = new MovementEngine(knee(), { targetReps: 10 });
    const r = run(eng, kneeSession({ near }), LEAD + 3 * 4000 + 400);
    assert.equal(eventsOf(r.events, "rep_completed").length, 3, near);
    assert.equal(r.last.side, near);
  }
});

test("reset starts a fresh chunk but keeps tracking", () => {
  const eng = new MovementEngine(knee(), { targetReps: 4 });
  run(eng, kneeSession(), LEAD + 4 * 4000 + 100);
  assert.equal(eng.getSummary().counted, 4);
  eng.reset(3);
  assert.equal(eng.getSummary().counted, 0);
  const r = run(eng, kneeSession(), LEAD + 3 * 4000 + 100, { startMs: 100_000 });
  assert.equal(r.last.counted, 3);
  assert.equal(r.last.targetReps, 3);
});

test("seated bicep curl: clean reps count; elbow drift and a shallow curl are caught", () => {
  const curlSession = (peak: number, drift: (t: number) => number) => (t: number) => {
    const tt = t - LEAD;
    const k = tt < 0 ? 0 : repCurve(tt, 4000, peak);
    return sideFrame({ elbow: lerp(172, 55, k), upperArm: drift(t) }, { noisePx: 1.2, seed: Math.round(t) });
  };
  const clean = run(new MovementEngine(curl(), { targetReps: 10 }), curlSession(1, () => 0), LEAD + 4 * 4000 + 400);
  assert.equal(eventsOf(clean.events, "rep_completed").length, 4);
  assert.equal(eventsOf(clean.events, "movement_error").length, 0);

  const drift = run(new MovementEngine(curl(), { targetReps: 10 }), curlSession(1, (t) => (t > LEAD + 800 ? 40 : 0)), LEAD + 4000 + 400);
  assert.ok(eventsOf(drift.events, "movement_error").some((e) => e.error === "elbow_drift"));

  const shallow = run(new MovementEngine(curl(), { targetReps: 10 }), curlSession(0.7, () => 0), LEAD + 4000 + 400);
  assert.ok(eventsOf(shallow.events, "movement_error").some((e) => e.error === "insufficient_curl"));
  assert.equal(eventsOf(shallow.events, "rep_completed").length, 0, "a shallow curl does not count");
  assert.equal(eventsOf(shallow.events, "partial_rep").length, 1);
});

test("neck rotation: turns to either side count, independent of camera distance", () => {
  const neckSession = (frame: FrameOpts) => (t: number) => {
    const tt = t - 1800;
    const cycle = Math.floor(Math.max(tt, 0) / 4000);
    const dir = cycle % 2 === 0 ? 1 : -1;
    const k = tt < 0 ? 0 : repCurve(tt, 4000, 1);
    return frontFrame({ headYaw: dir * 0.2 * k + 0.02 }, { noisePx: 1, seed: Math.round(t), cy: 400, ...frame });
  };
  for (const frame of [{}, { pxPerM: 260, cy: 330 }, { W: 640, H: 480, pxPerM: 300, cy: 280 }]) {
    const eng = new MovementEngine(neck(), { targetReps: 8 });
    const r = run(eng, neckSession(frame), 1800 + 4 * 4000 + 300);
    assert.equal(eventsOf(r.events, "rep_completed").length, 4, JSON.stringify(frame));
    assert.equal(eventsOf(r.events, "movement_error").length, 0, JSON.stringify(frame));
    assert.ok(r.last.primary >= 0, "primary exposed in display units");
  }
});
