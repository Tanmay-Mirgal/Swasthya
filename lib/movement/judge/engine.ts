/**
 * lib/movement/judge/engine.ts
 *
 * The deterministic movement engine. One instance judges one exercise (one template) for
 * one stretch of work (a set, or a chunk of a set). Per frame it:
 *
 *   stabilise → confidence → camera advice → measure → phase machine → rules → events
 *
 * It is pure with respect to time (the caller supplies timestamps) and allocation-light:
 * the result object, joint-state array and landmark arrays are reused every frame. It
 * never calls the network, never reads a clock, and never imports React. Anything a coach
 * or a language model learns about the movement arrives as a MovementEvent from here.
 *
 * Judgment rules, in order of precedence:
 *   1. Confidence LOW  → nothing is judged: no rep, no error, no red; joints go yellow.
 *   2. Set-up not yet held → nothing is counted.
 *   3. Errors need to be sustained (sustainMs) and only count in the phases they name.
 */
import { LANDMARK_COUNT, resolveRef, describeRef, type LandmarkRef, type Side, opposite } from "../landmarks";
import { LandmarkStabilizer, type StabilizerOptions } from "../signal/stabilizer";
import { ConfidenceTracker, type ConfidenceReading } from "../signal/confidence";
import { CameraAdvisor, rawCameraAdvice, type RequiredJoint } from "../framing/cameraCheck";
import { MetricEvaluator } from "./metrics";
import type { ContinuousRule, MovementTemplate, RepRules } from "../template/schema";
import {
  JOINT_ERROR,
  JOINT_NEUTRAL,
  JOINT_OK,
  JOINT_UNCERTAIN,
  type ActiveDeviation,
  type CameraAdvice,
  type ConfidenceLevel,
  type MovementEvent,
  type Phase,
  type RawFrame,
  type RepRecord,
  type Severity,
} from "../types";

const EMPTY_EVENTS: readonly MovementEvent[] = Object.freeze([]);
const SEVERITY_RANK: Record<Severity, number> = { minor: 0, moderate: 1, major: 2 };
/** How long a one-shot (per-rep) problem stays red on screen. */
const ONE_SHOT_DISPLAY_MS = 1800;
/** Tracking lost for this long mid-rep abandons the rep without counting it. */
const DROPOUT_ABANDON_MS = 2000;
/** A rule that is active when its phase ends is released after this long, without an acknowledgement. */
const OUT_OF_PHASE_GRACE_MS = 500;

export interface FrameResult {
  t: number;
  tracking: boolean;
  confidence: ConfidenceLevel;
  /** Mean visibility of the joints this exercise needs, 0..1. */
  confidenceScore: number;
  advice: CameraAdvice | null;
  phase: Phase;
  /** 0..1 progress of holding the starting position while phase is "setup". */
  setupProgress: number;
  side: Side;
  /** Current value of the primary metric in display units (degrees or percent). NaN when unmeasurable. */
  primary: number;
  /** Per-landmark colour state (JOINT_*), length 33. Reused every frame. */
  joints: Uint8Array;
  /** Segments to draw red, as [a, b] landmark index pairs. Reused. */
  redSegments: [number, number][];
  /** Stabilised landmark coordinates (for measuring, not drawing): x, y, z interleaved. Live views, do not retain. */
  xyz: Float32Array;
  /** Raw MediaPipe landmarks this frame, same layout. This is what the overlay draws, so it never trails the body. */
  raw: Float32Array;
  vis: Float32Array;
  active: ActiveDeviation[];
  counted: number;
  valid: number;
  invalid: number;
  partial: number;
  targetReps: number;
  /** True once `targetReps` have been counted. */
  done: boolean;
  /** Events raised by this frame. A shared empty array when there are none. */
  events: readonly MovementEvent[];
}

export interface ChunkSummary {
  counted: number;
  valid: number;
  invalid: number;
  partial: number;
  /** Best range of motion in any counted rep, display units. */
  rom: number;
  romAverage: number;
  avgConfidence: number;
  lowConfidenceMs: number;
  trackedMs: number;
  /** Reps affected by each error code (UPPER_SNAKE), with the worst severity seen. */
  errors: Record<string, { count: number; severity: Severity }>;
  corrections: { attempted: number; succeeded: number };
  reps: RepRecord[];
}

