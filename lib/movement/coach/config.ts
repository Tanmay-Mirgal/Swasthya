/**
 * lib/movement/coach/config.ts
 *
 * Every tunable of the coaching loop in one place, so behaviour can be adjusted (and
 * tested) without touching logic.
 */
export const COACH_CONFIG = {
  /** A cue stays on screen at least this long, even if the problem clears. */
  minCueDisplayMs: 3500,
  /** How long a "good correction" message stays on screen. */
  ackDisplayMs: 3000,

  /** Voice: minimum gap between any two spoken cues. */
  voiceMinGapMs: 2800,
  /** Voice: minimum gap before an acknowledgement (they are short and welcome). */
  voiceAckGapMs: 1200,
  /** Voice: a more important cue may interrupt after this long. */
  voiceInterruptGapMs: 900,
  /** Voice: the same problem is not spoken again (escalated) until this long has passed. */
  voiceRepeatCooldownMs: 12_000,
  voiceCameraCooldownMs: 9_000,
  voicePraiseCooldownMs: 20_000,
  /** Voice: identical text is never repeated within this window. */
  voiceDuplicateWindowMs: 30_000,
  /** A cue waiting for a quiet moment in the movement is dropped after this long. */
  voicePendingTtlMs: 6_000,

  /** Language model: at most this many requests per set, and this far apart. */
  llmMaxPerSet: 12,
  llmMinGapMs: 5_000,
  llmTimeoutMs: 4_000,

  /** An error seen in at least this many reps (and this share of reps) becomes a therapist observation. */
  observationMinReps: 3,
  observationMinShare: 0.5,
} as const;

export type CoachConfig = typeof COACH_CONFIG;
