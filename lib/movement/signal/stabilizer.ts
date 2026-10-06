/**
 * lib/movement/signal/stabilizer.ts
 *
 * Landmark stabilisation with a One Euro filter (Casiez et al.): heavy smoothing while a
 * joint is nearly still (kills MediaPipe jitter) and almost none while it moves fast (so
 * there is no visible lag). Unlike a fixed-alpha average it is frame-rate independent
 * because it works from real timestamps.
 *
 * Visibility is smoothed separately with a short moving average. Storage is flat typed
 * arrays so nothing is allocated per frame.
 */
import { LANDMARK_COUNT } from "../landmarks";
import type { LM } from "../types";

export interface StabilizerOptions {
  /** Cutoff (Hz) while still. Lower = smoother. */
  minCutoff: number;
  /** Speed coefficient. Higher = less smoothing while moving. */
  beta: number;
  /** Cutoff (Hz) for the derivative estimate. */
  dCutoff: number;
  /** Gap (ms) after which the filter forgets the last pose (person left and came back). */
  resetGapMs: number;
}

export const DEFAULT_STABILIZER: StabilizerOptions = { minCutoff: 1.4, beta: 6, dCutoff: 1, resetGapMs: 600 };

const alpha = (cutoffHz: number, dtSec: number) => {
  const tau = 1 / (2 * Math.PI * cutoffHz);
  return 1 / (1 + tau / dtSec);
};

/** Stable output arrays, reused every frame. x, y, z interleaved per landmark; vis separate. */
export class LandmarkStabilizer {
  readonly xyz = new Float32Array(LANDMARK_COUNT * 3);
  readonly vis = new Float32Array(LANDMARK_COUNT);
  /**
   * Unfiltered image landmarks exactly as MediaPipe returned them this frame. The overlay draws
   * these: a filter always trails the body while it moves (20-45 px at 1280 wide), and a
   * skeleton that trails the body looks mis-plotted. The filtered `xyz` is for measuring only.
   */
  readonly raw = new Float32Array(LANDMARK_COUNT * 3);
  /** Stable landmarks as objects for geometry code. Mutated in place each frame. */
  readonly points: LM[] = Array.from({ length: LANDMARK_COUNT }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }));
  readonly world: LM[] = Array.from({ length: LANDMARK_COUNT }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }));
  hasWorld = false;

  private readonly dx = new Float32Array(LANDMARK_COUNT * 3);
  private readonly wxyz = new Float32Array(LANDMARK_COUNT * 3);
  private readonly wdx = new Float32Array(LANDMARK_COUNT * 3);
  private lastT = -1;
  private primed = false;
  private worldPrimed = false;
  private opts: StabilizerOptions;

  constructor(opts: Partial<StabilizerOptions> = {}) {
    this.opts = { ...DEFAULT_STABILIZER, ...opts };
  }

  reset() {
    this.primed = false;
    this.worldPrimed = false;
    this.hasWorld = false;
    this.lastT = -1;
  }

  /** Feeds one frame. Returns false (and resets) when no pose was found. */
  update(t: number, image: readonly LM[] | null, world?: readonly LM[] | null): boolean {
    if (!image || image.length < LANDMARK_COUNT) {
      this.reset();
      return false;
    }
    if (this.lastT >= 0 && t - this.lastT > this.opts.resetGapMs) {
      this.primed = false;
      this.worldPrimed = false;
    }
    const dt = this.lastT >= 0 ? Math.max((t - this.lastT) / 1000, 0.001) : 0.033;
    this.lastT = t;
    const { minCutoff, beta, dCutoff } = this.opts;
    const aD = alpha(dCutoff, dt);

    for (let i = 0; i < LANDMARK_COUNT; i++) {
      const lm = image[i];
      const o = i * 3;
      const vis = lm.visibility ?? 1;
      this.raw[o] = lm.x;
      this.raw[o + 1] = lm.y;
      this.raw[o + 2] = lm.z;
      if (!this.primed) {
        this.xyz[o] = lm.x;
        this.xyz[o + 1] = lm.y;
        this.xyz[o + 2] = lm.z;
        this.dx[o] = this.dx[o + 1] = this.dx[o + 2] = 0;
        this.vis[i] = vis;
      } else {
        for (let k = 0; k < 3; k++) {
          const raw = k === 0 ? lm.x : k === 1 ? lm.y : lm.z;
          const prev = this.xyz[o + k];
          const speed = (raw - prev) / dt;
          const dHat = this.dx[o + k] + aD * (speed - this.dx[o + k]);
          this.dx[o + k] = dHat;
          const cutoff = minCutoff + beta * Math.abs(dHat);
          this.xyz[o + k] = prev + alpha(cutoff, dt) * (raw - prev);
        }
        this.vis[i] += 0.5 * (vis - this.vis[i]);
      }
      const p = this.points[i];
      p.x = this.xyz[o];
      p.y = this.xyz[o + 1];
      p.z = this.xyz[o + 2];
      p.visibility = this.vis[i];
    }
    this.primed = true;

    this.hasWorld = Boolean(world && world.length >= LANDMARK_COUNT);
    if (this.hasWorld && world) {
      for (let i = 0; i < LANDMARK_COUNT; i++) {
        const lm = world[i];
        const o = i * 3;
        if (!this.worldPrimed) {
          this.wxyz[o] = lm.x;
          this.wxyz[o + 1] = lm.y;
          this.wxyz[o + 2] = lm.z;
          this.wdx[o] = this.wdx[o + 1] = this.wdx[o + 2] = 0;
        } else {
          for (let k = 0; k < 3; k++) {
            const raw = k === 0 ? lm.x : k === 1 ? lm.y : lm.z;
            const prev = this.wxyz[o + k];
            const speed = (raw - prev) / dt;
            const dHat = this.wdx[o + k] + aD * (speed - this.wdx[o + k]);
            this.wdx[o + k] = dHat;
            // World units are metres, ~3x larger than image units for the same motion: scale beta.
            const cutoff = minCutoff + (beta / 3) * Math.abs(dHat);
            this.wxyz[o + k] = prev + alpha(cutoff, dt) * (raw - prev);
          }
        }
        const p = this.world[i];
        p.x = this.wxyz[o];
        p.y = this.wxyz[o + 1];
        p.z = this.wxyz[o + 2];
        p.visibility = this.vis[i];
      }
      this.worldPrimed = true;
    }
    return true;
  }
}
