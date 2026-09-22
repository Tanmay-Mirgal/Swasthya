import {
  NormalizedLandmark,
  PoseLandmark,
  getLandmark,
  isLandmarkVisible,
  getBestSide,
  BodySide,
} from "./landmarks";

export type ConfidenceStatus = "READY" | "CAMERA_NOT_READY" | "UNRELIABLE";

export interface ConfidenceCheckResult {
  status: ConfidenceStatus;
  activeSide: BodySide;
  personDetected: boolean;
  joint1Visible: boolean; // Hip or Shoulder
  joint2Visible: boolean; // Knee or Elbow
  joint3Visible: boolean; // Ankle or Wrist
  message: string;
}

/**
 * Evaluates pose confidence for lower body (hip, knee, ankle), upper body (shoulder, elbow, wrist), or neck (nose, shoulders).
 */
export function checkPoseConfidence(
  landmarks: NormalizedLandmark[] | null | undefined,
  bodySegment: "lower" | "upper" | "neck" = "lower"
): ConfidenceCheckResult {
  if (!landmarks || landmarks.length === 0) {
    return {
      status: "CAMERA_NOT_READY",
      activeSide: "left",
      personDetected: false,
      joint1Visible: false,
      joint2Visible: false,
      joint3Visible: false,
      message: "No person detected in camera frame",
    };
  }

  const activeSide = getBestSide(landmarks);

  let idx1: PoseLandmark;
  let idx2: PoseLandmark;
  let idx3: PoseLandmark;
  let names: [string, string, string];

  if (bodySegment === "neck") {
    idx1 = PoseLandmark.NOSE;
    idx2 = PoseLandmark.LEFT_SHOULDER;
    idx3 = PoseLandmark.RIGHT_SHOULDER;
    names = ["nose", "left shoulder", "right shoulder"];
  } else if (bodySegment === "upper") {
    idx1 = activeSide === "right" ? PoseLandmark.RIGHT_SHOULDER : PoseLandmark.LEFT_SHOULDER;
    idx2 = activeSide === "right" ? PoseLandmark.RIGHT_ELBOW : PoseLandmark.LEFT_ELBOW;
    idx3 = activeSide === "right" ? PoseLandmark.RIGHT_WRIST : PoseLandmark.LEFT_WRIST;
    names = ["shoulder", "elbow", "wrist"];
  } else {
    idx1 = activeSide === "right" ? PoseLandmark.RIGHT_HIP : PoseLandmark.LEFT_HIP;
    idx2 = activeSide === "right" ? PoseLandmark.RIGHT_KNEE : PoseLandmark.LEFT_KNEE;
    idx3 = activeSide === "right" ? PoseLandmark.RIGHT_ANKLE : PoseLandmark.LEFT_ANKLE;
    names = ["hip", "knee", "ankle"];
  }

  const p1 = getLandmark(landmarks, idx1);
  const p2 = getLandmark(landmarks, idx2);
  const p3 = getLandmark(landmarks, idx3);

  const j1Vis = isLandmarkVisible(p1, 0.4);
  const j2Vis = isLandmarkVisible(p2, 0.4);
  const j3Vis = isLandmarkVisible(p3, 0.4);

  const allVisible = j1Vis && j2Vis && j3Vis;

  if (!allVisible) {
    const missing: string[] = [];
    if (!j1Vis) missing.push(names[0]);
    if (!j2Vis) missing.push(names[1]);
    if (!j3Vis) missing.push(names[2]);

    return {
      status: "UNRELIABLE",
      activeSide,
      personDetected: true,
      joint1Visible: j1Vis,
      joint2Visible: j2Vis,
      joint3Visible: j3Vis,
      message: `Adjust camera so your ${missing.join(" & ")} are visible.`,
    };
  }

  return {
    status: "READY",
    activeSide,
    personDetected: true,
    joint1Visible: true,
    joint2Visible: true,
    joint3Visible: true,
    message: "Camera ready",
  };
}
