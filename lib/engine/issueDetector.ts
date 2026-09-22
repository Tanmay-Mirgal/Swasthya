import { NormalizedLandmark, PoseLandmark, getLandmark, isLandmarkVisible } from "../pose/landmarks";
import { calculateAngle } from "../biomechanics/angle";
import { computeTrunkLeanRatio } from "./normalization";
import { ExerciseIssue, ExerciseStep, IssueCode } from "./types";
import type { BodySide } from "../pose/landmarks";

// ── Angle extraction helpers ───────────────────────────────────────────────────

export function getKneeAngle(landmarks: NormalizedLandmark[], side: BodySide): number {
  const hip = getLandmark(landmarks, side === "right" ? PoseLandmark.RIGHT_HIP : PoseLandmark.LEFT_HIP);
  const knee = getLandmark(landmarks, side === "right" ? PoseLandmark.RIGHT_KNEE : PoseLandmark.LEFT_KNEE);
  const ankle = getLandmark(landmarks, side === "right" ? PoseLandmark.RIGHT_ANKLE : PoseLandmark.LEFT_ANKLE);
  return calculateAngle(hip, knee, ankle);
}

export function getHipAngle(landmarks: NormalizedLandmark[], side: BodySide): number {
  const shoulder = getLandmark(landmarks, side === "right" ? PoseLandmark.RIGHT_SHOULDER : PoseLandmark.LEFT_SHOULDER);
  const hip = getLandmark(landmarks, side === "right" ? PoseLandmark.RIGHT_HIP : PoseLandmark.LEFT_HIP);
  const knee = getLandmark(landmarks, side === "right" ? PoseLandmark.RIGHT_KNEE : PoseLandmark.LEFT_KNEE);
  return calculateAngle(shoulder, hip, knee);
}

export function getElbowAngle(landmarks: NormalizedLandmark[], side: BodySide): number {
  const shoulder = getLandmark(landmarks, side === "right" ? PoseLandmark.RIGHT_SHOULDER : PoseLandmark.LEFT_SHOULDER);
  const elbow = getLandmark(landmarks, side === "right" ? PoseLandmark.RIGHT_ELBOW : PoseLandmark.LEFT_ELBOW);
  const wrist = getLandmark(landmarks, side === "right" ? PoseLandmark.RIGHT_WRIST : PoseLandmark.LEFT_WRIST);
  return calculateAngle(shoulder, elbow, wrist);
}

/** Build the angle map used by the step validator (keys match template jointAngleRanges) */
export function buildAngleMap(
  landmarks: NormalizedLandmark[],
  side: BodySide,
  exerciseId: string
): Record<string, number> {
  if (exerciseId === "seated-bicep-curl") {
    return { primary: getElbowAngle(landmarks, side), elbow: getElbowAngle(landmarks, side) };
  }
  if (exerciseId === "neck-rotation") {
    // Lateral offset used as "angle" for neck
    return { primary: 0 }; // neck handled separately in PoseDetector
  }
  // Default: lower body (knee extension, squat, etc.)
  return {
    primary: getKneeAngle(landmarks, side),
    knee: getKneeAngle(landmarks, side),
    hip: getHipAngle(landmarks, side),
  };
}

// ── Ankle visibility check ─────────────────────────────────────────────────────

function isFootVisible(landmarks: NormalizedLandmark[], side: BodySide): boolean {
  const ankle = getLandmark(landmarks, side === "right" ? PoseLandmark.RIGHT_ANKLE : PoseLandmark.LEFT_ANKLE);
  return isLandmarkVisible(ankle, 0.4);
}

// ── Issue → landmark index mapping ────────────────────────────────────────────

