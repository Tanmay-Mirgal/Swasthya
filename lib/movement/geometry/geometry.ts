/**
 * lib/movement/geometry/geometry.ts
 *
 * Aspect-correct angle and distance maths. MediaPipe's normalised x spans the frame WIDTH
 * and y the frame HEIGHT, so a vector measured in raw normalised units is stretched on a
 * 16:9 camera. Every 2D calculation here multiplies x by the frame aspect (width/height)
 * first, which puts both axes in the same unit. 3D calculations use metric world landmarks.
 *
 * Missing input returns NaN (never 0, which is a legitimate angle). Callers use isFinite.
 */
import type { LM } from "../types";

const RAD = 180 / Math.PI;

/** Interior angle at `b` formed by a-b-c, in degrees [0, 180], from 2D image landmarks. */
export function angle2D(a: LM | undefined, b: LM | undefined, c: LM | undefined, aspect: number): number {
  if (!a || !b || !c) return NaN;
  const bax = (a.x - b.x) * aspect;
  const bay = a.y - b.y;
  const bcx = (c.x - b.x) * aspect;
  const bcy = c.y - b.y;
  const mag = Math.hypot(bax, bay) * Math.hypot(bcx, bcy);
  if (mag < 1e-9) return NaN;
  return Math.acos(clamp((bax * bcx + bay * bcy) / mag, -1, 1)) * RAD;
}

/** Interior angle at `b` from metric 3D world landmarks. */
export function angle3D(a: LM | undefined, b: LM | undefined, c: LM | undefined): number {
  if (!a || !b || !c) return NaN;
  const bax = a.x - b.x;
  const bay = a.y - b.y;
  const baz = a.z - b.z;
  const bcx = c.x - b.x;
  const bcy = c.y - b.y;
  const bcz = c.z - b.z;
  const mag = Math.hypot(bax, bay, baz) * Math.hypot(bcx, bcy, bcz);
  if (mag < 1e-9) return NaN;
  return Math.acos(clamp((bax * bcx + bay * bcy + baz * bcz) / mag, -1, 1)) * RAD;
}

/** Angle between the segment a→b and straight down in the image, [0, 180]. 0 = hanging down, 90 = horizontal. */
export function angleFromVertical(a: LM | undefined, b: LM | undefined, aspect: number): number {
  if (!a || !b) return NaN;
  const dx = (b.x - a.x) * aspect;
  const dy = b.y - a.y;
  if (Math.hypot(dx, dy) < 1e-9) return NaN;
  return Math.atan2(Math.abs(dx), dy) * RAD;
}

/** Distance in "image height" units (x scaled by aspect so it is isotropic). */
export function dist2D(a: LM | undefined, b: LM | undefined, aspect: number): number {
  if (!a || !b) return NaN;
  return Math.hypot((a.x - b.x) * aspect, a.y - b.y);
}

export function mid(a: LM | undefined, b: LM | undefined): LM | undefined {
  if (!a || !b) return undefined;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, visibility: Math.min(a.visibility ?? 1, b.visibility ?? 1) };
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Median of the finite values; NaN when there are none. */
export function median(values: readonly number[]): number {
  const v = values.filter(Number.isFinite).sort((p, q) => p - q);
  if (!v.length) return NaN;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
