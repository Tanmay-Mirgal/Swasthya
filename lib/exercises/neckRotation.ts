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
    "Sit upright facing the camera directly.",
    "Ensure your head, nose, and both shoulders are clearly visible.",
    "Slowly rotate your head to the RIGHT, then back to center.",
    "Then rotate your head to the LEFT, then back to center.",
    "That counts as 1 full rep. Move slowly and smoothly.",
  ],
};

export const NECK_ROTATION_THRESHOLDS = {
  /** Nose must shift this far from shoulder midpoint to start a rep */
  ROTATION_TRIGGER: 0.04,
  /** Nose must reach this offset to count as a valid peak on one side */
  ROTATION_PEAK: 0.06,
  /** Within this offset from center = considered "back to center" */
  CENTER_DEAD_ZONE: 0.022,
};

export interface NeckRepPhase {
  firstSideSign: number;    // +1 or -1 (direction of first turn), 0 when unknown
  peakedSecondSide: boolean;
}

export function createNeckRepPhase(): NeckRepPhase {
  return { firstSideSign: 0, peakedSecondSide: false };
}

export interface NeckRotationStateMachineResult {
  nextState: MovementState;
  repIncremented: boolean;
  event: "NONE" | "STARTED" | "PEAK_REACHED" | "REP_COMPLETED";
  newPhase: NeckRepPhase;
}

/**
 * Compute lateral offset of nose relative to the midpoint of both shoulders.
 * Positive = nose is to patient's RIGHT (in mirrored webcam: nose moves to image-left → shoulderMidX > nose.x)
 */
export function computeNeckLateralOffset(
  nose: NormalizedLandmark | null,
  leftShoulder: NormalizedLandmark | null,
  rightShoulder: NormalizedLandmark | null
): number {
  if (!nose || !leftShoulder || !rightShoulder) return 0;
  const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
  // Mirrored webcam: patient turns RIGHT → nose goes to image-left → nose.x decreases → shoulderMidX - nose.x > 0
  return shoulderMidX - nose.x;
}

/**
 * Pure state machine for a full Neck Rotation rep.
 * One rep = rotate to one side (peak) → return to center → rotate to opposite side (peak) → return to center.
 *
 * State mapping (reusing MovementState):
 *   READY     = neutral at center, waiting to start
 *   EXTENDING = moving toward first side
 *   EXTENDED  = peaked first side, returning to center
 *   RETURNING = moving toward second side (and back to center)
 */
export function evaluateNeckRotationState(
  currentState: MovementState,
  lateralOffset: number,
  phase: NeckRepPhase
): NeckRotationStateMachineResult {
  const T = NECK_ROTATION_THRESHOLDS;
  const absOffset = Math.abs(lateralOffset);
  const sign = lateralOffset > 0 ? 1 : lateralOffset < 0 ? -1 : 0;

  const unchanged = (s: MovementState): NeckRotationStateMachineResult => ({
    nextState: s,
    repIncremented: false,
    event: "NONE",
    newPhase: phase,
  });

  switch (currentState) {
    case "READY": {
      if (absOffset >= T.ROTATION_TRIGGER) {
        return {
          nextState: "EXTENDING",
          repIncremented: false,
          event: "STARTED",
          newPhase: { firstSideSign: sign, peakedSecondSide: false },
        };
      }
      return unchanged("READY");
    }

    case "EXTENDING": {
      if (absOffset >= T.ROTATION_PEAK) {
        return {
          nextState: "EXTENDED",
          repIncremented: false,
          event: "PEAK_REACHED",
          newPhase: phase,
        };
      }
      // Abandoned before peak — returned to center
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
      // Waiting to return to center after first peak
      if (absOffset <= T.CENTER_DEAD_ZONE) {
        return {
          nextState: "RETURNING",
          repIncremented: false,
          event: "NONE",
          newPhase: phase,
        };
      }
      return unchanged("EXTENDED");
    }

    case "RETURNING": {
      const secondSideSign = -phase.firstSideSign;
      const onSecondSide =
        secondSideSign !== 0
          ? lateralOffset * secondSideSign >= T.ROTATION_PEAK
          : absOffset >= T.ROTATION_PEAK;

      if (!phase.peakedSecondSide) {
        if (onSecondSide) {
          return {
            nextState: "RETURNING",
            repIncremented: false,
            event: "PEAK_REACHED",
            newPhase: { ...phase, peakedSecondSide: true },
          };
        }
        return unchanged("RETURNING");
      } else {
        // Already peaked second side — wait for return to center
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
