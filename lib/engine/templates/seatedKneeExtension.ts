import { PoseLandmark } from "../../pose/landmarks";
import { ExerciseTemplate } from "../types";

/**
 * Full exercise template for Seated Knee Extension.
 *
 * Camera: Side view (left or right), 1.5–2.5 m away so full leg is visible.
 *
 * Steps:
 *  1. Starting Position   — sit upright, knee flexed 85–105°
 *  2. Prepare             — maintain start pose for 500 ms
 *  3. Extend              — knee angle reaches ≥ 150°
 *  4. Return              — knee returns to ≤ 105° → rep counted
 */
export const seatedKneeExtensionTemplate: ExerciseTemplate = {
  exerciseId: "seated-knee-extension",
  name: "Seated Knee Extension",
  bodyPart: "Knee",
  cameraSetup: {
    view: "side",
    requiredBodyVisibility: ["shoulder", "hip", "knee", "ankle"],
    orientation: "any",
    distanceHint: "1.5 – 2.5 metres",
  },
  globalConstraints: {
    trunkUpright: true,
    footPlanted: false,
  },
  steps: [
    {
      id: "step_1_start_position",
      order: 1,
      title: "Starting Position",
      instruction: "Sit upright with both feet flat on the floor.",
      jointAngleRanges: {
        primary: { min: 75, max: 115 },
        knee:    { min: 75, max: 115 },
      },
      postureConstraints: { trunkUpright: true },
      movementPhase: "SETUP",
      minimumConfidence: 0.55,
      tolerance: { angle: 12 },
      completionCondition: { holdDurationMs: 1200 },
      incorrectConditions: ["WRONG_START_POSITION", "TRUNK_LEAN"],
    },
    {
      id: "step_2_prepare",
      order: 2,
      title: "Prepare to Extend",
      instruction: "Good posture! Hold steady and get ready to extend your leg.",
      jointAngleRanges: {
        primary: { min: 75, max: 115 },
        knee:    { min: 75, max: 115 },
      },
      postureConstraints: { trunkUpright: true },
      movementPhase: "READY",
      minimumConfidence: 0.55,
      tolerance: { angle: 12 },
      completionCondition: { holdDurationMs: 800 },
      incorrectConditions: ["WRONG_START_POSITION", "TRUNK_LEAN"],
    },
    {
      id: "step_3_extend",
      order: 3,
      title: "Extend Your Knee",
      instruction: "Slowly straighten your leg forward until fully extended.",
      jointAngleRanges: {
        primary: { min: 148, max: 180 },
        knee:    { min: 148, max: 180 },
      },
      postureConstraints: { trunkUpright: true },
      movementPhase: "EXTENDING",
      minimumConfidence: 0.55,
      tolerance: { angle: 10 },
      completionCondition: { holdDurationMs: 500, jointAngleMin: 148 },
      incorrectConditions: ["INSUFFICIENT_KNEE_EXTENSION", "TRUNK_LEAN"],
    },
    {
      id: "step_4_return",
      order: 4,
      title: "Return to Start",
      instruction: "Slowly lower your leg back to the starting position.",
      jointAngleRanges: {
        primary: { min: 75, max: 108 },
        knee:    { min: 75, max: 108 },
      },
      postureConstraints: { trunkUpright: true },
      movementPhase: "RETURNING",
      minimumConfidence: 0.55,
      tolerance: { angle: 10 },
      completionCondition: { holdDurationMs: 300, jointAngleMax: 108 },
      incorrectConditions: ["INCOMPLETE_RETURN"],
    },
  ],
  repDefinition: {
    startAngleMax: 115,
    peakAngleMin: 148,
    returnAngleMax: 115,
    minimumROM: 40,
  },
  feedbackRules: [
    {
      issueCode: "WRONG_START_POSITION",
      severity: "major",
      affectedLandmarkIndices: [PoseLandmark.LEFT_KNEE, PoseLandmark.RIGHT_KNEE],
      fallbackMessage: "Sit with your knee bent at about 90°.",
      groqContext: "User's knee is not in the starting flexed position before beginning the extension.",
    },
    {
      issueCode: "TRUNK_LEAN",
      severity: "major",
      affectedLandmarkIndices: [
        PoseLandmark.LEFT_SHOULDER, PoseLandmark.RIGHT_SHOULDER,
        PoseLandmark.LEFT_HIP, PoseLandmark.RIGHT_HIP,
      ],
      fallbackMessage: "Keep your back straight.",
      groqContext: "User's trunk is leaning sideways or forward instead of remaining upright.",
    },
    {
      issueCode: "INSUFFICIENT_KNEE_EXTENSION",
      severity: "minor",
      affectedLandmarkIndices: [PoseLandmark.LEFT_KNEE, PoseLandmark.RIGHT_KNEE, PoseLandmark.LEFT_ANKLE, PoseLandmark.RIGHT_ANKLE],
      fallbackMessage: "Extend your leg a little more.",
      groqContext: "User's knee is not reaching full extension during the extension phase.",
    },
    {
      issueCode: "INCOMPLETE_RETURN",
      severity: "minor",
      affectedLandmarkIndices: [PoseLandmark.LEFT_KNEE, PoseLandmark.RIGHT_KNEE],
      fallbackMessage: "Lower your leg all the way back down.",
      groqContext: "User is not returning their leg to the fully bent starting position.",
    },
  ],
};
