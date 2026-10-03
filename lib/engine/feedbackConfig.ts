/**
 * feedbackConfig.ts
 *
 * Central configuration for the real-time AI Coach feedback system.
 * All magic numbers live here so they can be tuned without touching logic files.
 */

export const FEEDBACK_CONFIG = {
  /**
   * An issue must persist for this many milliseconds before it is
   * considered "confirmed" and eligible for a Groq request.
   * At ~30 fps, 600 ms ~18 frames -- filters single noisy frames.
   */
  MIN_ISSUE_PERSISTENCE_MS: 600,

  /**
   * After Groq generates feedback for an issue, suppress another
   * request for the same issue code for this many milliseconds.
   */
  SAME_ISSUE_COOLDOWN_MS: 10_000,

  /**
   * When a NEW issue replaces a different old issue, use this shorter
   * cooldown so the new instruction is delivered promptly.
   */
  NEW_ISSUE_COOLDOWN_MS: 2_000,

  /**
   * Groq API timeout in milliseconds.
   */
  GROQ_TIMEOUT_MS: 5_000,

  /**
   * Minimum time a feedback message stays visible in the UI before
   * it is cleared (even if the issue resolves).
   */
  MIN_FEEDBACK_DISPLAY_MS: 4_500,

  /**
   * Maximum word count for a Groq response to be accepted.
   * Set generously so natural spoken cues aren't artificially truncated.
   * The server validates the same bound.
   */
  MAX_RESPONSE_WORDS: 20,

  /**
   * Minimum word count to accept a Groq response.
   */
  MIN_RESPONSE_WORDS: 2,
} as const;

/**
 * Priority order for issue codes.
 * Lower number = higher priority.
 * The highest-priority issue is sent to Groq when multiple co-occur.
 */
export const ISSUE_PRIORITY: Record<string, number> = {
  // Camera / visibility (safety-critical; must be corrected first)
  CAMERA_TOO_FAR: 1,
  CAMERA_TOO_CLOSE: 1,
  LANDMARK_NOT_VISIBLE: 1,
  LOW_CONFIDENCE: 1,

  // Major posture / form (safety)
  TRUNK_LEAN: 2,
  FOOT_NOT_PLANTED: 2,
  COMPENSATORY_MOVEMENT: 2,

  // Starting position / wrong movement
  WRONG_START_POSITION: 3,
  WRONG_MOVEMENT_DIRECTION: 3,
  KNEE_POSITION_INVALID: 3,

  // Range of motion
  INSUFFICIENT_KNEE_EXTENSION: 4,
  INSUFFICIENT_ELBOW_FLEXION: 4,
  INSUFFICIENT_ROM: 4,
  EXCESSIVE_ROM: 4,
  INCORRECT_JOINT_ANGLE: 4,
  INCOMPLETE_RETURN: 4,

  // Tempo / control
  TOO_FAST: 5,
  TOO_SLOW: 5,

  // Minor / step completion
  STEP_NOT_COMPLETE: 6,
};
