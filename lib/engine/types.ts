import { PoseLandmark } from "../pose/landmarks";

// Re-export so templates don't need double imports
export { PoseLandmark };

// ── Issue codes ────────────────────────────────────────────────────────────────
export type IssueCode =
  | "CAMERA_TOO_FAR"
  | "CAMERA_TOO_CLOSE"
  | "LANDMARK_NOT_VISIBLE"
  | "LOW_CONFIDENCE"
  | "WRONG_START_POSITION"
  | "TRUNK_LEAN"
  | "INSUFFICIENT_ROM"
  | "EXCESSIVE_ROM"
  | "TOO_FAST"
  | "TOO_SLOW"
  | "INCOMPLETE_RETURN"
  | "WRONG_MOVEMENT_DIRECTION"
  | "INCORRECT_JOINT_ANGLE"
  | "COMPENSATORY_MOVEMENT"
  | "STEP_NOT_COMPLETE"
  | "INSUFFICIENT_KNEE_EXTENSION"
  | "INSUFFICIENT_ELBOW_FLEXION"
  | "FOOT_NOT_PLANTED"
  | "KNEE_POSITION_INVALID";

export type IssueSeverity = "critical" | "major" | "minor";

// ── Movement phases ────────────────────────────────────────────────────────────
export type MovementPhase =
  | "IDLE"
  | "SETUP"
  | "READY"
  | "EXTENDING"
  | "EXTENDED"
  | "RETURNING"
  | "COMPLETE";

export type StepStatus = "PENDING" | "ACTIVE" | "CHECKING" | "COMPLETE";

// ── Detected issue ─────────────────────────────────────────────────────────────
export interface ExerciseIssue {
  code: IssueCode;
  severity: IssueSeverity;
  /** MediaPipe landmark indices that should be highlighted RED */
  affectedLandmarkIndices: number[];
  currentValue: number;
  expectedValue: number;
  /** Fallback displayed if Groq unavailable */
  fallbackMessage: string;
}

// ── Template building blocks ───────────────────────────────────────────────────
export interface JointAngleRange {
  min: number;
  max: number;
}

export interface PostureConstraints {
  trunkUpright?: boolean;
  footPlanted?: boolean;
}

export interface CompletionCondition {
  /** Must satisfy all angle gates for this many ms */
  holdDurationMs: number;
  /** Primary joint angle must be >= this to count as step complete */
  jointAngleMin?: number;
  /** Primary joint angle must be <= this to count as step complete */
  jointAngleMax?: number;
}

export interface ExerciseStep {
  id: string;
  order: number;
  title: string;
  instruction: string;
  /** Keys: "primary", "hip", "elbow", etc — matched by engine per exercise */
  jointAngleRanges: Record<string, JointAngleRange>;
  postureConstraints: PostureConstraints;
  movementPhase: MovementPhase;
  minimumConfidence: number;
  tolerance: { angle: number };
  completionCondition: CompletionCondition;
  incorrectConditions: IssueCode[];
}

export interface RepDefinition {
  startAngleMax: number;    // start: primary angle <= this
  peakAngleMin: number;     // peak: primary angle >= this
  returnAngleMax: number;   // must return to <= this after peak
  minimumROM: number;       // peak - start >= this
}

export interface ExerciseFeedbackRule {
  issueCode: IssueCode;
  severity: IssueSeverity;
  affectedLandmarkIndices: number[];
  fallbackMessage: string;
  groqContext: string;
}

export interface CameraSetup {
  view: "side" | "front" | "back";
  requiredBodyVisibility: string[];
  orientation?: "left_side" | "right_side" | "any";
  distanceHint: string;
}

export interface ExerciseTemplate {
  exerciseId: string;
  name: string;
  bodyPart: string;
  cameraSetup: CameraSetup;
  steps: ExerciseStep[];
  repDefinition: RepDefinition;
  feedbackRules: ExerciseFeedbackRule[];
  globalConstraints: PostureConstraints;
}

// ── Engine runtime state (stored in refs, not React state) ────────────────────
export interface EngineState {
  currentStepIndex: number;
  stepStatus: StepStatus;
  stepHoldStartMs: number | null;
  currentPhase: MovementPhase;
  activeIssues: ExerciseIssue[];
  incorrectLandmarkIndices: number[];
  lowConfidenceLandmarkIndices: number[];
}

export function createInitialEngineState(): EngineState {
  return {
    currentStepIndex: 0,
    stepStatus: "ACTIVE",
    stepHoldStartMs: null,
    currentPhase: "SETUP",
    activeIssues: [],
    incorrectLandmarkIndices: [],
    lowConfidenceLandmarkIndices: [],
  };
}

// ── Per-frame result ───────────────────────────────────────────────────────────
export interface StepValidationResult {
  engineState: EngineState;
  stepAdvanced: boolean;
  primaryIssue: ExerciseIssue | null;
  currentStepInstruction: string;
  currentStepTitle: string;
  totalSteps: number;
  currentStepIndex: number;
  currentPhase: MovementPhase;
}
