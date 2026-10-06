import { getAllMovementTemplates } from "@/lib/movement/template/registry";

/** Plain-language labels for the movement-feedback codes the on-device engine raises. */
export const ISSUE_LABELS: Record<string, string> = {
  CAMERA_TOO_FAR: "Camera too far away",
  CAMERA_TOO_CLOSE: "Camera too close",
  LANDMARK_NOT_VISIBLE: "Part of the body out of view",
  LOW_CONFIDENCE: "Camera could not track clearly",
  WRONG_START_POSITION: "Starting position",
  TRUNK_LEAN: "Leaning the trunk",
  INSUFFICIENT_ROM: "Range of motion below target",
  EXCESSIVE_ROM: "Range of motion beyond target",
  TOO_FAST: "Movement too fast",
  TOO_SLOW: "Movement too slow",
  INCOMPLETE_RETURN: "Did not return fully to start",
  WRONG_MOVEMENT_DIRECTION: "Movement direction",
  INCORRECT_JOINT_ANGLE: "Joint angle",
  COMPENSATORY_MOVEMENT: "Compensating with other joints",
  STEP_NOT_COMPLETE: "Step not completed",
  INSUFFICIENT_KNEE_EXTENSION: "Knee not extended fully",
  INSUFFICIENT_ELBOW_FLEXION: "Elbow not bent fully",
  FOOT_NOT_PLANTED: "Foot not planted",
  KNEE_POSITION_INVALID: "Knee position",
};

let templateLabels: Record<string, string> | null = null;

/** Labels for the codes the movement engine's exercise templates raise (built once from the templates). */
function fromTemplates(): Record<string, string> {
  if (templateLabels) return templateLabels;
  const out: Record<string, string> = {};
  for (const t of getAllMovementTemplates()) {
    for (const r of t.rules) out[r.id.toUpperCase()] ??= r.label;
    for (const r of Object.values(t.repRules)) if (r) out[r.id.toUpperCase()] ??= r.label;
  }
  templateLabels = out;
  return out;
}

/** Plain-language name for a stored issue code. Older (pre-engine-v2) codes keep their labels. */
export function issueLabel(code: string): string {
  return fromTemplates()[code] ?? ISSUE_LABELS[code] ?? code.toLowerCase().replace(/_/g, " ");
}
