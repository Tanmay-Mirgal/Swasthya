import { PoseLandmark } from "../../pose/landmarks";
import { ExerciseTemplate } from "../types";

/**
 * Full exercise template for Neck Rotation.
 *
 * Camera: Front view so nose and both shoulders are visible.
 * Uses a simplified 2-step loop (left and right) since neck rotation
 * is handled by lateral offset rather than a 3-joint angle.
 *
 * The engine uses step validation with trunkUpright as the primary gated check;
 * the existing neckRotation state machine handles the per-direction rep counting.
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
      title: "Starting Position",
      instruction: "Sit upright facing the camera. Keep your shoulders relaxed.",
      // Neck rotation doesn't use joint angle ranges — trunk check is primary
      jointAngleRanges: {},
      postureConstraints: { trunkUpright: true },
      movementPhase: "SETUP",
      minimumConfidence: 0.55,
      tolerance: { angle: 10 },
      completionCondition: { holdDurationMs: 1000 },
      incorrectConditions: ["TRUNK_LEAN"],
    },
    {
      id: "step_2_ready",
      order: 2,
      title: "Ready to Rotate",
      instruction: "Good! Now slowly rotate your head to one side.",
      jointAngleRanges: {},
      postureConstraints: { trunkUpright: true },
      movementPhase: "READY",
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
      fallbackMessage: "Keep your back straight and shoulders even.",
      groqContext: "User is leaning their trunk or tilting their body during neck rotation.",
    },
  ],
};