interface RuleState {
  rule: ContinuousRule;
  metricIndex: number;
  outSince: number;
  inSince: number;
  outOfPhaseSince: number;
  active: ActiveDeviation | null;
  direction: "low" | "high";
}

interface OneShot {
  id: string;
  rule: RepRules[keyof RepRules] & object;
  until: number;
  deviation: ActiveDeviation;
}

export interface EngineOptions {
  targetReps: number;
  stabilizer?: Partial<StabilizerOptions>;
}

export class MovementEngine {
  readonly template: MovementTemplate;
  readonly result: FrameResult;

  private readonly stab: LandmarkStabilizer;
  private readonly conf = new ConfidenceTracker();
  private readonly advisor = new CameraAdvisor();
  private readonly metrics: MetricEvaluator;
  private readonly rules: RuleState[];
  private readonly primaryIndex: number;
  private readonly sign: 1 | -1;
  private readonly scale: number;

  private side: Side = "left";
  private sideCandidate: Side | null = null;
  private sideSince = 0;
  private required: RequiredJoint[] = [];
  private requiredIdx: number[] = [];
  private relevant = new Set<number>();
  private relevantSide: Side | null = null;

  private phase: Phase = "setup";
  private setupSince = -1;
  private lowSince = -1;
  private lastT = -1;
  private events: MovementEvent[] = [];

  // repetition tracking
  private counted = 0;
  private valid = 0;
  private invalid = 0;
  private partial = 0;
  private targetReps: number;
  /** Lowest value (in direction space) seen while at rest: the start of the range for ROM. */
  private restMinU = Infinity;
  private extreme = -Infinity;
  private backMin = Infinity;
  private repStart = 0;
  private lastCountedT = -Infinity;
  private peakEnteredT = -1;
  private peakHeldMs = 0;
  private backSince = -1;
  private reachedPeak = false;
  private inRep = false;
  private touched = new Set<string>();
  private oneShots = new Map<string, OneShot>();
  private openOneShots = new Set<string>();

  // chunk accounting
  private errors = new Map<string, { count: number; severity: Severity }>();
  private repRecords: RepRecord[] = [];
  private romSum = 0;
  private romBest = 0;
  private confSum = 0;
  private confN = 0;
  private lowMs = 0;
  private trackedMs = 0;
  private attempted = 0;
  private succeeded = 0;

  constructor(template: MovementTemplate, opts: EngineOptions) {
    this.template = template;
    this.targetReps = opts.targetReps;
    this.stab = new LandmarkStabilizer(opts.stabilizer);
    this.metrics = new MetricEvaluator(template);
    this.primaryIndex = this.metrics.index.get(template.rep.metric) ?? 0;
    this.sign = template.rep.direction === "increase" ? 1 : -1;
    this.scale = template.rep.displayScale ?? 1;
    this.rules = template.rules.map((rule) => ({
      rule,
      metricIndex: this.metrics.index.get(rule.metric) ?? 0,
      outSince: -1,
      inSince: -1,
      outOfPhaseSince: -1,
      active: null,
      direction: "low",
    }));
    this.result = {
      t: 0,
      tracking: false,
      confidence: "LOW",
      confidenceScore: 0,
      advice: null,
      phase: "setup",
      setupProgress: 0,
      side: "left",
      primary: NaN,
      joints: new Uint8Array(LANDMARK_COUNT).fill(JOINT_NEUTRAL),
      redSegments: [],
      xyz: this.stab.xyz,
      raw: this.stab.raw,
      vis: this.stab.vis,
      active: [],
      counted: 0,
      valid: 0,
      invalid: 0,
      partial: 0,
      targetReps: opts.targetReps,
      done: false,
      events: EMPTY_EVENTS,
    };
    if (template.sideMode !== "auto") this.side = template.sideMode;
    this.resolveRequired();
  }

  // ── Public ───────────────────────────────────────────────────────────────────

