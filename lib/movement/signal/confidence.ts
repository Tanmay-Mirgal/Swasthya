/**
 * lib/movement/signal/confidence.ts
 *
 * Turns per-landmark visibility into one confidence level for the joints an exercise
 * needs: HIGH, MEDIUM or LOW. Judgment (reps, errors, red landmarks) is only allowed at
 * MEDIUM or better. The level is debounced in time, so one noisy frame cannot flip it.
 */
import type { ConfidenceLevel, LM } from "../types";

export interface ConfidenceThresholds {
  /** Every required joint at least this visible = HIGH. */
  high: number;
  /** Every required joint at least this visible = MEDIUM. */
  medium: number;
  /** Landmarks closer than this to a frame edge cap the level at MEDIUM. */
  edgeMargin: number;
}

export const DEFAULT_CONFIDENCE: ConfidenceThresholds = { high: 0.7, medium: 0.5, edgeMargin: 0.015 };

/** Time a candidate level must hold before it replaces the current one (ms). */
const DOWN_MS: Record<ConfidenceLevel, number> = { HIGH: 400, MEDIUM: 300, LOW: 0 };
/** Time to move UP to the target level: LOW to MEDIUM is quick, reaching HIGH needs to be steady. */
const UP_MS: Record<ConfidenceLevel, number> = { HIGH: 500, MEDIUM: 250, LOW: 0 };
/** Losing sight of a required joint is acted on quickly, because judging a blind joint is the worse error. */
const TO_LOW_MS = 300;
const RANK: Record<ConfidenceLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

export interface ConfidenceReading {
  level: ConfidenceLevel;
  /** Mean visibility of the required joints, 0..1. For logging and storage. */
  score: number;
  /** Required joints below the MEDIUM threshold (indices). */
  weak: number[];
  /** Required joints outside the frame or touching its edge (indices). */
  cutOff: number[];
}

export class ConfidenceTracker {
  level: ConfidenceLevel = "LOW";
  private candidate: ConfidenceLevel = "LOW";
  private candidateSince = 0;
  private readonly weak: number[] = [];
  private readonly cutOff: number[] = [];
  private readonly reading: ConfidenceReading = { level: "LOW", score: 0, weak: this.weak, cutOff: this.cutOff };

  constructor(private readonly th: ConfidenceThresholds = DEFAULT_CONFIDENCE) {}

  reset() {
    this.level = "LOW";
    this.candidate = "LOW";
    this.candidateSince = 0;
  }

  /** `points` are the stabilised image landmarks; null = no person. */
  update(t: number, points: readonly LM[] | null, required: readonly number[]): ConfidenceReading {
    this.weak.length = 0;
    this.cutOff.length = 0;
    let raw: ConfidenceLevel = "LOW";
    let score = 0;

    if (points && required.length) {
      let min = 1;
      let sum = 0;
      let edge = false;
      for (const idx of required) {
        const p = points[idx];
        const v = p?.visibility ?? 0;
        sum += v;
        if (v < min) min = v;
        if (v < this.th.medium) this.weak.push(idx);
        if (p) {
          const m = this.th.edgeMargin;
          if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) {
            this.cutOff.push(idx);
          } else if (p.x < m || p.x > 1 - m || p.y < m || p.y > 1 - m) {
            edge = true;
            this.cutOff.push(idx);
          }
        }
      }
      score = sum / required.length;
      const outside = this.cutOff.some((i) => {
        const p = points[i];
        return p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1;
      });
      if (outside || min < this.th.medium) raw = "LOW";
      else if (min < this.th.high || edge) raw = "MEDIUM";
      else raw = "HIGH";
    }

    if (raw === this.level) {
      this.candidate = raw;
      this.candidateSince = t;
    } else {
      if (raw !== this.candidate) {
        this.candidate = raw;
        this.candidateSince = t;
      }
      const dropping = RANK[raw] < RANK[this.level];
      const need = dropping ? (raw === "LOW" ? TO_LOW_MS : DOWN_MS[this.level]) : UP_MS[raw];
      if (t - this.candidateSince >= need) this.level = raw;
    }

    this.reading.level = this.level;
    this.reading.score = score;
    return this.reading;
  }
}
