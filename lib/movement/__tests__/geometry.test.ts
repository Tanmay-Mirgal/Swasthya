import test from "node:test";
import assert from "node:assert/strict";
import { angle2D, angle3D, angleFromVertical, dist2D, median } from "../geometry/geometry";
import type { LM } from "../types";

const p = (x: number, y: number, z = 0): LM => ({ x, y, z, visibility: 1 });
const close = (a: number, b: number, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`);

test("angle2D: right angle on a square frame", () => {
  close(angle2D(p(0.5, 0.2), p(0.5, 0.5), p(0.8, 0.5), 1), 90);
});

test("angle2D: a 16:9 frame does not distort the angle (aspect-corrected)", () => {
  // A true 45 degree joint drawn in pixels on a 1280x720 frame.
  const W = 1280;
  const H = 720;
  const a = p(500 / W, (400 - 216) / H);
  const b = p(500 / W, 400 / H);
  const c = p((500 + 150) / W, (400 - 150) / H);
  close(angle2D(a, b, c, W / H), 45);
  // Without the correction the same joint reads about 29 degrees: the bug this fixes.
  assert.ok(Math.abs(angle2D(a, b, c, 1) - 45) > 10);
});

test("angle2D is the same on a portrait phone frame", () => {
  const W = 720;
  const H = 1280;
  const a = p(300 / W, (600 - 200) / H);
  const b = p(300 / W, 600 / H);
  const c = p((300 + 200) / W, 600 / H);
  close(angle2D(a, b, c, W / H), 90);
});

test("straight limb is 180, folded limb is 0", () => {
  close(angle2D(p(0.5, 0.2), p(0.5, 0.4), p(0.5, 0.6), 1), 180);
  close(angle2D(p(0.5, 0.2), p(0.5, 0.4), p(0.5, 0.2), 1), 0);
});

test("missing or degenerate points return NaN, never 0", () => {
  assert.ok(Number.isNaN(angle2D(undefined, p(0, 0), p(1, 1), 1)));
  assert.ok(Number.isNaN(angle2D(p(0.5, 0.5), p(0.5, 0.5), p(0.7, 0.7), 1)));
  assert.ok(Number.isNaN(angle3D(p(0, 0), p(0, 0), p(1, 1))));
  assert.ok(Number.isNaN(angleFromVertical(undefined, p(0, 0), 1)));
});

test("angle3D uses depth that 2D cannot see", () => {
  // Limb folded toward the camera: in 2D (x,y) it looks straight, in 3D it is 90 degrees.
  const a = p(0, -1, 0);
  const b = p(0, 0, 0);
  const c = p(0, -0.5, 1);
  close(angle3D(a, b, c), 63.43);
  close(angle2D(a, b, c, 1), 0);
});

test("angleFromVertical: 0 hanging down, 90 horizontal", () => {
  close(angleFromVertical(p(0.5, 0.2), p(0.5, 0.5), 1), 0);
  close(angleFromVertical(p(0.5, 0.2), p(0.8, 0.2), 1), 90);
  close(angleFromVertical(p(0.5, 0.2), p(0.7, 0.4), 1), 45);
});

test("distances are isotropic after aspect correction", () => {
  const d1 = dist2D(p(0.1, 0.5), p(0.1 + 90 / 1280, 0.5), 1280 / 720);
  const d2 = dist2D(p(0.1, 0.5), p(0.1, 0.5 + 90 / 720), 1280 / 720);
  close(d1, d2, 1e-6);
});

test("median ignores NaN and handles even counts", () => {
  assert.equal(median([3, NaN, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.ok(Number.isNaN(median([NaN])));
});
