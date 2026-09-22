import { ExerciseConfig, MovementState } from "./types";
import { NormalizedLandmark } from "../pose/landmarks";

export const neckRotationConfig: ExerciseConfig = {
  id: "neck-rotation",
  name: "Neck Rotation",
  category: "Neck & Upper Body",
  difficulty: "Beginner",
  targetReps: 8,
  primaryJoint: "cervical",
  movement: "rotation",
  description:
    "Gently rotate your head side to side while seated upright. Improves cervical range of motion and reduces stiffness.",
  instructions: [
    "Sit upright facing the camera directly with shoulders level.",
    "Slowly rotate your head to the LEFT as far as comfortable, then return to center.",
    "Then slowly rotate your head to the RIGHT as far as comfortable, then return to center.",
    "Each side rotation and return to center counts toward your repetition goal.",
  ],
};

export const NECK_ROTATION_THRESHOLDS = {
  /** Nose must shift this far from shoulder midpoint to trigger rotation start */
  ROTATION_TRIGGER: 0.020,
  /** Nose must reach this offset to count as a valid peak on left or right */
  ROTATION_PEAK: 0.035,
  /** Within this offset from center = considered back at neutral center */
  CENTER_DEAD_ZONE: 0.015,
};

export interface NeckRepPhase {
  currentSide: "left" | "right" | "center";
  peaked: boolean;
}

export function createNeckRepPhase(): NeckRepPhase {
  return { currentSide: "center", peaked: false };
}

export interface NeckRotationStateMachineResult {
  nextState: MovementState;
  repIncremented: boolean;
  event: "NONE" | "STARTED" | "PEAK_REACHED" | "REP_COMPLETED";
  newPhase: NeckRepPhase;
}

/**
 * Compute lateral offset of nose relative to the midpoint of both shoulders.
 * Positive = nose is toward patient's RIGHT
 * Negative = nose is toward patient's LEFT
 */
export function computeNeckLateralOffset(
  nose: NormalizedLandmark | null,
  leftShoulder: NormalizedLandmark | null,
  rightShoulder: NormalizedLandmark | null
): number {
  if (!nose || !leftShoulder || !rightShoulder) return 0;
  const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
  return shoulderMidX - nose.x;
}

/**
 * Robust state machine for Neck Rotation.
 * Supports turning EITHER Left OR Right first, and counts a rep on returning to center.
 */
export function evaluateNeckRotationState(
  currentState: MovementState,
  lateralOffset: number,
  phase: NeckRepPhase
): NeckRotationStateMachineResult {
  const T = NECK_ROTATION_THRESHOLDS;
  const absOffset = Math.abs(lateralOffset);
  const detectedSide: "left" | "right" = lateralOffset < 0 ? "left" : "right";

  const unchanged = (s: MovementState): NeckRotationStateMachineResult => ({
    nextState: s,
    repIncremented: false,
    event: "NONE",
    newPhase: phase,
  });

  switch (currentState) {
    case "READY": {
      // User starts turning head away from center (left or right)
      if (absOffset >= T.ROTATION_TRIGGER) {
        return {
          nextState: "EXTENDING",
          repIncremented: false,
          event: "STARTED",
          newPhase: { currentSide: detectedSide, peaked: false },
        };
      }
      return unchanged("READY");
    }

    case "EXTENDING": {
      // Check if user reaches side peak threshold (for either left or right turn)
      if (absOffset >= T.ROTATION_PEAK) {
        return {
          nextState: "EXTENDED",
          repIncremented: false,
          event: "PEAK_REACHED",
          newPhase: { ...phase, peaked: true },
        };
      }
      // Abandoned turn before reaching peak — returned to center
      if (absOffset <= T.CENTER_DEAD_ZONE) {
        return {
          nextState: "READY",
          repIncremented: false,
          event: "NONE",
          newPhase: createNeckRepPhase(),
        };
      }
      return unchanged("EXTENDING");
    }

    case "EXTENDED": {
      // Head peaked on side (left or right) — now waiting to return to center
      if (absOffset <= T.CENTER_DEAD_ZONE) {
        return {
          nextState: "READY",
          repIncremented: true,
          event: "REP_COMPLETED",
          newPhase: createNeckRepPhase(),
        };
      }
      return unchanged("EXTENDED");
    }

    case "RETURNING": {
      if (absOffset <= T.CENTER_DEAD_ZONE) {
        return {
          nextState: "READY",
          repIncremented: true,
          event: "REP_COMPLETED",
          newPhase: createNeckRepPhase(),
        };
      }
      return unchanged("RETURNING");
    }

    default:
      return {
        nextState: "READY",
        repIncremented: false,
        event: "NONE",
        newPhase: createNeckRepPhase(),
      };
  }
}