  /** Starts a new stretch of work (next set or chunk). Keeps the camera model and baseline. */
  reset(targetReps: number) {
    this.targetReps = targetReps;
    this.counted = this.valid = this.invalid = this.partial = 0;
    this.errors.clear();
    this.repRecords = [];
    this.romSum = this.romBest = 0;
    this.confSum = this.confN = 0;
    this.lowMs = this.trackedMs = 0;
    this.attempted = this.succeeded = 0;
    this.abortRep();
    this.clearRules(false);
    this.oneShots.clear();
    this.openOneShots.clear();
    this.phase = "setup";
    this.setupSince = -1;
    this.lastCountedT = -Infinity;
  }

  getSummary(): ChunkSummary {
    const errors: ChunkSummary["errors"] = {};
    for (const [code, v] of this.errors) errors[code.toUpperCase()] = { ...v };
    return {
      counted: this.counted,
      valid: this.valid,
      invalid: this.invalid,
      partial: this.partial,
      rom: Math.round(this.romBest),
      romAverage: this.counted ? Math.round(this.romSum / this.counted) : 0,
      avgConfidence: this.confN ? Math.round((this.confSum / this.confN) * 100) / 100 : 0,
      lowConfidenceMs: Math.round(this.lowMs),
      trackedMs: Math.round(this.trackedMs),
      errors,
      corrections: { attempted: this.attempted, succeeded: this.succeeded },
      reps: this.repRecords.slice(),
    };
  }

  get activeSide(): Side {
    return this.side;
  }

  /** Describes a joint reference using the current active side, e.g. "left knee". */
  describe(ref: LandmarkRef): string {
    return describeRef(ref, this.side);
  }

  // ── Frame ────────────────────────────────────────────────────────────────────

  process(frame: RawFrame): FrameResult {
    const res = this.result;
    const t = frame.t;
    const dt = this.lastT >= 0 ? Math.min(Math.max(t - this.lastT, 0), 500) : 0;
    this.lastT = t;
    this.events = [];

    const tracking = this.stab.update(t, frame.image, frame.world);
    res.t = t;
    res.tracking = tracking;

    if (!tracking) {
      this.onNoPerson(t, dt);
      return this.finish(res, null);
    }

    this.chooseSide(t);
    const reading = this.conf.update(t, this.stab.points, this.requiredIdx);
    res.confidence = reading.level;
    res.confidenceScore = reading.score;

    const raw = rawCameraAdvice(this.template.camera, {
      points: this.stab.points,
      aspect: frame.aspect,
      required: this.required,
      weak: reading.weak,
      cutOff: reading.cutOff,
      segmentWord: this.template.camera.segmentWord,
    });
    if (this.advisor.update(t, raw)) {
      this.events.push(this.advisor.current ? { type: "camera_issue", t, advice: this.advisor.current } : { type: "camera_ok", t });
    }
    res.advice = this.advisor.current;

    if (reading.level === "LOW") {
      this.onLowConfidence(t, dt);
      return this.finish(res, reading);
    }
    this.lowSince = -1;
    this.confSum += reading.score;
    this.confN++;
    this.trackedMs += dt;

    this.metrics.evaluate({ pts: this.stab.points, world: this.stab.hasWorld ? this.stab.world : null, aspect: frame.aspect, active: this.side }, this.phase === "setup");
    const value = this.metrics.values[this.primaryIndex];
    res.primary = Number.isFinite(value) ? value * this.scale : NaN;

    if (this.phase === "setup") this.stepSetup(t, value);
    else if (Number.isFinite(value)) this.stepRep(t, value, reading);

    this.stepRules(t, reading);
    this.expireOneShots(t);
    return this.finish(res, reading);
  }

  // ── Side, landmarks ──────────────────────────────────────────────────────────

  private resolveRequired() {
    const refs = this.template.landmarks.required;
    this.required = refs.map((r) => ({ index: resolveRef(r, this.side), name: describeRef(r, this.side) }));
    this.requiredIdx = this.required.map((r) => r.index);
    const rel = new Set<number>(this.requiredIdx);
    for (const r of this.template.landmarks.optional) rel.add(resolveRef(r, this.side));
    for (const j of this.template.statusJoints) rel.add(resolveRef(j.ref, this.side));
    for (const rule of this.template.rules) for (const r of rule.landmarks) rel.add(resolveRef(r, this.side));
    this.relevant = rel;
    this.relevantSide = this.side;
  }

