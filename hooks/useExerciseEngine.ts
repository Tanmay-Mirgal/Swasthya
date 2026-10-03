"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { NormalizedLandmark } from "@/lib/pose/landmarks";
import { getBestSide } from "@/lib/pose/landmarks";
import { smoothLandmarks } from "@/lib/engine/normalization";
import { processEngineFrame, createInitialEngineState } from "@/lib/engine/exerciseEngine";
import { getTemplate } from "@/lib/engine/templates";
import { GroqFeedbackService } from "@/lib/engine/groqFeedback";
import { FEEDBACK_CONFIG } from "@/lib/engine/feedbackConfig";
import {
  EngineState,
  ExerciseTemplate,
  MovementPhase,
  StepValidationResult,
} from "@/lib/engine/types";

export interface ExerciseEngineOutput {
  /** Current step (0-indexed) */
  currentStepIndex: number;
  totalSteps: number;
  currentStepTitle: string;
  currentStepInstruction: string;
  currentPhase: MovementPhase;
  /** Whether the current step conditions are all satisfied */
  stepValid: boolean;
  /** Landmark indices to color RED on the skeleton */
  incorrectLandmarkIndices: number[];
  /** Landmark indices to color YELLOW (low confidence) */
  lowConfidenceLandmarkIndices: number[];
  /** The most important correction right now (from Groq or fallback) */
  activeFeedback: string;
  /** Issue code of the current primary issue (for speech priority) */
  activeIssueCode: string | null;
  /** Whether Groq is still loading a response */
  feedbackLoading: boolean;
  /** Call this every frame from onFrameUpdate */
  processFrame: (landmarks: NormalizedLandmark[] | null) => void;
}

export function useExerciseEngine(
  exerciseId: string,
  exerciseName: string
): ExerciseEngineOutput {
  // ── Refs ──────────────────────────────────────────────────────────────────
  const engineStateRef = useRef<EngineState>(createInitialEngineState());
  const smoothedLandmarksRef = useRef<NormalizedLandmark[] | null>(null);
  const templateRef = useRef<ExerciseTemplate | null>(null);
  const groqServiceRef = useRef(new GroqFeedbackService());

  // Feedback display housekeeping
  const feedbackSetTimeRef = useRef<number>(0);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track previous state to avoid redundant React updates
  const prevFeedbackRef = useRef<string>("");
  const prevStepIndexRef = useRef(-1);

  // ── State ──────────────────────────────────────────────────────────────────
  const [stepResult, setStepResult] = useState<StepValidationResult | null>(null);
  const [activeFeedback, setActiveFeedback] = useState("");
  const [activeIssueCode, setActiveIssueCode] = useState<string | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  // ── Reset when exerciseId changes ──────────────────────────────────────────
  useEffect(() => {
    templateRef.current = getTemplate(exerciseId);
    engineStateRef.current = createInitialEngineState();
    smoothedLandmarksRef.current = null;
    groqServiceRef.current.reset();
    prevStepIndexRef.current = -1;
    prevFeedbackRef.current = "";
    feedbackSetTimeRef.current = 0;
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    setStepResult(null);
    setActiveFeedback("");
    setActiveIssueCode(null);
    setFeedbackLoading(false);
  }, [exerciseId]);

  // ── Per-frame processor ────────────────────────────────────────────────────
  const processFrame = useCallback(
    (landmarks: NormalizedLandmark[] | null) => {
      const template = templateRef.current;
      if (!template || !landmarks || landmarks.length === 0) return;

      // 1. Smooth landmarks (reduces jitter from MediaPipe)
      smoothedLandmarksRef.current = smoothLandmarks(
        landmarks,
        smoothedLandmarksRef.current
      );

      // 2. Determine which body side to evaluate
      const side = getBestSide(smoothedLandmarksRef.current);

      // 3. Run deterministic exercise engine
      const nowMs = Date.now();
      const result = processEngineFrame(
        engineStateRef.current,
        smoothedLandmarksRef.current,
        template,
        side,
        nowMs
      );

      engineStateRef.current = result.engineState;

      // 4. Only trigger React re-renders when meaningful state changes
      const stepChanged = result.currentStepIndex !== prevStepIndexRef.current;
      const currentIssues = result.engineState.activeIssues;

      // 5. Update step result when step advances
      if (stepChanged) {
        prevStepIndexRef.current = result.currentStepIndex;
        setStepResult(result);
      }

      // 6. Drive the GroqFeedbackService every frame (fire-and-forget)
      const step = template.steps[result.currentStepIndex];
      const feedbackCue = groqServiceRef.current.onFrame(
        currentIssues,
        exerciseId,
        exerciseName,
        step?.title ?? "",
        step?.instruction ?? "",
        template,
        nowMs
      );

      // 7. Update UI feedback state only when the cue actually changes
      const primaryIssueCode = currentIssues.length > 0 ? currentIssues[0].code : null;
      if (feedbackCue !== prevFeedbackRef.current) {
        prevFeedbackRef.current = feedbackCue;
        setActiveIssueCode(primaryIssueCode);

        if (feedbackCue) {
          setActiveFeedback(feedbackCue);
          feedbackSetTimeRef.current = nowMs;
          if (feedbackTimeoutRef.current) {
            clearTimeout(feedbackTimeoutRef.current);
            feedbackTimeoutRef.current = null;
          }
        } else {
          // feedbackCue cleared -- hold old message for MIN_FEEDBACK_DISPLAY_MS
          const elapsed = nowMs - feedbackSetTimeRef.current;
          if (elapsed >= FEEDBACK_CONFIG.MIN_FEEDBACK_DISPLAY_MS) {
            setActiveFeedback("");
          } else {
            if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
            feedbackTimeoutRef.current = setTimeout(() => {
              setActiveFeedback("");
              prevFeedbackRef.current = "";
            }, FEEDBACK_CONFIG.MIN_FEEDBACK_DISPLAY_MS - elapsed);
          }
        }
      }

      // feedbackLoading is now implicit (no separate Groq await in the loop)
      // Keep loading false -- the service handles it fire-and-forget
    },
    [exerciseId, exerciseName]
  );

  const template = templateRef.current;
  const currentStepIndex = stepResult?.currentStepIndex ?? 0;
  const totalSteps = template?.steps.length ?? 1;
  const currentStep = template?.steps[currentStepIndex];

  return {
    currentStepIndex,
    totalSteps,
    currentStepTitle: stepResult?.currentStepTitle ?? currentStep?.title ?? "Starting…",
    currentStepInstruction: stepResult?.currentStepInstruction ?? currentStep?.instruction ?? "",
    currentPhase: stepResult?.currentPhase ?? "SETUP",
    stepValid: (stepResult?.primaryIssue ?? null) === null,
    incorrectLandmarkIndices: engineStateRef.current.incorrectLandmarkIndices,
    lowConfidenceLandmarkIndices: engineStateRef.current.lowConfidenceLandmarkIndices,
    activeFeedback,
    activeIssueCode,
    feedbackLoading,
    processFrame,
  };
}
