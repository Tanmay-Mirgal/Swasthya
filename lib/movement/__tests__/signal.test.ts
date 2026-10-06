import test from "node:test";
import assert from "node:assert/strict";
import { LandmarkStabilizer } from "../signal/stabilizer";
import { ConfidenceTracker } from "../signal/confidence";
import { CameraAdvisor, rawCameraAdvice, type CameraSpec } from "../framing/cameraCheck";
import { sideFrame } from "../testing/synth";
import { PoseLandmark as L } from "../landmarks";
import type { LM } from "../types";

const std = (v: number[]) => {
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length);
};

test("stabilizer cuts jitter on a still joint by at least 60%", () => {
  const stab = new LandmarkStabilizer();
  const raw: number[] = [];
  const out: number[] = [];
  for (let i = 0; i < 150; i++) {
    const f = sideFrame({}, { noisePx: 2.5, seed: 100 + i }); // fresh noise every frame
    stab.update(i * 33.3, f.image, f.world);
    if (i >= 30) {
      raw.push(f.image[L.LEFT_KNEE].x);
      out.push(stab.points[L.LEFT_KNEE].x);
    }
  }
  assert.ok(std(out) < std(raw) * 0.4, `smoothed ${std(out)} vs raw ${std(raw)}`);
});

test("stabilizer follows a fast movement without visible lag", () => {
  const stab = new LandmarkStabilizer();
  let worst = 0;
  // The knee x sweeps 0.3 normalised units in one second, 30 fps, no noise.
  for (let i = 0; i < 60; i++) {
    const f = sideFrame({ knee: 90 + 90 * Math.min(1, i / 30) }, {});
    stab.update(i * 33.3, f.image, f.world);
    if (i > 5 && i <= 30) worst = Math.max(worst, Math.abs(stab.points[L.LEFT_ANKLE].x - f.image[L.LEFT_ANKLE].x));
  }
  assert.ok(worst < 0.02, `lag error ${worst} (normalised) is too large`);
});

test("stabilizer is frame-rate independent: 15 fps and 60 fps settle alike", () => {
  const settle = (fps: number) => {
    const stab = new LandmarkStabilizer();
    const still = sideFrame({}, { noisePx: 0 });
    const jump = sideFrame({ knee: 150 }, { noisePx: 0 });
    const dt = 1000 / fps;
    let t = 0;
    for (let i = 0; i < 5; i++, t += dt) stab.update(t, still.image, still.world);
    let steps = 0;
    for (; steps < 300; steps++, t += dt) {
      stab.update(t, jump.image, jump.world);
      if (Math.abs(stab.points[L.LEFT_ANKLE].x - jump.image[L.LEFT_ANKLE].x) < 0.005) break;
    }
    return steps * dt;
  };
  const a = settle(15);
  const b = settle(60);
  assert.ok(Math.abs(a - b) < 250, `settle ${a}ms vs ${b}ms`);
});

test("stabilizer resets after a gap and when the person disappears", () => {
  const stab = new LandmarkStabilizer();
  const a = sideFrame({}, {});
  stab.update(0, a.image, a.world);
  assert.equal(stab.update(33, null, null), false);
  const b = sideFrame({ knee: 150 }, {});
  stab.update(66, b.image, b.world);
  assert.ok(Math.abs(stab.points[L.LEFT_ANKLE].x - b.image[L.LEFT_ANKLE].x) < 1e-6, "first frame after reset is not smoothed toward stale data");
});

const REQUIRED = [L.LEFT_SHOULDER, L.LEFT_HIP, L.LEFT_KNEE, L.LEFT_ANKLE];

function levelAfter(frames: { image: LM[] }[], dtMs = 33) {
  const c = new ConfidenceTracker();
  let r = c.update(0, null, REQUIRED);
  frames.forEach((f, i) => (r = c.update(i * dtMs, f.image, REQUIRED)));
  return r;
}

test("confidence: clear frames reach HIGH, partial visibility is MEDIUM, hidden joint is LOW", () => {
  const good = Array.from({ length: 40 }, () => sideFrame({}, {}));
  assert.equal(levelAfter(good).level, "HIGH");
  const medium = Array.from({ length: 40 }, () => sideFrame({}, { vis: { [L.LEFT_KNEE]: 0.6 } }));
  assert.equal(levelAfter(medium).level, "MEDIUM");
  const low = Array.from({ length: 40 }, () => sideFrame({}, { vis: { [L.LEFT_KNEE]: 0.2 } }));
  const r = levelAfter(low);
  assert.equal(r.level, "LOW");
  assert.deepEqual(r.weak, [L.LEFT_KNEE]);
});