const ISSUE_LANDMARKS: Record<IssueCode, number[]> = {
  TRUNK_LEAN: [
    PoseLandmark.LEFT_SHOULDER, PoseLandmark.RIGHT_SHOULDER,
    PoseLandmark.LEFT_HIP, PoseLandmark.RIGHT_HIP,
  ],
  INSUFFICIENT_KNEE_EXTENSION: [PoseLandmark.LEFT_KNEE, PoseLandmark.RIGHT_KNEE, PoseLandmark.LEFT_ANKLE, PoseLandmark.RIGHT_ANKLE],
  INSUFFICIENT_ELBOW_FLEXION: [PoseLandmark.LEFT_ELBOW, PoseLandmark.RIGHT_ELBOW, PoseLandmark.LEFT_WRIST, PoseLandmark.RIGHT_WRIST],
  FOOT_NOT_PLANTED: [PoseLandmark.LEFT_ANKLE, PoseLandmark.RIGHT_ANKLE, PoseLandmark.LEFT_HEEL, PoseLandmark.RIGHT_HEEL],
  KNEE_POSITION_INVALID: [PoseLandmark.LEFT_KNEE, PoseLandmark.RIGHT_KNEE],
  WRONG_START_POSITION: [PoseLandmark.LEFT_HIP, PoseLandmark.RIGHT_HIP, PoseLandmark.LEFT_KNEE, PoseLandmark.RIGHT_KNEE],
  INCOMPLETE_RETURN: [PoseLandmark.LEFT_KNEE, PoseLandmark.RIGHT_KNEE, PoseLandmark.LEFT_ANKLE, PoseLandmark.RIGHT_ANKLE],
  INCORRECT_JOINT_ANGLE: [PoseLandmark.LEFT_KNEE, PoseLandmark.RIGHT_KNEE],
  INSUFFICIENT_ROM: [PoseLandmark.LEFT_KNEE, PoseLandmark.RIGHT_KNEE],
  EXCESSIVE_ROM: [PoseLandmark.LEFT_KNEE, PoseLandmark.RIGHT_KNEE],
  TOO_FAST: [],
  TOO_SLOW: [],
  CAMERA_TOO_FAR: [],
  CAMERA_TOO_CLOSE: [],
  LANDMARK_NOT_VISIBLE: [],
  LOW_CONFIDENCE: [],
  WRONG_MOVEMENT_DIRECTION: [PoseLandmark.LEFT_KNEE, PoseLandmark.RIGHT_KNEE],
  COMPENSATORY_MOVEMENT: [PoseLandmark.LEFT_SHOULDER, PoseLandmark.RIGHT_SHOULDER],
  STEP_NOT_COMPLETE: [],
};

/** Returns the raw affected landmark indices for a given issue (both sides) */
export function getLandmarkIndicesForIssue(code: IssueCode): number[] {
  return ISSUE_LANDMARKS[code] ?? [];
}

// ── Core issue detector ────────────────────────────────────────────────────────

/**
 * Analyses the current landmark snapshot against the active step requirements.
 * Returns an ordered list of ExerciseIssue (highest severity first).
 */
export function detectIssues(
  landmarks: NormalizedLandmark[],
  step: ExerciseStep,
  angleMap: Record<string, number>,
  side: BodySide,
  exerciseId: string
): ExerciseIssue[] {
  const issues: ExerciseIssue[] = [];

  // 1. Foot planted check
  if (step.postureConstraints.footPlanted) {
    if (!isFootVisible(landmarks, side)) {
      issues.push({
        code: "FOOT_NOT_PLANTED",
        severity: "major",
        affectedLandmarkIndices: getLandmarkIndicesForIssue("FOOT_NOT_PLANTED"),
        currentValue: 0,
        expectedValue: 1,
        fallbackMessage: "Keep your foot on the floor.",
      });
    }
  }

  // 2. Trunk upright check (uses raw landmark coords — scale invariant ratio)
  if (step.postureConstraints.trunkUpright) {
    const leanRatio = computeTrunkLeanRatio(landmarks);
    if (leanRatio > 0.35) {
      issues.push({
        code: "TRUNK_LEAN",
        severity: "major",
        affectedLandmarkIndices: getLandmarkIndicesForIssue("TRUNK_LEAN"),
        currentValue: Math.round(leanRatio * 100),
        expectedValue: 35,
        fallbackMessage: "Keep your back straight.",
      });
    }
  }

  // 3. Joint angle range checks
  for (const [key, range] of Object.entries(step.jointAngleRanges)) {
    const angle = angleMap[key];
    if (angle === undefined || angle <= 0) continue;

    const tolerance = step.tolerance.angle;
    const tooLow = angle < range.min - tolerance;
    const tooHigh = angle > range.max + tolerance;

    if (tooLow || tooHigh) {
      // Map key to appropriate issue code
      let code: IssueCode = "INCORRECT_JOINT_ANGLE";
      if (key === "knee" || key === "primary") {
        if (exerciseId === "seated-knee-extension") {
          code = tooLow ? "WRONG_START_POSITION" : "INSUFFICIENT_KNEE_EXTENSION";
        }
      } else if (key === "elbow") {
        code = "INSUFFICIENT_ELBOW_FLEXION";
      }

      const expected = tooLow ? range.min : range.max;
      issues.push({
        code,
        severity: "minor",
        affectedLandmarkIndices: getLandmarkIndicesForIssue(code),
        currentValue: angle,
        expectedValue: expected,
        fallbackMessage: tooLow
          ? "Extend a little further."
          : "Return closer to start position.",
      });
    }
  }

  // Sort: critical → major → minor
  const order: Record<string, number> = { critical: 0, major: 1, minor: 2 };
  issues.sort((a, b) => order[a.severity] - order[b.severity]);

  return issues;
}

/** Merge all affected landmark indices from an issue list (deduplicated) */
export function collectIncorrectIndices(issues: ExerciseIssue[]): number[] {
  const set = new Set<number>();
  for (const issue of issues) {
    for (const idx of issue.affectedLandmarkIndices) {
      set.add(idx);
    }
  }
  return Array.from(set);
}
