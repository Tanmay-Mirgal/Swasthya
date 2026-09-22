import { PoseLandmark } from "../../pose/landmarks";
import { ExerciseTemplate } from "../types";

/**
 * Full exercise template for Neck Rotation with explicit Left and Right guidance steps.
 *
 * Camera: Front view so nose and both shoulders are visible.
 */
export const neckRotationTemplate: ExerciseTemplate = {
  exerciseId: "neck-rotation",
  name: "Neck Rotation",
  bodyPart: "Neck",
  cameraSetup: {
    view: "front",
    requiredBodyVisibility: ["nose", "left shoulder", "right shoulder"],
    orientation: "any",
    distanceHint: "0.5 – 1.5 metres",
  },
  globalConstraints: {
    trunkUpright: true,
  },
  steps: [
    {
      id: "step_1_center",
      order: 1,
      title: "Neutral Center",
      instruction: "Sit tall facing camera with shoulders level and relaxed.",
      jointAngleRanges: {},
      postureConstraints: { trunkUpright: true },
      movementPhase: "SETUP",
      minimumConfidence: 0.55,
      tolerance: { angle: 10 },
      completionCondition: { holdDurationMs: 1000 },
      incorrectConditions: ["TRUNK_LEAN"],
    },
    {
      id: "step_2_rotate_left",
      order: 2,
      title: "Rotate Head LEFT",
      instruction: "Slowly rotate your head to the LEFT as far as comfortable.",
      jointAngleRanges: {},
      postureConstraints: { trunkUpright: true },
      movementPhase: "EXTENDING",
      minimumConfidence: 0.55,
      tolerance: { angle: 10 },
      completionCondition: { holdDurationMs: 500 },
      incorrectConditions: ["TRUNK_LEAN"],
    },
    {
      id: "step_3_return_center",
      order: 3,
      title: "Return to Center",
      instruction: "Pause at peak, then smoothly turn back to neutral center.",
      jointAngleRanges: {},
      postureConstraints: { trunkUpright: true },
      movementPhase: "RETURNING",
      minimumConfidence: 0.55,
      tolerance: { angle: 10 },
      completionCondition: { holdDurationMs: 500 },
      incorrectConditions: ["TRUNK_LEAN"],
    },
    {
      id: "step_4_rotate_right",
      order: 4,
      title: "Rotate Head RIGHT",
      instruction: "Now slowly rotate your head to the RIGHT as far as comfortable.",
      jointAngleRanges: {},
      postureConstraints: { trunkUpright: true },
      movementPhase: "EXTENDING",
      minimumConfidence: 0.55,
      tolerance: { angle: 10 },
      completionCondition: { holdDurationMs: 500 },
      incorrectConditions: ["TRUNK_LEAN"],
    },
    {
      id: "step_5_return_center",
      order: 5,
      title: "Return to Center",
      instruction: "Pause at peak, then return to neutral center to complete rep.",
      jointAngleRanges: {},
      postureConstraints: { trunkUpright: true },
      movementPhase: "RETURNING",
      minimumConfidence: 0.55,
      tolerance: { angle: 10 },
      completionCondition: { holdDurationMs: 500 },
      incorrectConditions: ["TRUNK_LEAN"],
    },
  ],
  repDefinition: {
    startAngleMax: 10,
    peakAngleMin: 30,
    returnAngleMax: 10,
    minimumROM: 20,
  },
  feedbackRules: [
    {
      issueCode: "TRUNK_LEAN",
      severity: "major",
      affectedLandmarkIndices: [
        PoseLandmark.LEFT_SHOULDER, PoseLandmark.RIGHT_SHOULDER,
        PoseLandmark.LEFT_HIP, PoseLandmark.RIGHT_HIP,
      ],
      fallbackMessage: "Keep your back straight and shoulders level.",
      groqContext: "User is leaning their body or tilting shoulders during neck rotation.",
    },
  ],
};