  /** Picks the better-seen side, with hysteresis, and never switches while a rep is in progress. */
  private chooseSide(t: number) {
    if (this.template.sideMode !== "auto") return;
    const score = (side: Side) => {
      let sum = 0;
      for (const r of this.template.landmarks.required) sum += this.stab.vis[resolveRef(r, side)];
      return sum / Math.max(1, this.template.landmarks.required.length);
    };
    const mine = score(this.side);
    const other = score(opposite(this.side));
    const margin = this.phase === "setup" ? 0.03 : 0.12;
    if (this.inRep || other <= mine + margin) {
      this.sideCandidate = null;
      return;
    }
    if (this.sideCandidate !== opposite(this.side)) {
      this.sideCandidate = opposite(this.side);
      this.sideSince = t;
    }
    if (this.phase === "setup" || t - this.sideSince >= 700) {
      this.side = opposite(this.side);
      this.sideCandidate = null;
      this.resolveRequired();
      this.metrics.resetBaseline();
    }
  }

  // ── Tracking lost / low confidence ───────────────────────────────────────────

  private onNoPerson(t: number, dt: number) {
    const res = this.result;
    res.confidence = "LOW";
    res.confidenceScore = 0;
    this.conf.reset();
    if (this.advisor.update(t, rawCameraAdvice(this.template.camera, { points: null, aspect: 1, required: this.required, weak: [], cutOff: [], segmentWord: this.template.camera.segmentWord }))) {
      this.events.push(this.advisor.current ? { type: "camera_issue", t, advice: this.advisor.current } : { type: "camera_ok", t });
    }
    res.advice = this.advisor.current;
    res.primary = NaN;
    this.onLowConfidence(t, dt, true);
  }

  private onLowConfidence(t: number, dt: number, none = false) {
    this.lowMs += dt;
    if (this.lowSince < 0) this.lowSince = t;
    // Nothing is judged while the camera cannot see: freeze timers, drop pending detections.
    for (const rs of this.rules) {
      rs.outSince = -1;
      rs.inSince = -1;
    }
    if (this.inRep && t - this.lowSince >= DROPOUT_ABANDON_MS) {
      this.abortRep();
      this.setPhase(t, "setup");
      this.setupSince = -1;
    }
    if (none && this.phase === "setup") this.setupSince = -1;
    if (!none && this.phase === "setup") this.setupSince = -1;
  }

  // ── Set-up ───────────────────────────────────────────────────────────────────

  private inRestZone(value: number): boolean {
    const r = this.template.rep;
    return this.sign * value <= this.sign * r.restThreshold;
  }

  private stepSetup(t: number, value: number) {
    const tpl = this.template;
    const res = this.result;
    let ok = this.baselineMetricInRest(value);
    for (const c of tpl.setup.conditions ?? []) {
      const v = this.metrics.get(c.metric);
      if (!Number.isFinite(v) || (c.min !== undefined && v < c.min) || (c.max !== undefined && v > c.max)) ok = false;
    }
    if (ok && this.metrics.hasBaselines && !this.metrics.baselineFrozen) {
      if (this.metrics.baselineSpread() > (tpl.setup.stableWithin ?? Infinity)) ok = false;
    }
    if (!ok) {
      this.setupSince = -1;
      res.setupProgress = 0;
      return;
    }
    if (this.setupSince < 0) this.setupSince = t;
    const held = t - this.setupSince;
    res.setupProgress = Math.min(1, held / tpl.setup.holdMs);
    if (held >= tpl.setup.holdMs) {
      if (this.metrics.hasBaselines && !this.metrics.baselineFrozen) this.metrics.freezeBaseline();
      this.restMinU = this.sign * value;
      this.setPhase(t, "rest");
      this.events.push({ type: "setup_ready", t });
    }
  }

