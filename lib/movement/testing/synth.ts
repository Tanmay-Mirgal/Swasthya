/**
 * lib/movement/testing/synth.ts
 *
 * A synthetic stick-figure generator for tests, replay and design fixtures. It builds the
 * 33 MediaPipe landmarks (image AND world) from joint angles by forward kinematics, with
 * controllable frame size, camera distance, noise and visibility, so the real engine can
 * be exercised without a camera. It is deliberately simple: it proves the LOGIC (phases,
 * thresholds, hysteresis, confidence) on known geometry; it cannot prove how well
 * MediaPipe tracks a real person, which needs real-camera review.
 *
 * Body frame: metres, X to the subject's forward (side view) or to image-right (front
 * view), Y down. Left = subject's left (image-right in a front view).
 */
import type { FrameResult } from "../judge/engine";
import { MovementEngine } from "../judge/engine";
import type { LM, MovementEvent, RawFrame } from "../types";
import { PoseLandmark as L } from "../landmarks";

const RAD = Math.PI / 180;

export interface FrameOpts {
  W?: number;
  H?: number;
  /** Pixels per metre (camera distance: smaller = further away). */
  pxPerM?: number;
  /** Pixel position of the hip (or of the ground line when `groundPx` is used). */
  cx?: number;
  cy?: number;
  /** Gaussian noise in pixels applied to every image landmark. */
  noisePx?: number;
  seed?: number;
  /** Visibility per landmark index (default 0.98 near side / 0.9 elsewhere). */
  vis?: Partial<Record<number, number>>;
  /** Override all visibilities. */
  allVis?: number;
}

export interface SideParams {
  /** Thigh angle from straight down, forward positive. 90 = seated, 0 = standing. */
  thighTilt?: number;
  /** Interior knee angle in degrees (90 seated, 180 straight). */
  knee?: number;
  /** Forward lean of the torso from vertical, degrees. */
  torsoTilt?: number;
  /** Interior elbow angle (180 = hanging straight). */
  elbow?: number;
  /** Upper arm swing from vertical, degrees (forward positive). */
  upperArm?: number;
  /** Keep the ankles on the ground line (standing movements) instead of the hip on the chair. */
  groundFixed?: boolean;
  /** Which side is toward the camera. */
  near?: "left" | "right";
  farVis?: number;
  /** Heel rise in metres. */
  heelLift?: number;
}

export interface FrontParams {
  /** Nose offset as a fraction of shoulder width (positive = toward image right). */
  headYaw?: number;
  /** Arm abduction from vertical, degrees, per subject side. */
  armLeft?: number;
  armRight?: number;
  /** Forward thigh tilt in degrees (0 standing). Squat depth. */
  squat?: number;
  /** Knee inward shift in metres (toward the midline). */
  valgusLeft?: number;
  valgusRight?: number;
  heelLift?: number;
  /** Lateral trunk tilt in degrees. */
  trunkTilt?: number;
  /** Shoulder rise in metres (shrug). */
  shrug?: number;
  /** Vertical offset of the left shoulder relative to the right (metres). */
  shoulderSlope?: number;
  /** Elbow bend in degrees for the abducted arm (0 = straight). */
  elbowBend?: number;
}

