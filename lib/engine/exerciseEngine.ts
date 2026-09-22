import { NormalizedLandmark } from "../pose/landmarks";
import type { BodySide } from "../pose/landmarks";
import {
  EngineState,
  ExerciseTemplate,
  StepValidationResult,
  MovementPhase,
  createInitialEngineState,
} from "./types";
import { buildAngleMap, detectIssues, collectIncorrectIndices } from "./issueDetector";

/**
 * Pure functional exercise engine.
 * Takes current state + landmarks → returns new state + result.
 * No side effects. No async. Safe to call at 30fps.
 */
export function processEngineFrame(
  state: EngineState,
  landmarks: NormalizedLandmark[],
  template: ExerciseTemplate,
  side: BodySide,
  nowMs: number
): StepValidationResult {
  const { steps } = template;
  const currentStepIndex = Math.min(state.currentStepIndex, steps.length - 1);
  const step = steps[currentStepIndex];
  const isLastStep = currentStepIndex >= steps.length - 1;

  // ── Build angle map for this frame ──────────────────────────────────────────
  const angleMap = buildAngleMap(landmarks, side, template.exerciseId);

  // ── Detect issues against current step requirements ──────────────────────────
  const issues = detectIssues(landmarks, step, angleMap, side, template.exerciseId);
  const incorrectIndices = collectIncorrectIndices(issues);

  const isStepValid = issues.length === 0;

  // ── Step hold / completion logic ─────────────────────────────────────────────
  let holdStartMs = state.stepHoldStartMs;
  let stepAdvanced = false;
  let nextStepIndex = currentStepIndex;
  let nextPhase: MovementPhase = step.movementPhase;

  if (isStepValid) {
    // Start or continue hold timer
    if (holdStartMs === null) {
      holdStartMs = nowMs;
    }

    const heldMs = nowMs - holdStartMs;

    if (heldMs >= step.completionCondition.holdDurationMs) {
      // Step complete — advance to next
      if (!isLastStep) {
        nextStepIndex = currentStepIndex + 1;
        holdStartMs = null;
        stepAdvanced = true;
        nextPhase = steps[nextStepIndex].movementPhase;
      } else {
        nextPhase = "COMPLETE";
      }
    }
  } else {
    // Reset hold timer when pose breaks
    holdStartMs = null;
  }

  const newState: EngineState = {
    currentStepIndex: nextStepIndex,
    stepStatus: isStepValid ? "CHECKING" : "ACTIVE",
    stepHoldStartMs: holdStartMs,
    currentPhase: nextPhase,
    activeIssues: issues,
    incorrectLandmarkIndices: incorrectIndices,
    lowConfidenceLandmarkIndices: [],
  };

  const primaryIssue = issues.length > 0 ? issues[0] : null;
  const displayStep = steps[nextStepIndex] ?? step;

  return {
    engineState: newState,
    stepAdvanced,
    primaryIssue,
    currentStepInstruction: displayStep.instruction,
    currentStepTitle: displayStep.title,
    totalSteps: steps.length,
    currentStepIndex: nextStepIndex,
    currentPhase: nextPhase,
  };
}

/** Create a fresh engine state for a new exercise session */
export { createInitialEngineState };