  /** For a baselined primary metric the starting position is, by definition, the baseline. */
  private baselineMetricInRest(value: number): boolean {
    if (!Number.isFinite(value)) return false;
    if (this.template.metrics[this.template.rep.metric].baseline && !this.metrics.baselineFrozen) return true;
    return this.inRestZone(value);
  }

  // ── Repetition state machine ─────────────────────────────────────────────────

  private setPhase(t: number, phase: Phase) {
    if (this.phase === phase) return;
    this.phase = phase;
    this.events.push({ type: "phase_changed", t, phase, rep: this.counted });
  }

  private abortRep() {
    this.inRep = false;
    this.extreme = -Infinity;
    this.backMin = Infinity;
    this.reachedPeak = false;
    this.peakEnteredT = -1;
    this.peakHeldMs = 0;
    this.backSince = -1;
    this.touched.clear();
  }

  private stepRep(t: number, value: number, reading: ConfidenceReading) {
    const r = this.template.rep;
    const s = this.sign;
    const u = s * value;
    const uRest = s * r.restThreshold;
    const uLeave = s * r.leaveThreshold;
    const uPeak = s * r.peakThreshold;
    const uCount = s * r.countThreshold;
    const done = this.counted >= this.targetReps;

    switch (this.phase) {
      case "rest": {
        if (u < this.restMinU) this.restMinU = u;
        if (u >= uLeave && !done) {
          this.inRep = true;
          this.repStart = t;
          this.extreme = u;
          this.reachedPeak = false;
          this.peakHeldMs = 0;
          this.touched.clear();
          for (const rs of this.rules) if (rs.active) this.touched.add(rs.rule.id);
          this.setPhase(t, "out");
        }
        break;
      }
      case "out": {
        if (u > this.extreme) this.extreme = u;
        if (u >= uPeak) {
          this.reachedPeak = true;
          this.peakEnteredT = t;
          this.setPhase(t, "peak");
        } else if (u <= uRest) {
          this.finishRep(t, reading);
        } else if (u <= this.extreme - r.returnDrop && this.extreme >= uLeave + r.returnDrop) {
          this.turnaround(t, reading);
        } else if (t - this.repStart > r.abandonMs) {
          this.abandon(t);
        }
        break;
      }
      case "peak": {
        if (u > this.extreme) this.extreme = u;
        this.peakHeldMs = t - this.peakEnteredT;
        if (u < uPeak - r.returnDrop) {
          this.turnaround(t, reading);
        } else if (t - this.repStart > r.abandonMs) {
          this.abandon(t);
        }
        break;
      }
      case "back": {
        if (u < this.backMin) this.backMin = u;
        if (u <= uRest) {
          this.finishRep(t, reading);
        } else if (u >= this.backMin + r.returnDrop && u >= uCount) {
          this.setPhase(t, "out"); // re-ascent: the same rep continues
        } else {
          if (this.backSince >= 0 && t - this.backSince > r.returnStallMs) this.raiseOneShot(t, "incompleteReturn", reading, value);
          if (t - this.repStart > r.abandonMs) this.abandon(t);
        }
        break;
      }
      default:
        break;
    }
  }

  /** The movement has stopped heading out and is now heading back. */
  private turnaround(t: number, reading: ConfidenceReading) {
    const r = this.template.rep;
    this.backMin = this.sign * this.metrics.values[this.primaryIndex];
    this.backSince = t;
    if (this.extreme < this.sign * r.peakThreshold) this.raiseOneShot(t, "range", reading, this.extreme / this.sign);
    this.setPhase(t, "back");
  }

  private abandon(t: number) {
    this.abortRep();
    this.setPhase(t, "setup");
    this.setupSince = -1;
  }

