import { NormalizedLandmark } from "../pose/landmarks";
import { PoseLandmark } from "../pose/landmarks";

/**
 * Exponential moving average landmark smoother.
 * alpha = 0.65 → 65% current frame, 35% previous (good balance for 30fps).
 * Reduces jitter without introducing lag.
 */
export function smoothLandmarks(
  current: NormalizedLandmark[],
  previous: NormalizedLandmark[] | null,
  alpha = 0.65
): NormalizedLandmark[] {
  if (!previous || previous.length !== current.length) return current;
  return current.map((lm, i) => {
    const prev = previous[i];
    if (!prev) return lm;
    return {
      x: alpha * lm.x + (1 - alpha) * prev.x,
      y: alpha * lm.y + (1 - alpha) * prev.y,
      z: alpha * lm.z + (1 - alpha) * prev.z,
      visibility: lm.visibility,
    };
  });
}

/**
 * Returns torso height in normalized screen units (shoulder-midpoint to hip-midpoint).
 * Used to make coordinate comparisons body-size invariant.
 */
export function getTorsoHeight(landmarks: NormalizedLandmark[]): number {
  if (!landmarks || landmarks.length < 33) return 0.3;

  const ls = landmarks[PoseLandmark.LEFT_SHOULDER];
  const rs = landmarks[PoseLandmark.RIGHT_SHOULDER];
  const lh = landmarks[PoseLandmark.LEFT_HIP];
  const rh = landmarks[PoseLandmark.RIGHT_HIP];

  if (!ls || !rs || !lh || !rh) return 0.3;

  const shoulderMidY = (ls.y + rs.y) / 2;
  const hipMidY = (lh.y + rh.y) / 2;
  const height = Math.abs(hipMidY - shoulderMidY);

  return height > 0.05 ? height : 0.3;
}

/**
 * Computes how far the shoulder midpoint deviates horizontally from the
 * hip midpoint, expressed as a fraction of torso height.
 * > 0.3 typically indicates a significant trunk lean.
 */
export function computeTrunkLeanRatio(landmarks: NormalizedLandmark[]): number {
  if (!landmarks || landmarks.length < 33) return 0;

  const ls = landmarks[PoseLandmark.LEFT_SHOULDER];
  const rs = landmarks[PoseLandmark.RIGHT_SHOULDER];
  const lh = landmarks[PoseLandmark.LEFT_HIP];
  const rh = landmarks[PoseLandmark.RIGHT_HIP];

  if (!ls || !rs || !lh || !rh) return 0;

  const shoulderMidX = (ls.x + rs.x) / 2;
  const hipMidX = (lh.x + rh.x) / 2;
  const lateralDiff = Math.abs(shoulderMidX - hipMidX);

  const torso = getTorsoHeight(landmarks);
  return lateralDiff / torso;
}

/**
 * Check whether the two shoulders are approximately level
 * (no sideways tilt), expressed as a fraction of torso height.
 */
export function computeShoulderTiltRatio(landmarks: NormalizedLandmark[]): number {
  if (!landmarks || landmarks.length < 33) return 0;
  const ls = landmarks[PoseLandmark.LEFT_SHOULDER];
  const rs = landmarks[PoseLandmark.RIGHT_SHOULDER];
  if (!ls || !rs) return 0;
  const torso = getTorsoHeight(landmarks);
  return Math.abs(ls.y - rs.y) / torso;
}
