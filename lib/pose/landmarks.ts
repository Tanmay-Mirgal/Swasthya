import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export type { NormalizedLandmark };

// MediaPipe 33 Body Landmark Indices
export enum PoseLandmark {
  NOSE = 0,
  LEFT_EYE_INNER = 1,
  LEFT_EYE = 2,
  LEFT_EYE_OUTER = 3,
  RIGHT_EYE_INNER = 4,
  RIGHT_EYE = 5,
  RIGHT_EYE_OUTER = 6,
  LEFT_EAR = 7,
  RIGHT_EAR = 8,
  MOUTH_LEFT = 9,
  MOUTH_RIGHT = 10,
  LEFT_SHOULDER = 11,
  RIGHT_SHOULDER = 12,
  LEFT_ELBOW = 13,
  RIGHT_ELBOW = 14,
  LEFT_WRIST = 15,
  RIGHT_WRIST = 16,
  LEFT_PINKY = 17,
  RIGHT_PINKY = 18,
  LEFT_INDEX = 19,
  RIGHT_INDEX = 20,
  LEFT_THUMB = 21,
  RIGHT_THUMB = 22,
  LEFT_HIP = 23,
  RIGHT_HIP = 24,
  LEFT_KNEE = 25,
  RIGHT_KNEE = 26,
  LEFT_ANKLE = 27,
  RIGHT_ANKLE = 28,
  LEFT_HEEL = 29,
  RIGHT_HEEL = 30,
  LEFT_FOOT_INDEX = 31,
  RIGHT_FOOT_INDEX = 32,
}

export type BodySide = "left" | "right";

/**
 * Safely retrieve a specific landmark from landmarks array
 */
export function getLandmark(
  landmarks: NormalizedLandmark[],
  index: PoseLandmark
): NormalizedLandmark | null {
  if (!landmarks || landmarks.length <= index) return null;
  return landmarks[index];
}

/**
 * Check if a landmark meets minimum visibility threshold
 */
export function isLandmarkVisible(
  landmark: NormalizedLandmark | null,
  minVisibility = 0.5
): boolean {
  if (!landmark) return false;
  if (landmark.visibility === undefined) return true;
  return landmark.visibility >= minVisibility;
}

/**
 * Determine which side of the body (left or right) has better average landmark visibility
 */
export function getBestSide(landmarks: NormalizedLandmark[]): BodySide {
  if (!landmarks || landmarks.length < 33) return "left";

  const leftHip = getLandmark(landmarks, PoseLandmark.LEFT_HIP);
  const leftKnee = getLandmark(landmarks, PoseLandmark.LEFT_KNEE);
  const leftAnkle = getLandmark(landmarks, PoseLandmark.LEFT_ANKLE);

  const rightHip = getLandmark(landmarks, PoseLandmark.RIGHT_HIP);
  const rightKnee = getLandmark(landmarks, PoseLandmark.RIGHT_KNEE);
  const rightAnkle = getLandmark(landmarks, PoseLandmark.RIGHT_ANKLE);

  const leftVis =
    ((leftHip?.visibility ?? 1) +
      (leftKnee?.visibility ?? 1) +
      (leftAnkle?.visibility ?? 1)) /
    3;

  const rightVis =
    ((rightHip?.visibility ?? 1) +
      (rightKnee?.visibility ?? 1) +
      (rightAnkle?.visibility ?? 1)) /
    3;

  return rightVis > leftVis ? "right" : "left";
}