  private finishRep(t: number, reading: ConfidenceReading) {
    const r = this.template.rep;
    const durationMs = t - this.repStart;
    const extremeRaw = this.extreme / this.sign;
    const romValue = Math.max(0, this.extreme - this.restMinU) * this.scale;
    const reachedCount = this.extreme >= this.sign * r.countThreshold;
    const gapOk = t - this.lastCountedT >= r.debounceMs;

    if (!reachedCount || !gapOk) {
      if (!reachedCount && this.extreme >= this.sign * r.leaveThreshold + r.returnDrop) {
        this.partial++;
        const span = this.sign * r.peakThreshold - this.sign * r.restThreshold;
        const reached = span > 0 ? Math.max(0, Math.min(1, (this.extreme - this.sign * r.restThreshold) / span)) : 0;
        this.raiseOneShot(t, "range", reading, extremeRaw);
        this.events.push({ type: "partial_rep", t, reached });
      }
      this.abortRep();
      this.enterRest(t);
      return;
    }

    // Per-rep rules that are only known now.
    const reasons: string[] = [];
    if (!this.reachedPeak && this.repRulesOf("range")) {
      this.touched.add(this.template.repRules.range.id);
      if (this.template.repRules.range.invalidatesRep) reasons.push(this.template.repRules.range.id);
    } else if (this.openOneShots.has("range")) {
      this.acknowledge(t, "range");
    }
    if (durationMs < r.minRepMs && this.template.repRules.tooFast) {
      this.raiseOneShot(t, "tooFast", reading, durationMs / 1000);
      if (this.template.repRules.tooFast.invalidatesRep) reasons.push(this.template.repRules.tooFast.id);
    } else if (this.openOneShots.has("tooFast")) this.acknowledge(t, "tooFast");
    if (r.maxRepMs && durationMs > r.maxRepMs && this.template.repRules.tooSlow) {
      this.raiseOneShot(t, "tooSlow", reading, durationMs / 1000);
      if (this.template.repRules.tooSlow.invalidatesRep) reasons.push(this.template.repRules.tooSlow.id);
    } else if (this.openOneShots.has("tooSlow")) this.acknowledge(t, "tooSlow");
    if (r.minPeakHoldMs && this.reachedPeak && this.peakHeldMs < r.minPeakHoldMs && this.template.repRules.shortHold) {
      this.raiseOneShot(t, "shortHold", reading, this.peakHeldMs / 1000);
      if (this.template.repRules.shortHold.invalidatesRep) reasons.push(this.template.repRules.shortHold.id);
    } else if (this.openOneShots.has("shortHold")) this.acknowledge(t, "shortHold");
    if (this.openOneShots.has("incompleteReturn")) this.acknowledge(t, "incompleteReturn");

    for (const rs of this.rules) if (rs.active) this.touched.add(rs.rule.id);
    for (const rs of this.rules) if (this.touched.has(rs.rule.id) && rs.rule.invalidatesRep && !reasons.includes(rs.rule.id)) reasons.push(rs.rule.id);

    const valid = reasons.length === 0;
    this.counted++;
    if (valid) this.valid++;
    else this.invalid++;
    this.lastCountedT = t;
    this.romSum += romValue;
    this.romBest = Math.max(this.romBest, romValue);

    const errors = [...this.touched];
    for (const code of errors) this.bumpError(code);
    this.repRecords.push({
      n: this.counted,
      valid,
      reasons: reasons.map((c) => c.toUpperCase()),
      errors: errors.map((c) => c.toUpperCase()),
      rom: Math.round(romValue),
      durationMs: Math.round(durationMs),
      confidence: Math.round(reading.score * 100) / 100,
    });
    this.events.push({ type: "rep_completed", t, rep: this.counted, valid, reasons: reasons.slice(), rom: Math.round(romValue), durationMs: Math.round(durationMs), confidence: reading.score });
    this.abortRep();
    this.enterRest(t);
  }

  private enterRest(t: number) {
    this.restMinU = this.sign * this.metrics.values[this.primaryIndex];
    this.setPhase(t, "rest");
  }

  private repRulesOf(key: "range") {
    return this.template.repRules[key];
  }

  private bumpError(code: string) {
    const sev = this.severityOf(code);
    const cur = this.errors.get(code);
    if (cur) {
      cur.count++;
      if (SEVERITY_RANK[sev] > SEVERITY_RANK[cur.severity]) cur.severity = sev;
    } else this.errors.set(code, { count: 1, severity: sev });
  }

