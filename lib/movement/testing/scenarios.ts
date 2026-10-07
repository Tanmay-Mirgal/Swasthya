/**
 * lib/movement/testing/scenarios.ts
 *
 * Ready-made synthetic sessions shared by tests, the replay script and the design preview.
 */
import { MovementEngine } from "../judge/engine";
import { createCoachState, reduceCoach, type CoachState } from "../coach/coachState";
import { buildMovementUi, type MovementUi } from "../ui/movementUi";
import { getMovementTemplate } from "../template/registry";
import type { MovementTemplate } from "../template/schema";
import { lerp, repCurve, sideFrame, type FrameBuilder, type FrameOpts } from "./synth";

/** Hold the starting position this long before the first rep so set-up can complete. */
export const LEAD_MS = 1600;

export interface KneeSessionOptions {
  period?: number;
  peak?: number;
  /** Trunk lean in degrees as a function of time. */
  lean?: (t: number) => number;
  /** Per-landmark visibility overrides as a function of time. */
  vis?: (t: number) => Partial<Record<number, number>> | undefined;
  frame?: FrameOpts;
  seed?: number;
  near?: "left" | "right";
}

/** A seated knee-extension session: reps of `period` ms, each reaching `peak` (1 = full range). */
export function kneeExtensionSession(opts: KneeSessionOptions = {}): FrameBuilder {
  const period = opts.period ?? 4000;
  return (t: number) => {
    const tt = t - LEAD_MS;
    const k = tt < 0 ? 0 : repCurve(tt, period, opts.peak ?? 1);
    return sideFrame(
      { knee: lerp(92, 168, k), torsoTilt: opts.lean ? opts.lean(t) : 0, near: opts.near },
      { noisePx: 1.2, seed: (opts.seed ?? 1) * 1000 + Math.round(t), ...opts.frame, vis: opts.vis?.(t) }
    );
  };
}

/** One repetition of a seated knee extension: how far the leg goes (1 = full range) and whether the trunk leans during it. */
export interface RepPlan {
  peak: number;
  lean?: boolean;
}

/** A session made of repetitions that each go their own way. `period` ms per repetition. */
export function repPlanSession(plan: RepPlan[], period = 4000): FrameBuilder {
  return (t: number) => {
    const tt = t - LEAD_MS;
    const idx = tt < 0 ? 0 : Math.min(plan.length - 1, Math.floor(tt / period));
    const p = plan[idx];
    const k = tt < 0 ? 0 : repCurve(tt, period, p.peak);
    const leaning = Boolean(p.lean) && tt >= 0 && Math.floor(tt / period) === idx;
    return sideFrame({ knee: lerp(92, 168, k), torsoTilt: leaning ? 28 : 0 }, { noisePx: 1.2, seed: Math.round(t) });
  };
}

/** Good, good, flagged (leaning), good, short, good: with 8 prescribed, the main count is 4 / 8, never 6 / 8. */
export const MIXED_PLAN: RepPlan[] = [{ peak: 1 }, { peak: 1 }, { peak: 1, lean: true }, { peak: 1 }, { peak: 0.55 }, { peak: 1 }];

/** A patient who gets close to the range every time but never reaches it. */
export const STUCK_PLAN: RepPlan[] = Array.from({ length: 8 }, () => ({ peak: 0.55 }));

export interface Replay {
  engine: MovementEngine;
  coach: CoachState;
  ui: MovementUi;
  template: MovementTemplate;
}

/** Runs a builder through the real engine and coach up to `untilMs`, returning the final screen state. */
export function replayUntil(templateId: string, builder: FrameBuilder, untilMs: number, targetReps = 10): Replay {
  const template = getMovementTemplate(templateId)!;
  const engine = new MovementEngine(template, { targetReps });
  let coach = createCoachState(template);
  const repFlags: boolean[] = [];
  let rom = 0;
  let lastRepMs = 0;
  let nextTick = 500;
  for (let t = 0; t <= untilMs; t += 1000 / 30) {
    const f = builder(t);
    const res = engine.process({ t, image: f.image, world: f.world ?? null, aspect: f.aspect });
    for (const e of res.events) {
      if (e.type === "rep_completed") {
        repFlags.push(e.valid);
        rom = Math.max(rom, e.rom);
        lastRepMs = e.durationMs;
      }
      coach = reduceCoach(coach, e, template, { llmEnabled: false }).state;
    }
    if (t >= nextTick) {
      nextTick += 500;
      coach = reduceCoach(coach, { type: "tick", t }, template, { llmEnabled: false }).state;
    }
  }
  const ui = buildMovementUi(engine.result, coach, template, { status: "running", rom, lastRepMs, repFlags, fps: 30 });
  return { engine, coach, ui, template };
}
