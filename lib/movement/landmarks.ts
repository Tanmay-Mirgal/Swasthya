/**
 * lib/movement/landmarks.ts
 *
 * MediaPipe pose landmark indices, the way templates name joints, and the skeleton
 * segments the overlay draws. Left / right are the SUBJECT's left / right (MediaPipe's
 * convention), regardless of how the video is mirrored on screen.
 */
import { PoseLandmark } from "@/lib/pose/landmarks";

export { PoseLandmark };
export const LANDMARK_COUNT = 33;

export type JointName = "nose" | "ear" | "shoulder" | "elbow" | "wrist" | "hip" | "knee" | "ankle" | "heel" | "foot";
export type SideRef = "active" | "opposite" | "left" | "right";
export type Side = "left" | "right";

export interface LandmarkRef {
  joint: JointName;
  side?: SideRef;
}

const PAIRS: Record<Exclude<JointName, "nose">, [number, number]> = {
  ear: [PoseLandmark.LEFT_EAR, PoseLandmark.RIGHT_EAR],
  shoulder: [PoseLandmark.LEFT_SHOULDER, PoseLandmark.RIGHT_SHOULDER],
  elbow: [PoseLandmark.LEFT_ELBOW, PoseLandmark.RIGHT_ELBOW],
  wrist: [PoseLandmark.LEFT_WRIST, PoseLandmark.RIGHT_WRIST],
  hip: [PoseLandmark.LEFT_HIP, PoseLandmark.RIGHT_HIP],
  knee: [PoseLandmark.LEFT_KNEE, PoseLandmark.RIGHT_KNEE],
  ankle: [PoseLandmark.LEFT_ANKLE, PoseLandmark.RIGHT_ANKLE],
  heel: [PoseLandmark.LEFT_HEEL, PoseLandmark.RIGHT_HEEL],
  foot: [PoseLandmark.LEFT_FOOT_INDEX, PoseLandmark.RIGHT_FOOT_INDEX],
};

export const opposite = (s: Side): Side => (s === "left" ? "right" : "left");

/** Resolves a template reference to a landmark index, given which side is "active". */
export function resolveRef(ref: LandmarkRef, active: Side): number {
  if (ref.joint === "nose") return PoseLandmark.NOSE;
  const side: Side =
    ref.side === "left" || ref.side === "right" ? ref.side : ref.side === "opposite" ? opposite(active) : active;
  return PAIRS[ref.joint][side === "left" ? 0 : 1];
}

const JOINT_LABEL: Record<JointName, string> = {
  nose: "nose",
  ear: "ear",
  shoulder: "shoulder",
  elbow: "elbow",
  wrist: "wrist",
  hip: "hip",
  knee: "knee",
  ankle: "ankle",
  heel: "heel",
  foot: "foot",
};

/** "left knee" / "knee" in plain words. `sided` adds the side when the ref names one explicitly. */
export function describeRef(ref: LandmarkRef, active: Side): string {
  if (ref.joint === "nose") return "head";
  const side = ref.side === "left" || ref.side === "right" ? ref.side : ref.side === "opposite" ? opposite(active) : null;
  return side ? `${side} ${JOINT_LABEL[ref.joint]}` : JOINT_LABEL[ref.joint];
}

/** Body segments the overlay may draw (no face mesh, no fingers). */
export const BODY_SEGMENTS: ReadonlyArray<readonly [number, number]> = [
  [PoseLandmark.LEFT_SHOULDER, PoseLandmark.RIGHT_SHOULDER],
  [PoseLandmark.LEFT_SHOULDER, PoseLandmark.LEFT_ELBOW],
  [PoseLandmark.LEFT_ELBOW, PoseLandmark.LEFT_WRIST],
  [PoseLandmark.RIGHT_SHOULDER, PoseLandmark.RIGHT_ELBOW],
  [PoseLandmark.RIGHT_ELBOW, PoseLandmark.RIGHT_WRIST],
  [PoseLandmark.LEFT_SHOULDER, PoseLandmark.LEFT_HIP],
  [PoseLandmark.RIGHT_SHOULDER, PoseLandmark.RIGHT_HIP],
  [PoseLandmark.LEFT_HIP, PoseLandmark.RIGHT_HIP],
  [PoseLandmark.LEFT_HIP, PoseLandmark.LEFT_KNEE],
  [PoseLandmark.LEFT_KNEE, PoseLandmark.LEFT_ANKLE],
  [PoseLandmark.RIGHT_HIP, PoseLandmark.RIGHT_KNEE],
  [PoseLandmark.RIGHT_KNEE, PoseLandmark.RIGHT_ANKLE],
  [PoseLandmark.LEFT_ANKLE, PoseLandmark.LEFT_HEEL],
  [PoseLandmark.LEFT_HEEL, PoseLandmark.LEFT_FOOT_INDEX],
  [PoseLandmark.LEFT_ANKLE, PoseLandmark.LEFT_FOOT_INDEX],
  [PoseLandmark.RIGHT_ANKLE, PoseLandmark.RIGHT_HEEL],
  [PoseLandmark.RIGHT_HEEL, PoseLandmark.RIGHT_FOOT_INDEX],
  [PoseLandmark.RIGHT_ANKLE, PoseLandmark.RIGHT_FOOT_INDEX],
];

/** Indices drawn as dots (the body joints plus nose and ears). Face-mesh points are never drawn. */
export const DRAWN_LANDMARKS: readonly number[] = [
  PoseLandmark.NOSE,
  PoseLandmark.LEFT_EAR,
  PoseLandmark.RIGHT_EAR,
  PoseLandmark.LEFT_SHOULDER,
  PoseLandmark.RIGHT_SHOULDER,
  PoseLandmark.LEFT_ELBOW,
  PoseLandmark.RIGHT_ELBOW,
  PoseLandmark.LEFT_WRIST,
  PoseLandmark.RIGHT_WRIST,
  PoseLandmark.LEFT_HIP,
  PoseLandmark.RIGHT_HIP,
  PoseLandmark.LEFT_KNEE,
  PoseLandmark.RIGHT_KNEE,
  PoseLandmark.LEFT_ANKLE,
  PoseLandmark.RIGHT_ANKLE,
  PoseLandmark.LEFT_HEEL,
  PoseLandmark.RIGHT_HEEL,
  PoseLandmark.LEFT_FOOT_INDEX,
  PoseLandmark.RIGHT_FOOT_INDEX,
];