  private severityOf(code: string): Severity {
    const cont = this.template.rules.find((r) => r.id === code);
    if (cont) return cont.severity;
    for (const r of Object.values(this.template.repRules)) if (r && r.id === code) return r.severity;
    return "minor";
  }

  // ── One-shot (per-rep) deviations ────────────────────────────────────────────

  private raiseOneShot(t: number, key: keyof RepRules, reading: ConfidenceReading, measured: number) {
    const rule = this.template.repRules[key];
    if (!rule) return;
    const existing = this.oneShots.get(key);
    const r = this.template.rep;
    const expected = key === "range" ? r.peakThreshold : key === "tooFast" ? r.minRepMs / 1000 : key === "tooSlow" ? (r.maxRepMs ?? 0) / 1000 : key === "shortHold" ? (r.minPeakHoldMs ?? 0) / 1000 : r.restThreshold;
    const direction: "low" | "high" = key === "range" ? (this.sign === 1 ? "low" : "high") : key === "tooSlow" || key === "incompleteReturn" ? "high" : "low";
    if (existing) {
      existing.until = t + ONE_SHOT_DISPLAY_MS;
      existing.deviation.measured = measured * (key === "range" ? this.scale : 1);
      return;
    }
    const deviation: ActiveDeviation = { error: rule.id.toUpperCase(), joint: this.describe(rule.landmarks[0]), severity: rule.severity, direction, measured: measured * (key === "range" ? this.scale : 1), expected: expected * (key === "range" ? this.scale : 1), sinceMs: t };
    this.oneShots.set(key, { id: key, rule, until: t + ONE_SHOT_DISPLAY_MS, deviation });
    this.openOneShots.add(key);
    this.attempted++;
    this.touched.add(rule.id);
    this.events.push({
      type: "movement_error",
      t,
      exercise: this.template.id,
      phase: this.phase,
      joint: deviation.joint,
      error: rule.id,
      severity: rule.severity,
      direction,
      measured: deviation.measured,
      expected: deviation.expected,
      confidence: reading.score,
      rep: this.counted + 1,
      oneShot: true,
    });
  }

  private acknowledge(t: number, key: string) {
    const rule = (this.template.repRules as unknown as Record<string, { id: string; landmarks: LandmarkRef[] } | undefined>)[key];
    this.openOneShots.delete(key);
    if (!rule) return;
    this.succeeded++;
    this.events.push({ type: "movement_corrected", t, error: rule.id, joint: this.describe(rule.landmarks[0]), afterMs: 0, rep: this.counted + 1 });
  }

  private expireOneShots(t: number) {
    for (const [key, o] of this.oneShots) if (t >= o.until) this.oneShots.delete(key);
  }

  // ── Continuous rules ─────────────────────────────────────────────────────────

  private clearRules(emit: boolean, t = 0) {
    for (const rs of this.rules) {
      if (rs.active && emit) {
        this.events.push({ type: "movement_corrected", t, error: rs.rule.id, joint: rs.active.joint, afterMs: t - rs.active.sinceMs, rep: this.counted + 1 });
      }
      rs.active = null;
      rs.outSince = rs.inSince = rs.outOfPhaseSince = -1;
    }
    this.result.active.length = 0;
  }

  private stepRules(t: number, reading: ConfidenceReading) {
    if (this.phase === "setup") {
      if (this.result.active.length) this.clearRules(false);
      return;
    }
    for (const rs of this.rules) {
      const { rule } = rs;
      const inPhase = rule.phases.includes(this.phase);
      if (!inPhase) {
        rs.outSince = -1;
        if (rs.active) {
          if (rs.outOfPhaseSince < 0) rs.outOfPhaseSince = t;
          if (t - rs.outOfPhaseSince >= OUT_OF_PHASE_GRACE_MS) this.deactivate(rs, t, false);
        }
        continue;
      }
      rs.outOfPhaseSince = -1;
      const v = this.metrics.values[rs.metricIndex];
      if (!Number.isFinite(v)) continue;

      const wasActive = rs.active !== null;
      const lowTrip = rule.min !== undefined && v < (wasActive && rs.direction === "low" ? rule.min + rule.release : rule.min);
      const highTrip = rule.max !== undefined && v > (wasActive && rs.direction === "high" ? rule.max - rule.release : rule.max);
      const violating = lowTrip || highTrip;

      if (violating) {
        rs.inSince = -1;
        if (!wasActive) {
          rs.direction = lowTrip ? "low" : "high";
          if (rs.outSince < 0) rs.outSince = t;
          if (t - rs.outSince >= rule.sustainMs) this.activate(rs, t, v, reading);
        } else {
          rs.active!.measured = v;
        }
      } else {
        rs.outSince = -1;
        if (wasActive) {
          if (rs.inSince < 0) rs.inSince = t;
          if (t - rs.inSince >= rule.recoverMs) this.deactivate(rs, t, true);
        }
      }
      if (rs.active && this.inRep) this.touched.add(rule.id);
    }
  }

