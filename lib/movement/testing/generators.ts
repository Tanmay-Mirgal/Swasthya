/**
 * lib/movement/testing/generators.ts
 *
 * One synthetic-person generator per exercise, with the same few dials, so every template can be put through the same
 * conditions (clean, short, flicked, broken mandatory rule, not seen). They draw geometrically honest landmarks; they
 * prove the rules and the engine, not how a real camera tracks a real body.
 */
import { lerp, repCurve, frontFrame, sideFrame, type FrameBuilder } from "./synth";
import { kneeExtensionSession } from "./scenarios";

export interface CaseOpts {
  /** Milliseconds per repetition (default per exercise). */
  period?: number;
  /** How far the movement goes (1 = full range). */
  peak?: number;
  /** Apply this exercise's characteristic mandatory fault from early in the first repetition. */
  fault?: boolean;
}

export interface ExerciseCase {
  id: string;
  /** Default milliseconds per repetition. */
  period: number;
  /** The frame at which the first repetition starts. */
  lead: number;
  /** The build function for this exercise. */
  build: (o?: CaseOpts) => FrameBuilder;
  /** Error code the `fault` option should raise (a MANDATORY rule). */
  faultCode: string | null;
  /** Frames per second to run at (fast cycles need more). */
  fps?: number;
  /** A `peak` that moves clearly out but stays short of the full range. */
  shortPeak?: number;
}

const k = (t: number, lead: number, period: number, peak = 1) => (t - lead < 0 ? 0 : repCurve(t - lead, period, peak));

export const EXERCISE_CASES: ExerciseCase[] = [
  {
    id: "seated-knee-extension",
    period: 4000,
    lead: 1600,
    faultCode: "trunk_lean",
    build: (o = {}) => kneeExtensionSession({ period: o.period, peak: o.peak, lean: o.fault ? (t) => (t > 1600 + 600 ? 28 : 0) : undefined }),
  },
  {
    id: "seated-bicep-curl",
    period: 4000,
    lead: 1600,
    faultCode: "elbow_drift",
    build: (o = {}) => (t) => sideFrame({ elbow: lerp(172, 55, k(t, 1600, o.period ?? 4000, o.peak)), upperArm: o.fault && t > 1600 + 800 ? 40 : 0 }, { noisePx: 1.2, seed: Math.round(t) }),
  },
  {
    id: "neck-rotation",
    period: 4000,
    lead: 1800,
    faultCode: null,
    build: (o = {}) => (t) => frontFrame({ headYaw: 0.2 * k(t, 1800, o.period ?? 4000, o.peak) + 0.02 }, { noisePx: 1, seed: Math.round(t), cy: 400 }),
  },
  {
    id: "sit-to-stand",
    period: 6000,
    lead: 2000,
    faultCode: "trunk_lean_forward",
    build: (o = {}) => (t) => {
      const p = k(t, 2000, o.period ?? 6000, o.peak);
      return sideFrame({ thighTilt: 90 * (1 - p), knee: 95 + 83 * p, torsoTilt: 10 + 28 * Math.sin(Math.PI * p) + (o.fault && t > 2000 + 800 ? 32 : 0), groundFixed: true }, { noisePx: 1.2, seed: Math.round(t) });
    },
  },
  {
    id: "shoulder-abduction",
    period: 4500,
    lead: 2000,
    faultCode: "arm_too_high",
    build: (o = {}) => (t) => frontFrame({ armLeft: 6 + ((o.fault ? 125 : 94) - 6) * k(t, 2000, o.period ?? 4500, o.peak) }, { noisePx: 1.2, seed: Math.round(t), cy: 330 }),
  },
  {
    id: "heel-raise",
    period: 5000,
    lead: 2000,
    faultCode: "knee_bent",
    build: (o = {}) => (t) => sideFrame({ thighTilt: o.fault ? 20 : 0, knee: o.fault ? 140 : 180, heelLift: 0.09 * k(t, 2000, o.period ?? 5000, o.peak), groundFixed: true }, { noisePx: 1, seed: Math.round(t) }),
  },
  {
    id: "mini-squat",
    shortPeak: 0.75,
    period: 6000,
    lead: 2000,
    faultCode: "knee_inward_left",
    build: (o = {}) => (t) => frontFrame({ squat: 45 * k(t, 2000, o.period ?? 6000, o.peak), valgusLeft: o.fault && t > 2000 + 1500 ? 0.06 : 0 }, { noisePx: 1, seed: Math.round(t), cy: 300 }),
  },
];

/** The person leaves the frame for `ms` starting `from` ms after the first repetition begins. */
export function withDropout(build: FrameBuilder, lead: number, from: number, ms: number): FrameBuilder {
  return (t) => (t > lead + from && t < lead + from + ms ? { image: null, aspect: 16 / 9 } : build(t));
}