test("confidence: one noisy frame does not flip the level (debounce)", () => {
  const c = new ConfidenceTracker();
  const good = sideFrame({}, {});
  const bad = sideFrame({}, { vis: { [L.LEFT_KNEE]: 0.1 } });
  let t = 0;
  for (let i = 0; i < 40; i++, t += 33) c.update(t, good.image, REQUIRED);
  assert.equal(c.level, "HIGH");
  c.update((t += 33), bad.image, REQUIRED);
  assert.notEqual(c.level, "LOW");
  for (let i = 0; i < 12; i++, t += 33) c.update(t, bad.image, REQUIRED);
  assert.equal(c.level, "LOW");
});

test("confidence: a joint outside the frame is LOW and reported as cut off", () => {
  const f = sideFrame({}, { pxPerM: 380, cy: 600 }); // low in frame: ankle falls off the bottom
  const r = levelAfter(Array.from({ length: 40 }, () => f));
  assert.equal(r.level, "LOW");
  assert.ok(r.cutOff.includes(L.LEFT_ANKLE));
});

const SPEC: CameraSpec = { view: "side", minBodyFraction: 0.3, maxBodyFraction: 0.88 };
const advice = (opts: Parameters<typeof sideFrame>[1], params: Parameters<typeof sideFrame>[0] = {}) => {
  const f = sideFrame(params, opts);
  const stab = new LandmarkStabilizer();
  stab.update(0, f.image, f.world);
  const required = REQUIRED.map((index) => ({ index, name: "joint" }));
  const c = new ConfidenceTracker();
  let r = c.update(0, stab.points, REQUIRED);
  for (let i = 1; i < 40; i++) r = c.update(i * 33, stab.points, REQUIRED);
  return rawCameraAdvice(SPEC, { points: stab.points, aspect: f.aspect, required, weak: r.weak, cutOff: r.cutOff, segmentWord: "leg" });
};

test("camera advice: good set-up gives none", () => assert.equal(advice({}), null));
test("camera advice: too close", () => assert.equal(advice({ pxPerM: 700, cy: 400 })?.code, "too_close"));
test("camera advice: too far", () => assert.equal(advice({ pxPerM: 130 })?.code, "too_far"));
test("camera advice: cut off at the bottom of the frame", () => assert.equal(advice({ cy: 640 })?.code, "cut_off"));
test("camera advice: a blocked joint asks to check the view", () => {
  const a = advice({ vis: { [L.LEFT_KNEE]: 0.25 } });
  assert.equal(a?.code, "low_visibility");
  assert.match(a!.message, /clearly see/i);
});
test("camera advice: facing the camera when the exercise needs a side view", () => {
  // Shoulders far apart relative to the torso = front-facing.
  const f = sideFrame({}, {});
  const img = f.image.map((p) => ({ ...p }));
  img[L.RIGHT_SHOULDER].x -= 0.18;
  img[L.LEFT_SHOULDER].x += 0.0;
  const stab = new LandmarkStabilizer();
  stab.update(0, img, f.world);
  const required = REQUIRED.map((index) => ({ index, name: "joint" }));
  const a = rawCameraAdvice(SPEC, { points: stab.points, aspect: f.aspect, required, weak: [], cutOff: [], segmentWord: "leg" });
  assert.equal(a?.code, "wrong_orientation");
});
test("camera advice: no person", () => {
  assert.equal(rawCameraAdvice(SPEC, { points: null, aspect: 1.7, required: [], weak: [], cutOff: [], segmentWord: "leg" })?.code, "no_person");
});

test("camera advisor needs persistence before showing and before clearing", () => {
  const adv = new CameraAdvisor(500, 350);
  const a = { code: "too_close" as const, message: "Move slightly backward." };
  assert.equal(adv.update(0, a), false);
  assert.equal(adv.current, null);
  assert.equal(adv.update(300, a), false);
  assert.equal(adv.update(550, a), true);
  assert.equal((adv.current as { code: string } | null)?.code, "too_close");
  assert.equal(adv.update(600, null), false);
  assert.equal((adv.current as { code: string } | null)?.code, "too_close");
  assert.equal(adv.update(1000, null), true);
  assert.equal(adv.current, null);
});

test("raw landmarks are exactly MediaPipe's output while the filtered ones trail a moving joint (the overlay draws raw)", () => {
  const frame = (x: number) => Array.from({ length: 33 }, () => ({ x, y: 0.5, z: 0, visibility: 1 }));
  const s = new LandmarkStabilizer();
  let t = 0;
  for (let i = 0; i < 30; i++) s.update((t += 33), frame(0.3));
  for (let i = 0; i < 6; i++) s.update((t += 33), frame(0.3 + 0.05 * (i + 1)));
  assert.ok(Math.abs(s.raw[0] - 0.6) < 1e-6);
  assert.ok(s.raw[0] - s.xyz[0] > 0.002, `the filtered point lags behind the body (${s.raw[0] - s.xyz[0]})`);
});