  private activate(rs: RuleState, t: number, v: number, reading: ConfidenceReading) {
    const { rule } = rs;
    const expected = rs.direction === "low" ? (rule.min as number) : (rule.max as number);
    const dev: ActiveDeviation = { error: rule.id.toUpperCase(), joint: this.describe(rule.landmarks[0]), severity: rule.severity, direction: rs.direction, measured: v, expected, sinceMs: t };
    rs.active = dev;
    rs.inSince = -1;
    this.result.active.push(dev);
    this.attempted++;
    if (this.inRep) this.touched.add(rule.id);
    else this.bumpError(rule.id);
    this.events.push({
      type: "movement_error",
      t,
      exercise: this.template.id,
      phase: this.phase,
      joint: dev.joint,
      error: rule.id,
      severity: rule.severity,
      direction: rs.direction,
      measured: v,
      expected,
      confidence: reading.score,
      rep: this.counted + (this.inRep ? 1 : 0),
      oneShot: false,
    });
  }

  private deactivate(rs: RuleState, t: number, corrected: boolean) {
    const dev = rs.active;
    rs.active = null;
    rs.inSince = rs.outSince = rs.outOfPhaseSince = -1;
    if (!dev) return;
    const i = this.result.active.indexOf(dev);
    if (i >= 0) this.result.active.splice(i, 1);
    if (corrected) {
      this.succeeded++;
      this.events.push({ type: "movement_corrected", t, error: rs.rule.id, joint: dev.joint, afterMs: t - dev.sinceMs, rep: this.counted + (this.inRep ? 1 : 0) });
    }
  }

  // ── Output ───────────────────────────────────────────────────────────────────

  private finish(res: FrameResult, reading: ConfidenceReading | null): FrameResult {
    res.phase = this.phase;
    res.side = this.side;
    res.counted = this.counted;
    res.valid = this.valid;
    res.invalid = this.invalid;
    res.partial = this.partial;
    res.targetReps = this.targetReps;
    res.done = this.counted >= this.targetReps;
    res.events = this.events.length ? this.events : EMPTY_EVENTS;
    if (this.relevantSide !== this.side) this.resolveRequired();

    const joints = res.joints;
    joints.fill(JOINT_NEUTRAL);
    res.redSegments.length = 0;
    if (!res.tracking) return res;

    const uncertain = new Set<number>();
    if (reading) {
      for (const i of reading.weak) uncertain.add(i);
      for (const i of reading.cutOff) uncertain.add(i);
    }
    for (const i of this.relevant) joints[i] = uncertain.has(i) ? JOINT_UNCERTAIN : JOINT_OK;

    if (res.confidence !== "LOW") {
      const paint = (rule: { landmarks: LandmarkRef[]; bones?: [LandmarkRef, LandmarkRef][] }) => {
        for (const ref of rule.landmarks) {
          const i = resolveRef(ref, this.side);
          if (!uncertain.has(i)) joints[i] = JOINT_ERROR;
        }
        for (const [a, b] of rule.bones ?? []) res.redSegments.push([resolveRef(a, this.side), resolveRef(b, this.side)]);
      };
      for (const rs of this.rules) if (rs.active) paint(rs.rule);
      for (const o of this.oneShots.values()) paint(o.rule);
    }
    return res;
  }
}
