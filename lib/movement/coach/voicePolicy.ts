/**
 * lib/movement/coach/voicePolicy.ts
 *
 * Decides whether a cue should be SPOKEN right now. Pure: time is passed in, state is
 * returned. Speaking every frame, or every state change, is the failure mode this exists to
 * prevent. The rules, in order:
 *
 *   1. identical text is never repeated inside a window
 *   2. a given problem is not spoken again until its cooldown passes (then it escalates)
 *   3. there is a minimum gap between any two spoken cues; only a clearly more important cue
 *      may interrupt
 *   4. non-urgent corrections wait for a quiet moment in the movement (rest, peak) instead of
 *      talking over a moving patient
 */
import { COACH_CONFIG, type CoachConfig } from "./config";
import type { Phase } from "../types";

export type SpeechKind = "camera" | "error" | "ack" | "praise" | "setup" | "milestone" | "pacing" | "verdict";

export interface SpeechCandidate {
  /** Stable key for the thing being said, e.g. "err:trunk_lean", "camera:too_close". */
  key: string;
  text: string;
  kind: SpeechKind;
  /** Lower = more important (see PRIORITY). */
  priority: number;
  phase: Phase;
}

export interface VoiceState {
  lastAt: number;
  lastText: string;
  lastPriority: number;
  lastKeyAt: Record<string, number>;
  spoken: number;
}

export const initialVoiceState = (): VoiceState => ({ lastAt: -Infinity, lastText: "", lastPriority: 99, lastKeyAt: {}, spoken: 0 });

export interface SpeechDecision {
  speak: boolean;
  /** True when it should cut off speech already in progress. */
  interrupt: boolean;
  /** True when the only thing wrong is timing in the movement: hold it and ask again later. */
  defer: boolean;
  reason: string;
  next: VoiceState;
}

const cooldownFor = (kind: SpeechKind, cfg: CoachConfig) =>
  kind === "camera" ? cfg.voiceCameraCooldownMs : kind === "praise" ? cfg.voicePraiseCooldownMs : kind === "error" ? cfg.voiceRepeatCooldownMs : 0;

export function decideSpeech(v: VoiceState, c: SpeechCandidate, now: number, cfg: CoachConfig = COACH_CONFIG): SpeechDecision {
  const no = (reason: string, defer = false): SpeechDecision => ({ speak: false, interrupt: false, defer, reason, next: v });

  if (c.text === v.lastText && now - v.lastAt < cfg.voiceDuplicateWindowMs) return no("duplicate");

  const lastForKey = v.lastKeyAt[c.key];
  const cool = cooldownFor(c.kind, cfg);
  if (lastForKey !== undefined && cool > 0 && now - lastForKey < cool) return no("cooldown");

  // Do not talk over a patient who is mid-movement about something that can wait a moment.
  const moving = c.phase === "out" || c.phase === "back";
  if (moving && c.kind === "error" && c.priority > 3) return no("movement", true);
  if (moving && (c.kind === "praise" || c.kind === "milestone" || c.kind === "pacing")) return no("movement", true);

  const gap = now - v.lastAt;
  const minGap = c.kind === "ack" ? cfg.voiceAckGapMs : cfg.voiceMinGapMs;
  let interrupt = false;
  if (gap < minGap) {
    const moreImportant = c.priority < v.lastPriority - 0 && gap >= cfg.voiceInterruptGapMs && c.priority <= 3;
    if (!moreImportant) return no("gap", true);
    interrupt = true;
  }

  return {
    speak: true,
    interrupt,
    defer: false,
    reason: "ok",
    next: {
      lastAt: now,
      lastText: c.text,
      lastPriority: c.priority,
      lastKeyAt: { ...v.lastKeyAt, [c.key]: now },
      spoken: v.spoken + 1,
    },
  };
}
