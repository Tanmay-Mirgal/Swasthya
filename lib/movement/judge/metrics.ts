/**
 * lib/movement/judge/metrics.ts
 *
 * Evaluates a template's named metrics from stabilised landmarks every frame. All
 * distances are body-relative (divided by torso, shoulder width, shin...), all 2D angles
 * are aspect-corrected, and a landmark that is not seen clearly makes the metric NaN
 * instead of a misleading number. Metrics with a `baseline` are measured against the
 * person's own starting position, captured during set-up.
 */
import { angle2D, angle3D, angleFromVertical, dist2D, mid, median } from "../geometry/geometry";
import { PoseLandmark, resolveRef, type LandmarkRef, type Side } from "../landmarks";
import type { LM } from "../types";
import type { MetricDef, MovementTemplate, ScaleRef } from "../template/schema";

/** A landmark seen less clearly than this is not used for measurement. */
const MIN_METRIC_VISIBILITY = 0.4;
/** Fewest frames before a baseline may be frozen. */
const MIN_BASELINE_SAMPLES = 8;
const BASELINE_WINDOW = 45;

export interface MetricFrame {
  pts: readonly LM[];
  world: readonly LM[] | null;
  aspect: number;
  active: Side;
}

const sideOfIndex = (idx: number): Side => (idx % 2 === 1 ? "left" : "right");

export class MetricEvaluator {
  readonly names: string[];
  readonly index = new Map<string, number>();
  /** Current values after baseline handling. NaN = could not be measured this frame. */
  readonly values: Float64Array;
  /** Values before baseline handling. */
  readonly raw: Float64Array;
  private readonly defs: MetricDef[];
  private readonly baselines: Float64Array;
  private readonly baselined: number[] = [];
  private readonly windows: number[][];
  private frame!: MetricFrame;
  baselineFrozen = false;

  constructor(template: MovementTemplate) {
    this.names = Object.keys(template.metrics);
    this.defs = this.names.map((n) => template.metrics[n]);
    this.names.forEach((n, i) => this.index.set(n, i));
    this.values = new Float64Array(this.names.length).fill(NaN);
    this.raw = new Float64Array(this.names.length).fill(NaN);
    this.baselines = new Float64Array(this.names.length).fill(NaN);
    this.windows = this.names.map(() => []);
    this.defs.forEach((d, i) => {
      if (d.baseline) this.baselined.push(i);
    });
  }

  get hasBaselines() {
    return this.baselined.length > 0;
  }

  resetBaseline() {
    this.baselines.fill(NaN);
    this.windows.forEach((w) => (w.length = 0));
    this.baselineFrozen = false;
  }

  /** Largest spread (max - min) of the recent raw values of any baselined metric. */
  baselineSpread(): number {
    let worst = 0;
    for (const i of this.baselined) {
      const w = this.windows[i];
      if (w.length < MIN_BASELINE_SAMPLES) return Infinity;
      worst = Math.max(worst, Math.max(...w) - Math.min(...w));
    }
    return worst;
  }

  freezeBaseline() {
    for (const i of this.baselined) this.baselines[i] = median(this.windows[i]);
    this.baselineFrozen = true;
  }

  evaluate(frame: MetricFrame, collecting: boolean) {
    this.frame = frame;
    for (let i = 0; i < this.defs.length; i++) {
      const raw = this.measure(this.defs[i]);
      this.raw[i] = raw;
      const mode = this.defs[i].baseline;
      if (!mode) {
        this.values[i] = this.defs[i].abs ? Math.abs(raw) : raw;
        continue;
      }
      if (!this.baselineFrozen) {
        if (collecting && Number.isFinite(raw)) {
          const w = this.windows[i];
          w.push(raw);
          if (w.length > BASELINE_WINDOW) w.shift();
        }
        const base = median(this.windows[i]);
        const v = Number.isFinite(raw) && Number.isFinite(base) ? (mode === "delta" ? raw - base : 1 - raw / base) : 0;
        this.values[i] = this.defs[i].abs ? Math.abs(v) : v;
      } else {
        const base = this.baselines[i];
        const v = Number.isFinite(raw) && Number.isFinite(base) && base !== 0 ? (mode === "delta" ? raw - base : 1 - raw / base) : NaN;
        this.values[i] = this.defs[i].abs ? Math.abs(v) : v;
      }
    }
  }

  get(name: string): number {
    const i = this.index.get(name);
    return i === undefined ? NaN : this.values[i];
  }

  // ── Measurement ──────────────────────────────────────────────────────────────

  private pt(ref: LandmarkRef): LM | undefined {
    const p = this.frame.pts[resolveRef(ref, this.frame.active)];
    return p && (p.visibility ?? 1) >= MIN_METRIC_VISIBILITY ? p : undefined;
  }

