import type { ConfidenceCheckResult } from "./confidence";

export type BodySegment = "lower" | "upper" | "neck";

export type TrackingKind = "starting" | "ready" | "no_body" | "low_confidence";

export interface TrackingState {
  kind: TrackingKind;
  title: string;
  /** What the person should do next, in plain words. */
  detail: string;
}

export interface JointCheck {
  name: string;
  detected: boolean;
}

export function jointChecklist(confidence: ConfidenceCheckResult | undefined, segment: BodySegment): JointCheck[] {
  const c = confidence;
  if (segment === "neck") {
    return [
      { name: "Face", detected: Boolean(c?.joint1Visible) },
      { name: "Both shoulders", detected: Boolean(c?.joint2Visible && c?.joint3Visible) },
    ];
  }
  if (segment === "upper") {
    return [
      { name: "Shoulder", detected: Boolean(c?.joint1Visible) },
      { name: "Elbow", detected: Boolean(c?.joint2Visible) },
      { name: "Wrist", detected: Boolean(c?.joint3Visible) },
    ];
  }
  return [
    { name: "Hip", detected: Boolean(c?.joint1Visible) },
    { name: "Knee", detected: Boolean(c?.joint2Visible) },
    { name: "Ankle", detected: Boolean(c?.joint3Visible) },
  ];
}

const FRAME_WORDS: Record<BodySegment, string> = {
  lower: "your hip, knee and ankle",
  upper: "your shoulder, elbow and wrist",
  neck: "your face and both shoulders",
};

/** Turns raw pose confidence into one calm instruction: what is wrong and what to do about it. */
export function describeTracking(confidence: ConfidenceCheckResult | undefined, segment: BodySegment): TrackingState {
  if (!confidence) {
    return { kind: "starting", title: "Getting ready", detail: "Sit in front of the camera while tracking starts." };
  }
  if (confidence.status === "READY") {
    return { kind: "ready", title: "Tracking well", detail: "I can see everything I need." };
  }
  if (!confidence.personDetected) {
    return {
      kind: "no_body",
      title: "I can’t see you yet",
      detail: `Sit in the middle of the frame and move back until ${FRAME_WORDS[segment]} are in view.`,
    };
  }
  const missing = jointChecklist(confidence, segment).filter((j) => !j.detected).map((j) => j.name.toLowerCase());
  const hint =
    segment === "lower"
      ? !confidence.joint3Visible && confidence.joint1Visible
        ? "Move the camera back or tilt it down so your ankle is in view."
        : "Move back until your whole leg is in view."
      : segment === "upper"
      ? !confidence.joint3Visible
        ? "Step back a little so your wrist is in view."
        : "Keep your upper body in the middle of the frame."
      : "Raise the camera to eye level and keep your head and shoulders in view.";
  return {
    kind: "low_confidence",
    title: `I can’t see your ${missing.join(" and ")} clearly`,
    detail: hint,
  };
}
