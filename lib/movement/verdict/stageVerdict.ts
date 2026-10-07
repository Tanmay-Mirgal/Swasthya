/**
 * lib/movement/verdict/stageVerdict.ts
 *
 * What the patient is told, right now, about the movement they are doing: ONE state, with one mark, one word and (when
 * there is something to do) one short instruction. Pure and deterministic; the stage, the captions and the voice all
 * read this same object, so what is shown, spoken and written can never disagree.
 *
 * The states, in the order they win when more than one applies:
 *
 *   cant_see      the camera cannot see enough. Never "wrong". Ask for a different position.
 *   paused        nothing is being judged.
 *   not_counted   the last movement did not count (broke a rule, or fell short). Say what to change.
 *   uncertain     the last movement could not be judged. Never "wrong". Try it again.
 *   corrected     the thing that was flagged has been fixed.
 *   good          the last movement counted.
 *   tracking      moving, nothing to say.   ready: waiting in the starting position.
 *
 * Words are for reading across a room: one or two short words. Instructions are at most 24 characters. Nothing here
 * ever says invalid, error, wrong, low confidence, landmark or angle: those are for therapists and developers.
 */
import type { CameraAdvice, CameraAdviceCode, ConfidenceLevel, Phase } from "../types";

export type StageKind = "ready" | "tracking" | "good" | "not_counted" | "uncertain" | "cant_see" | "corrected" | "paused";
/** The mark that goes with the word, so the state is readable without colour. */
export type StageGlyph = "check" | "cross" | "question" | "pause" | "dots" | "ring";
export type StageTone = "good" | "bad" | "unsure" | "neutral";

export interface StageVerdict {
  kind: StageKind;
  glyph: StageGlyph;
  tone: StageTone;
  /** One or two short words, read from across the room. */
  word: string;
  /** One short instruction (at most 24 characters), or null when there is nothing to do. */
  instruction: string | null;
  /** The full sentence that is spoken and captioned for this state, or null when nothing is said. */
  say: string | null;
  /** Changes whenever a new verdict is made, so two of the same kind in a row can be told apart. */
  seq: number;
}

/** The result of the last attempt, as the coach recorded it. */
export interface RecordedVerdict {
  kind: "good" | "not_counted" | "partial" | "uncertain" | "corrected";
  seq: number;
  /** The short instruction that goes with it (not counted / partial / uncertain). */
  show?: string | null;
  /** The sentence spoken for it. */
  say?: string | null;
  /** For a good rep: how clean it was. Chooses the instruction only ("Smooth and steady"), never shown as a score. */
  quality?: "excellent" | "good";
}

export interface StageInput {
  tracking: boolean;
  confidence: ConfidenceLevel;
  advice: CameraAdvice | null;
  phase: Phase;
  paused: boolean;
  verdict: RecordedVerdict | null;
}

/** Short, kind, one instruction each: what to do about a camera problem. */
export const ADVICE_SHORT: Record<CameraAdviceCode, string> = {
  no_person: "Step into view",
  cut_off: "Stay fully in view",
  too_close: "Move back a little",
  too_far: "Move closer a little",
  low_visibility: "Move so I can see you",
  wrong_orientation: "Turn slightly sideways",
};

export const WORDS = {
  ready: "READY",
  tracking: "KEEP GOING",
  good: "GOOD",
  notCounted: "NOT COUNTED",
  uncertain: "COULD NOT SEE THAT",
  cantSee: "CAN’T SEE YOU CLEARLY",
  corrected: "NICE CORRECTION",
  paused: "PAUSED",
} as const;

export const INSTRUCTIONS = {
  good: "Keep going",
  smooth: "Smooth and steady",
  retry: "Try that one again",
  farther: "A little farther",
  uncertain: "Let’s try it again",
  corrected: "That’s the movement",
  paused: "Take your time",
  ready: "Begin when ready",
} as const;

const make = (kind: StageKind, glyph: StageGlyph, tone: StageTone, word: string, instruction: string | null, say: string | null, seq: number): StageVerdict => ({ kind, glyph, tone, word, instruction, say, seq });

export function deriveStageVerdict(i: StageInput): StageVerdict {
  const v = i.verdict;
  const seq = v?.seq ?? 0;

  // The camera first: form cannot be judged until the person can be seen, and "can't see" is never a mistake.
  if (!i.paused && (!i.tracking || i.confidence === "LOW" || i.advice)) {
    const instruction = i.advice ? ADVICE_SHORT[i.advice.code] : ADVICE_SHORT.low_visibility;
    return make("cant_see", "question", "unsure", WORDS.cantSee, instruction, i.advice?.message ?? null, seq);
  }
  if (i.paused) return make("paused", "pause", "neutral", WORDS.paused, INSTRUCTIONS.paused, null, seq);

  if (v) {
    switch (v.kind) {
      case "not_counted":
      case "partial":
        return make("not_counted", "cross", "bad", WORDS.notCounted, v.show ?? (v.kind === "partial" ? INSTRUCTIONS.farther : INSTRUCTIONS.retry), v.say ?? null, seq);
      case "uncertain":
        return make("uncertain", "question", "unsure", WORDS.uncertain, v.show ?? INSTRUCTIONS.uncertain, v.say ?? null, seq);
      case "corrected":
        return make("corrected", "check", "good", WORDS.corrected, INSTRUCTIONS.corrected, v.say ?? null, seq);
      case "good":
        return make("good", "check", "good", WORDS.good, v.quality === "excellent" ? INSTRUCTIONS.smooth : INSTRUCTIONS.good, null, seq);
    }
  }
  if (i.phase === "setup") return make("ready", "ring", "neutral", WORDS.ready, INSTRUCTIONS.ready, null, seq);
  return make("tracking", "dots", "neutral", WORDS.tracking, null, null, seq);
}

/** Every string a patient can be shown by this module, for the language check. */
export function allPatientStrings(): string[] {
  return [...Object.values(ADVICE_SHORT), ...Object.values(WORDS), ...Object.values(INSTRUCTIONS)];
}