  private scale(kind: ScaleRef, anchorIndex: number): number {
    const { pts, aspect } = this.frame;
    const vis = (i: number) => (pts[i]?.visibility ?? 1) >= MIN_METRIC_VISIBILITY;
    let s = NaN;
    switch (kind) {
      case "none":
        return 1;
      case "torso": {
        const ids = [PoseLandmark.LEFT_SHOULDER, PoseLandmark.RIGHT_SHOULDER, PoseLandmark.LEFT_HIP, PoseLandmark.RIGHT_HIP];
        if (ids.every(vis)) s = dist2D(mid(pts[ids[0]], pts[ids[1]]), mid(pts[ids[2]], pts[ids[3]]), aspect);
        break;
      }
      case "shoulderWidth":
        if (vis(PoseLandmark.LEFT_SHOULDER) && vis(PoseLandmark.RIGHT_SHOULDER)) s = dist2D(pts[PoseLandmark.LEFT_SHOULDER], pts[PoseLandmark.RIGHT_SHOULDER], aspect);
        break;
      case "hipWidth":
        if (vis(PoseLandmark.LEFT_HIP) && vis(PoseLandmark.RIGHT_HIP)) s = dist2D(pts[PoseLandmark.LEFT_HIP], pts[PoseLandmark.RIGHT_HIP], aspect);
        break;
      case "shin":
      case "thigh": {
        const left = sideOfIndex(anchorIndex) === "left";
        const hip = left ? PoseLandmark.LEFT_HIP : PoseLandmark.RIGHT_HIP;
        const knee = left ? PoseLandmark.LEFT_KNEE : PoseLandmark.RIGHT_KNEE;
        const ankle = left ? PoseLandmark.LEFT_ANKLE : PoseLandmark.RIGHT_ANKLE;
        const [a, b] = kind === "shin" ? [knee, ankle] : [hip, knee];
        if (vis(a) && vis(b)) s = dist2D(pts[a], pts[b], aspect);
        break;
      }
    }
    return Number.isFinite(s) && s > 0.02 ? s : NaN;
  }

  private measure(d: MetricDef): number {
    const { aspect, active, world } = this.frame;
    switch (d.kind) {
      case "angle": {
        if (d.space === "world" && world) {
          const [a, b, c] = [d.a, d.b, d.c].map((r) => resolveRef(r, active));
          const ok = [a, b, c].every((i) => (this.frame.pts[i]?.visibility ?? 1) >= MIN_METRIC_VISIBILITY);
          return ok ? angle3D(world[a], world[b], world[c]) : NaN;
        }
        return angle2D(this.pt(d.a), this.pt(d.b), this.pt(d.c), aspect);
      }
      case "fromVertical":
        return angleFromVertical(this.pt(d.a), this.pt(d.b), aspect);
      case "offsetX": {
        const p = this.pt(d.point);
        const a = this.pt(d.ref1);
        const b = this.pt(d.ref2);
        const m = mid(a, b);
        const s = this.scale(d.scale, resolveRef(d.point, active));
        if (!p || !m || !Number.isFinite(s)) return NaN;
        return ((p.x - m.x) * aspect) / s;
      }
      case "offsetY": {
        const p = this.pt(d.point);
        const f = this.pt(d.from);
        const s = this.scale(d.scale, resolveRef(d.point, active));
        if (!p || !f || !Number.isFinite(s)) return NaN;
        return (p.y - f.y) / s;
      }
      case "distance": {
        const v = dist2D(this.pt(d.a), this.pt(d.b), aspect);
        const s = this.scale(d.scale, resolveRef(d.a, active));
        return Number.isFinite(v) && Number.isFinite(s) ? v / s : NaN;
      }
      case "lineOffsetInward": {
        const p = this.pt(d.point);
        const e1 = this.pt(d.end1);
        const e2 = this.pt(d.end2);
        const pi = resolveRef(d.point, active);
        const s = this.scale(d.scale, pi);
        if (!p || !e1 || !e2 || !Number.isFinite(s) || Math.abs(e2.y - e1.y) < 1e-6) return NaN;
        const t = (p.y - e1.y) / (e2.y - e1.y);
        const lineX = e1.x + t * (e2.x - e1.x);
        // Subject's left leg sits at larger image x; "inward" is toward smaller x. Mirrored for the right.
        const toward = sideOfIndex(pi) === "left" ? lineX - p.x : p.x - lineX;
        return (toward * aspect) / s;
      }
      case "verticalRatio": {
        const [a, b, c, e] = [d.a, d.b, d.c, d.d].map((r) => this.pt(r));
        if (!a || !b || !c || !e) return NaN;
        const den = Math.abs(e.y - c.y);
        return den < 0.02 ? NaN : Math.abs(b.y - a.y) / den;
      }
    }
  }
}
