import { ExerciseConfig, MovementState } from "./types";

export const seatedKneeExtensionConfig: ExerciseConfig = {
  id: "seated-knee-extension",
  name: "Seated Knee Extension",
  category: "Lower Body",
  difficulty: "Beginner",
  targetReps: 10,
  primaryJoint: "knee",
  movement: "extension",
  description:
    "Sit upright on a stable chair and slowly extend one leg forward until fully straightened, then return under control.",
  instructions: [
    "Sit upright on a chair with feet flat on the floor.",
    "Position your camera so your upper body, hip, knee, and ankle are clearly visible.",
    "Slowly extend your leg forward until straight.",
    "Lower your leg back to the starting flexed position in a controlled motion.",
  ],
};

// Biomechanical angle thresholds for state machine
export const KNEE_EXTENSION_THRESHOLDS = {
  START_FLEXION_MAX: 105, // Knee flexed angle threshold to begin / finish rep
  EXTENDING_MIN: 110,     // Knee moving upward
  EXTENDED_TARGET: 140,   // Target peak extension angle
  RETURN_TRIGGER: 135,    // Knee bending back down
};

export interface StateMachineResult {
  nextState: MovementState;
  repIncremented: boolean;
  event: "NONE" | "STARTED" | "PEAK_REACHED" | "REP_COMPLETED";
}

/**
 * Pure state machine transition function for Seated Knee Extension.
 * Evaluates current angle against state transition boundaries.
 */
export function evaluateSeatedKneeExtensionState(
  currentState: MovementState,
  kneeAngle: number
): StateMachineResult {
  if (kneeAngle <= 0 || kneeAngle > 180) {
    return { nextState: currentState, repIncremented: false, event: "NONE" };
  }

  switch (currentState) {
    case "READY":
      if (kneeAngle >= KNEE_EXTENSION_THRESHOLDS.EXTENDING_MIN) {
        return {
          nextState: "EXTENDING",
          repIncremented: false,
          event: "STARTED",
        };
      }
      return { nextState: "READY", repIncremented: false, event: "NONE" };

    case "EXTENDING":
      if (kneeAngle >= KNEE_EXTENSION_THRESHOLDS.EXTENDED_TARGET) {
        return {
          nextState: "EXTENDED",
          repIncremented: false,
          event: "PEAK_REACHED",
        };
      }
      // If user abandons extension before reaching peak and returns to start
      if (kneeAngle <= KNEE_EXTENSION_THRESHOLDS.START_FLEXION_MAX) {
        return { nextState: "READY", repIncremented: false, event: "NONE" };
      }
      return { nextState: "EXTENDING", repIncremented: false, event: "NONE" };

    case "EXTENDED":
      if (kneeAngle <= KNEE_EXTENSION_THRESHOLDS.RETURN_TRIGGER) {
        return {
          nextState: "RETURNING",
          repIncremented: false,
          event: "NONE",
        };
      }
      return { nextState: "EXTENDED", repIncremented: false, event: "NONE" };

    case "RETURNING":
      if (kneeAngle <= KNEE_EXTENSION_THRESHOLDS.START_FLEXION_MAX) {
        return {
          nextState: "READY",
          repIncremented: true,
          event: "REP_COMPLETED",
        };
      }
      return { nextState: "RETURNING", repIncremented: false, event: "NONE" };

    default:
      return { nextState: "READY", repIncremented: false, event: "NONE" };
  }
}
