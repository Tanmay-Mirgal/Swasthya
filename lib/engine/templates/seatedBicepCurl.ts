import { PoseLandmark } from "../../pose/landmarks";
import { ExerciseTemplate } from "../types";

/**
 * Full exercise template for Seated Bicep Curl.
 *
 * Camera: Front/slight side view so shoulder, elbow, and wrist are visible.
 *
 * Steps:
 *  1. Starting Position   — arm hanging, elbow extended 135–170°
 *  2. Prepare             — maintain position 600 ms
 *  3. Curl Up             — elbow flexes to ≤ 70°
 *  4. Lower               — arm returns to ≥ 135°
 */
export const seatedBicepCurlTemplate: ExerciseTemplate = {
  exerciseId: "seated-bicep-curl",
  name: "Seated Bicep Curl",
  bodyPart: "Elbow",
  cameraSetup: {
    view: "front",
    requiredBodyVisibility: ["shoulder", "elbow", "wrist"],
    orientation: "any",
    distanceHint: "1 – 2 metres",
  },
  globalConstraints: {
    trunkUpright: true,
  },
  steps: [
    {
      id: "step_1_start",
      order: 1,
      title: "Starting Position",
      instruction: "Sit upright with your arm hanging naturally at your side.",
      jointAngleRanges: {
        primary: { min: 130, max: 175 },
        elbow:   { min: 130, max: 175 },
      },
      postureConstraints: { trunkUpright: true },
      movementPhase: "SETUP",
      minimumConfidence: 0.55,
      tolerance: { angle: 12 },
      completionCondition: { holdDurationMs: 1000 },
      incorrectConditions: ["WRONG_START_POSITION", "TRUNK_LEAN"],
    },
    {
      id: "step_2_prepare",
      order: 2,
      title: "Ready",
      instruction: "Great posture! Get ready to curl your arm upward.",
      jointAngleRanges: {
        primary: { min: 130, max: 175 },
        elbow:   { min: 130, max: 175 },
      },
      postureConstraints: { trunkUpright: true },
      movementPhase: "READY",
      minimumConfidence: 0.55,
      tolerance: { angle: 12 },
      completionCondition: { holdDurationMs: 600 },
      incorrectConditions: ["WRONG_START_POSITION", "TRUNK_LEAN"],
    },
    {
      id: "step_3_curl",
      order: 3,
      title: "Curl Up",
      instruction: "Slowly curl your arm up toward your shoulder.",
      jointAngleRanges: {
        primary: { min: 0,  max: 72 },
        elbow:   { min: 0,  max: 72 },
      },
      postureConstraints: { trunkUpright: true },
      movementPhase: "EXTENDING",
      minimumConfidence: 0.55,
      tolerance: { angle: 10 },
      completionCondition: { holdDurationMs: 400, jointAngleMax: 72 },
      incorrectConditions: ["INSUFFICIENT_ELBOW_FLEXION", "TRUNK_LEAN"],
    },
    {
      id: "step_4_lower",
      order: 4,
      title: "Lower Arm",
      instruction: "Slowly lower your arm back to the starting position.",
      jointAngleRanges: {
        primary: { min: 130, max: 175 },
        elbow:   { min: 130, max: 175 },
      },
      postureConstraints: { trunkUpright: true },
      movementPhase: "RETURNING",
      minimumConfidence: 0.55,
      tolerance: { angle: 10 },
      completionCondition: { holdDurationMs: 300, jointAngleMin: 130 },
      incorrectConditions: ["INCOMPLETE_RETURN"],
    },
  ],
  repDefinition: {
    startAngleMax: 175,
    peakAngleMin: 72,    // note: for curls peak = small angle
    returnAngleMax: 135, // returned = large angle
    minimumROM: 60,
  },
  feedbackRules: [
    {
      issueCode: "WRONG_START_POSITION",
      severity: "major",
      affectedLandmarkIndices: [PoseLandmark.LEFT_ELBOW, PoseLandmark.RIGHT_ELBOW],
      fallbackMessage: "Start with your arm hanging straight down.",
      groqContext: "User's arm is not in the fully extended starting position for bicep curl.",
    },
    {
      issueCode: "TRUNK_LEAN",
      severity: "major",
      affectedLandmarkIndices: [PoseLandmark.LEFT_SHOULDER, PoseLandmark.RIGHT_SHOULDER],
      fallbackMessage: "Keep your back straight.",
      groqContext: "User is leaning their trunk instead of keeping it upright during the curl.",
    },
    {
      issueCode: "INSUFFICIENT_ELBOW_FLEXION",
      severity: "minor",
      affectedLandmarkIndices: [PoseLandmark.LEFT_ELBOW, PoseLandmark.RIGHT_ELBOW, PoseLandmark.LEFT_WRIST, PoseLandmark.RIGHT_WRIST],
      fallbackMessage: "Curl your arm higher.",
      groqContext: "User is not fully curling their arm during the bicep curl peak position.",
    },
    {
      issueCode: "INCOMPLETE_RETURN",
      severity: "minor",
      affectedLandmarkIndices: [PoseLandmark.LEFT_ELBOW, PoseLandmark.RIGHT_ELBOW],
      fallbackMessage: "Lower your arm all the way down.",
      groqContext: "User is not lowering their arm back to full extension after the curl.",
    },
  ],
};
