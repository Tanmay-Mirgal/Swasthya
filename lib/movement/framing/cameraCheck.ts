/**
 * lib/movement/framing/cameraCheck.ts
 *
 * Decides whether the camera set-up is good enough for the exercise and, if not, what
 * single instruction to give. Never judges posture: it only reports framing, distance,
 * orientation and visibility. Advice is debounced so it does not flicker.
 */
import { PoseLandmark } from "../landmarks";
import { dist2D, mid } from "../geometry/geometry";
import type { CameraAdvice, LM } from "../types";

export interface CameraSpec {
  view: "side" | "front" | "either";
  /** Vertical extent of the required joints as a fraction of the frame height. */
  minBodyFraction: number;
  maxBodyFraction: number;
}

export interface RequiredJoint {
  index: number;
  name: string;
}

export interface CameraInputs {
  points: readonly LM[] | null;
  aspect: number;
  required: readonly RequiredJoint[];
  weak: readonly number[];
  cutOff: readonly number[];
  segmentWord: string;
}

const SIDE_MAX_RATIO = 0.55;
const FRONT_MIN_RATIO = 0.6;

const NO_PERSON: CameraAdvice = { code: "no_person", message: "I can't see you. Step into the frame." };
const TOO_CLOSE: CameraAdvice = { code: "too_close", message: "Move slightly backward." };
const TOO_FAR: CameraAdvice = { code: "too_far", message: "Move a little closer to the camera." };
const TURN_SIDE: CameraAdvice = { code: "wrong_orientation", message: "Turn so your side faces the camera." };
const TURN_FRONT: CameraAdvice = { code: "wrong_orientation", message: "Turn to face the camera." };

const nameOf = (req: readonly RequiredJoint[], idx: number) => req.find((r) => r.index === idx)?.name ?? "body";

/** The advice that applies RIGHT NOW, before debouncing. Highest-priority problem wins. */
export function rawCameraAdvice(spec: CameraSpec, inp: CameraInputs): CameraAdvice | null {
  const { points, aspect, required } = inp;
  if (!points) return NO_PERSON;

  if (inp.cutOff.length) {
    const names = [...new Set(inp.cutOff.map((i) => nameOf(required, i)))];
    return {
      code: "cut_off",
      joint: names[0],
      message: names.length > 1 ? "Keep your full body inside the frame." : `Your ${names[0]} is at the edge of the frame. Move back a little.`,
    };
  }

  // Distance: how much of the frame the required joints fill. Measured in image-height units on
  // both axes and against the frame's shorter side, so a portrait phone is judged fairly.
  let minY = 1;
  let maxY = 0;
  let minX = 1;
  let maxX = 0;
  for (const r of required) {
    const pt = points[r.index];
    if (!pt) continue;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
  }
  const span = Math.max(maxY - minY, (maxX - minX) * aspect) / Math.min(1, aspect);
  if (span > spec.maxBodyFraction) return TOO_CLOSE;

  if (inp.weak.length) {
    const names = [...new Set(inp.weak.map((i) => nameOf(required, i)))];
    if (span < spec.minBodyFraction) return TOO_FAR;
    return names.length === 1
      ? { code: "low_visibility", joint: names[0], message: `I can't clearly see your ${names[0]}. Check nothing is blocking it.` }
      : { code: "low_visibility", message: `I can't see you clearly. Improve the lighting and keep your whole ${inp.segmentWord} in view.` };
  }
  if (span < spec.minBodyFraction) return TOO_FAR;

  // Orientation, only when both shoulders and both hips are tracked.
  if (spec.view !== "either") {
    const ls = points[PoseLandmark.LEFT_SHOULDER];
    const rs = points[PoseLandmark.RIGHT_SHOULDER];
    const lh = points[PoseLandmark.LEFT_HIP];
    const rh = points[PoseLandmark.RIGHT_HIP];
    const ok = [ls, rs, lh, rh].every((p) => p && (p.visibility ?? 1) >= 0.5);
    if (ok) {
      const torso = dist2D(mid(ls, rs), mid(lh, rh), aspect);
      if (torso > 0.02) {
        const ratio = dist2D(ls, rs, aspect) / torso;
        if (spec.view === "side" && ratio > FRONT_MIN_RATIO + 0.2) return TURN_SIDE;
        if (spec.view === "front" && ratio < SIDE_MAX_RATIO - 0.15) return TURN_FRONT;
      }
    }
  }
  return null;
}

/** Debounces raw advice: it must persist before it is shown and be absent before it clears. */
export class CameraAdvisor {
  current: CameraAdvice | null = null;
  private candidate: CameraAdvice | null = null;
  private since = 0;

  constructor(private readonly showAfterMs = 500, private readonly clearAfterMs = 350) {}

  reset() {
    this.current = null;
    this.candidate = null;
    this.since = 0;
  }

  /** Returns true when `current` changed (appeared, changed code, or cleared). */
  update(t: number, raw: CameraAdvice | null): boolean {
    const same = (a: CameraAdvice | null, b: CameraAdvice | null) => (a === null && b === null) || (a !== null && b !== null && a.code === b.code && a.joint === b.joint);
    if (!same(raw, this.candidate)) {
      this.candidate = raw;
      this.since = t;
    }
    if (same(this.candidate, this.current)) {
      if (this.candidate) this.current = this.candidate; // keep message text fresh
      return false;
    }
    const need = this.candidate === null ? this.clearAfterMs : this.showAfterMs;
    if (t - this.since >= need) {
      this.current = this.candidate;
      return true;
    }
    return false;
  }
}
