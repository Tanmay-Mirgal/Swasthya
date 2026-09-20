import { ExerciseConfig, MovementState } from "./types";

export const seatedBicepCurlConfig: ExerciseConfig = {
  id: "seated-bicep-curl",
  name: "Seated Bicep Curl",
  category: "Upper Body",
  difficulty: "Beginner",
  targetReps: 10,
  primaryJoint: "elbow",
  movement: "flexion",
  description:
    "Sit upright at your desk or chair. Bend your elbow to curl your hand up toward your shoulder, then lower under control.",
  instructions: [
    "Sit upright in front of your camera.",
    "Keep your upper body, shoulder, elbow, and wrist visible.",
    "Curl your arm upward toward your shoulder.",
    "Lower your arm smoothly back down to starting position.",
  ],
};

export const BICEP_CURL_THRESHOLDS = {
  START_EXTENSION_MIN: 135, // Arm extended down to begin / finish rep
  FLEXING_TRIGGER: 125,     // Arm curling upward
  FLEXED_TARGET: 65,        // Target peak curl angle (elbow flexed)
  RETURN_TRIGGER: 85,       // Arm lowering back down
};

export interface BicepCurlStateMachineResult {
  nextState: MovementState;
  repIncremented: boolean;
  event: "NONE" | "STARTED" | "PEAK_REACHED" | "REP_COMPLETED";
}

export function evaluateSeatedBicepCurlState(
  currentState: MovementState,
  elbowAngle: number
): BicepCurlStateMachineResult {
  if (elbowAngle <= 0 || elbowAngle > 180) {
    return { nextState: currentState, repIncremented: false, event: "NONE" };
  }

  switch (currentState) {
    case "READY":
      if (elbowAngle <= BICEP_CURL_THRESHOLDS.FLEXING_TRIGGER) {
        return {
          nextState: "EXTENDING", // Using EXTENDING as moving toward peak
          repIncremented: false,
          event: "STARTED",
        };
      }
      return { nextState: "READY", repIncremented: false, event: "NONE" };

    case "EXTENDING":
      if (elbowAngle <= BICEP_CURL_THRESHOLDS.FLEXED_TARGET) {
        return {
          nextState: "EXTENDED", // Peak curl reached
          repIncremented: false,
          event: "PEAK_REACHED",
        };
      }
      if (elbowAngle >= BICEP_CURL_THRESHOLDS.START_EXTENSION_MIN) {
        return { nextState: "READY", repIncremented: false, event: "NONE" };
      }
      return { nextState: "EXTENDING", repIncremented: false, event: "NONE" };

    case "EXTENDED":
      if (elbowAngle >= BICEP_CURL_THRESHOLDS.RETURN_TRIGGER) {
        return {
          nextState: "RETURNING",
          repIncremented: false,
          event: "NONE",
        };
      }
      return { nextState: "EXTENDED", repIncremented: false, event: "NONE" };

    case "RETURNING":
      if (elbowAngle >= BICEP_CURL_THRESHOLDS.START_EXTENSION_MIN) {
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