// ── PRNG ───────────────────────────────────────────────────────────────────────

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(rnd: () => number) {
  const u = Math.max(rnd(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
}

type P = [number, number]; // metres [x, y]

function finish(pos: Map<number, P>, o: FrameOpts, vis: (i: number) => number, ground?: { y: number }): { image: LM[]; world: LM[]; aspect: number } {
  const W = o.W ?? 1280;
  const H = o.H ?? 720;
  const s = o.pxPerM ?? 380;
  const cx = o.cx ?? W / 2;
  const cy = o.cy ?? H * 0.38;
  const rnd = mulberry32(o.seed ?? 1);
  const noise = o.noisePx ?? 0;
  const image: LM[] = [];
  const world: LM[] = [];
  const fallback: P = [0, 0];
  // Anchor so that the ground line (if any) is at 92% of the frame height.
  const yShift = ground ? H * 0.92 - (cy + ground.y * s) : 0;
  for (let i = 0; i < 33; i++) {
    const [X, Y] = pos.get(i) ?? fallback;
    const px = cx + X * s + (noise ? gauss(rnd) * noise : 0);
    const py = cy + yShift + Y * s + (noise ? gauss(rnd) * noise : 0);
    const v = o.allVis ?? o.vis?.[i] ?? vis(i);
    image.push({ x: px / W, y: py / H, z: 0, visibility: v });
    world.push({ x: X, y: Y, z: 0, visibility: v });
  }
  return { image, world, aspect: W / H };
}

/** Fills the face and fingers (never used for judgment) so all 33 slots exist. */
function fillMisc(pos: Map<number, P>) {
  const nose = pos.get(L.NOSE)!;
  for (const i of [1, 2, 3, 4, 5, 6, 9, 10]) pos.set(i, [nose[0], nose[1]]);
  for (const [i, from] of [
    [L.LEFT_PINKY, L.LEFT_WRIST],
    [L.LEFT_INDEX, L.LEFT_WRIST],
    [L.LEFT_THUMB, L.LEFT_WRIST],
    [L.RIGHT_PINKY, L.RIGHT_WRIST],
    [L.RIGHT_INDEX, L.RIGHT_WRIST],
    [L.RIGHT_THUMB, L.RIGHT_WRIST],
  ] as const) pos.set(i, [...(pos.get(from) as P)] as P);
}

// ── Side view ──────────────────────────────────────────────────────────────────

/** A person seen from the side, facing image-right. Near side = the one toward the camera. */
export function sideFrame(p: SideParams = {}, o: FrameOpts = {}) {
  const thighTilt = p.thighTilt ?? 90;
  const knee = p.knee ?? 90;
  const torso = p.torsoTilt ?? 0;
  const elbow = p.elbow ?? 180;
  const upperArm = p.upperArm ?? 0;
  const near = p.near ?? "left";
  const THIGH = 0.42;
  const SHIN = 0.42;
  const TORSO = 0.5;
  const UPPER = 0.3;
  const FORE = 0.27;

  // Leg by forward kinematics from the hip (origin).
  const hip: P = [0, 0];
  const tt = thighTilt * RAD;
  const kneeP: P = [THIGH * Math.sin(tt), THIGH * Math.cos(tt)];
  const shankTilt = (thighTilt - (180 - knee)) * RAD;
  const ankleP: P = [kneeP[0] + SHIN * Math.sin(shankTilt), kneeP[1] + SHIN * Math.cos(shankTilt)];
  const farKnee: P = [THIGH * Math.sin(tt), THIGH * Math.cos(tt)];
  const farAnkle: P = ankleP;
  const tr = torso * RAD;
  const shoulder: P = [TORSO * Math.sin(tr), -TORSO * Math.cos(tr)];
  const ua = upperArm * RAD;
  const elbowP: P = [shoulder[0] + UPPER * Math.sin(ua), shoulder[1] + UPPER * Math.cos(ua)];
  // Forearm: interior angle `elbow` at the elbow between upper arm (toward shoulder) and forearm.
  const upDir = Math.atan2(shoulder[0] - elbowP[0], -(shoulder[1] - elbowP[1])); // direction elbow→shoulder from "up"
  const foreAngle = upDir + elbow * RAD; // rotate toward forward
  const wristP: P = [elbowP[0] + FORE * Math.sin(foreAngle), elbowP[1] - FORE * Math.cos(foreAngle)];
  const head: P = [shoulder[0] + 0.07, shoulder[1] - 0.24];

  const pos = new Map<number, P>();
  const set = (side: "left" | "right", ids: [number, number], pt: P, dx = 0) => pos.set(side === "left" ? ids[0] : ids[1], [pt[0] + dx, pt[1]]);
  const far = near === "left" ? "right" : "left";
  pos.set(L.NOSE, head);
  set(near, [L.LEFT_EAR, L.RIGHT_EAR], [head[0] - 0.07, head[1] + 0.02]);
  set(far, [L.LEFT_EAR, L.RIGHT_EAR], [head[0] - 0.07, head[1] + 0.02], 0.01);
  const lift = p.heelLift ?? 0;
  for (const [side, dx] of [
    [near, 0],
    [far, 0.02],
  ] as const) {
    set(side, [L.LEFT_SHOULDER, L.RIGHT_SHOULDER], shoulder, dx);
    set(side, [L.LEFT_HIP, L.RIGHT_HIP], hip, dx);
    set(side, [L.LEFT_ELBOW, L.RIGHT_ELBOW], side === near ? elbowP : [shoulder[0], shoulder[1] + UPPER], dx);
    set(side, [L.LEFT_WRIST, L.RIGHT_WRIST], side === near ? wristP : [shoulder[0], shoulder[1] + UPPER + FORE], dx);
    const k = side === near ? kneeP : farKnee;
    const a = side === near ? ankleP : farAnkle;
    set(side, [L.LEFT_KNEE, L.RIGHT_KNEE], k, dx);
    set(side, [L.LEFT_ANKLE, L.RIGHT_ANKLE], a, dx);
    set(side, [L.LEFT_HEEL, L.RIGHT_HEEL], [a[0] - 0.05, a[1] + 0.06 - lift], dx);
    set(side, [L.LEFT_FOOT_INDEX, L.RIGHT_FOOT_INDEX], [a[0] + 0.15, a[1] + 0.07], dx);
  }
  fillMisc(pos);
  const nearIdx = new Set(near === "left" ? [11, 13, 15, 23, 25, 27, 29, 31, 7] : [12, 14, 16, 24, 26, 28, 30, 32, 8]);
  const vis = (i: number) => (nearIdx.has(i) ? 0.98 : p.farVis ?? 0.62);
  return finish(pos, o, vis, p.groundFixed ? { y: ankleP[1] + 0.06 } : undefined);
}

// ── Front view ─────────────────────────────────────────────────────────────────

/** A person seen from the front. Subject's left is image-right. */
export function frontFrame(p: FrontParams = {}, o: FrameOpts = {}) {
  const SH = 0.2; // half shoulder width
  const HIP = 0.1;
  const TORSO = 0.5;
  const THIGH = 0.42;
  const SHIN = 0.42;
  const squat = (p.squat ?? 0) * RAD;
  const shinTilt = squat * 0.5;
  const tilt = (p.trunkTilt ?? 0) * RAD;
  const shrug = p.shrug ?? 0;
  const slope = p.shoulderSlope ?? 0;
  const pos = new Map<number, P>();

  const ankleY = THIGH * Math.cos(squat) + SHIN * Math.cos(shinTilt);
  const sx = (side: 1 | -1, half: number): P => [side * half, 0];
  for (const side of [1, -1] as const) {
    const left = side === 1;
    const ids = (a: number, b: number) => (left ? a : b);
    const hip = sx(side, HIP);
    const valgus = (left ? p.valgusLeft : p.valgusRight) ?? 0;
    const kneeP: P = [side * (HIP) - side * valgus, THIGH * Math.cos(squat)];
    const ankleP: P = [side * HIP, ankleY];
    // Torso tilt rotates the shoulder line around the hip midpoint.
    const sxm = side * SH;
    const shoulderP: P = [sxm * Math.cos(tilt) + TORSO * Math.sin(tilt), -TORSO * Math.cos(tilt) - sxm * Math.sin(tilt) - shrug + (left ? slope : 0)];
    const arm = ((left ? p.armLeft : p.armRight) ?? 0) * RAD;
    const bend = (p.elbowBend ?? 0) * RAD;
    const elbowP: P = [shoulderP[0] + side * 0.3 * Math.sin(arm), shoulderP[1] + 0.3 * Math.cos(arm)];
    const wristP: P = [elbowP[0] + side * 0.27 * Math.sin(arm - bend), elbowP[1] + 0.27 * Math.cos(arm - bend)];
    pos.set(ids(L.LEFT_SHOULDER, L.RIGHT_SHOULDER), shoulderP);
    pos.set(ids(L.LEFT_ELBOW, L.RIGHT_ELBOW), elbowP);
    pos.set(ids(L.LEFT_WRIST, L.RIGHT_WRIST), wristP);
    pos.set(ids(L.LEFT_HIP, L.RIGHT_HIP), hip);
    pos.set(ids(L.LEFT_KNEE, L.RIGHT_KNEE), kneeP);
    pos.set(ids(L.LEFT_ANKLE, L.RIGHT_ANKLE), ankleP);
    const lift = p.heelLift ?? 0;
    pos.set(ids(L.LEFT_HEEL, L.RIGHT_HEEL), [ankleP[0], ankleP[1] + 0.07 - lift]);
    pos.set(ids(L.LEFT_FOOT_INDEX, L.RIGHT_FOOT_INDEX), [ankleP[0], ankleP[1] + 0.07]);
    pos.set(ids(L.LEFT_EAR, L.RIGHT_EAR), [side * 0.08, -TORSO - 0.22]);
  }
  const midShoulder = [(pos.get(L.LEFT_SHOULDER)![0] + pos.get(L.RIGHT_SHOULDER)![0]) / 2, (pos.get(L.LEFT_SHOULDER)![1] + pos.get(L.RIGHT_SHOULDER)![1]) / 2];
  pos.set(L.NOSE, [midShoulder[0] + (p.headYaw ?? 0) * 2 * SH, midShoulder[1] - 0.22]);
  fillMisc(pos);
  return finish(pos, o, () => 0.97, ankleY > 0 && (p.squat !== undefined || p.heelLift !== undefined) ? { y: ankleY + 0.07 } : undefined);
}

// ── Timelines ──────────────────────────────────────────────────────────────────

const smooth = (x: number) => x * x * (3 - 2 * x);

/**
 * One repetition as a 0..1 curve over `periodMs`: rise, hold at the top, fall, short rest.
 * `peak` scales how far it goes (1 = full target, 0.5 = half-range rep).
 */
export function repCurve(tMs: number, periodMs: number, peak = 1, holdFrac = 0.15): number {
  const p = (tMs % periodMs) / periodMs;
  const up = 0.38;
  const hold = up + holdFrac;
  const down = hold + 0.37;
  if (p < up) return peak * smooth(p / up);
  if (p < hold) return peak;
  if (p < down) return peak * (1 - smooth((p - hold) / (down - hold)));
  return 0;
}

export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export interface RunResult {
  events: MovementEvent[];
  last: FrameResult;
  frames: number;
  /** Per-frame snapshots of selected fields, for assertions on visuals. */
  trace: { t: number; phase: string; joints: number[]; confidence: string; counted: number }[];
}

export type FrameBuilder = (tMs: number) => { image: LM[] | null; world?: LM[] | null; aspect: number };

/** Feeds `builder(t)` to the engine at `fps` for `durationMs` and collects every event. */
export function run(engine: MovementEngine, builder: FrameBuilder, durationMs: number, opts: { fps?: number; startMs?: number; trace?: boolean } = {}): RunResult {
  const fps = opts.fps ?? 30;
  const start = opts.startMs ?? 0;
  const events: MovementEvent[] = [];
  const trace: RunResult["trace"] = [];
  let frames = 0;
  let last = engine.result;
  for (let t = 0; t <= durationMs; t += 1000 / fps) {
    const f = builder(t);
    const frame: RawFrame = { t: start + t, image: f.image, world: f.world ?? null, aspect: f.aspect };
    last = engine.process(frame);
    for (const e of last.events) events.push(e);
    if (opts.trace) trace.push({ t: start + t, phase: last.phase, joints: Array.from(last.joints), confidence: last.confidence, counted: last.counted });
    frames++;
  }
  return { events, last, frames, trace };
}

export const eventsOf = <T extends MovementEvent["type"]>(events: MovementEvent[], type: T) => events.filter((e): e is Extract<MovementEvent, { type: T }> => e.type === type);
