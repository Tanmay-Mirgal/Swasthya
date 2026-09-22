"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { NormalizedLandmark } from "@/lib/pose/landmarks";
import { getBestSide } from "@/lib/pose/landmarks";
import { smoothLandmarks } from "@/lib/engine/normalization";
import { processEngineFrame, createInitialEngineState } from "@/lib/engine/exerciseEngine";
import { getTemplate } from "@/lib/engine/templates";
import { GroqFeedbackService } from "@/lib/engine/groqFeedback";
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
  /** Whether Groq is still loading a response */
  feedbackLoading: boolean;
  /** Call this every frame from onFrameUpdate */
  processFrame: (landmarks: NormalizedLandmark[] | null) => void;
}

/**
 * useExerciseEngine — React hook that runs the template-driven exercise guidance engine.
 *
 * Usage:
 *   const engine = useExerciseEngine(exercise.id, exercise.name)
 *   // In onFrameUpdate: engine.processFrame(data.landmarks)
 *   // Render: incorrectLandmarkIndices, activeFeedback, currentStepInstruction, etc.
 */
export function useExerciseEngine(
  exerciseId: string,
  exerciseName: string
): ExerciseEngineOutput {
  // ── Refs (never trigger re-renders — updated every frame) ─────────────────
  const engineStateRef = useRef<EngineState>(createInitialEngineState());
  const smoothedLandmarksRef = useRef<NormalizedLandmark[] | null>(null);
  const templateRef = useRef<ExerciseTemplate | null>(null);
  const groqServiceRef = useRef(new GroqFeedbackService());
  const lastStepIndexRef = useRef(-1);
  const lastIssueCodeRef = useRef<string | null>(null);

  // ── State (triggers UI re-renders — updated at meaningful moments) ────────
  const [stepResult, setStepResult] = useState<StepValidationResult | null>(null);
  const [activeFeedback, setActiveFeedback] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  // ── Load template when exerciseId changes ─────────────────────────────────
  useEffect(() => {
    templateRef.current = getTemplate(exerciseId);
    engineStateRef.current = createInitialEngineState();
    smoothedLandmarksRef.current = null;
    groqServiceRef.current.reset();
    lastStepIndexRef.current = -1;
    lastIssueCodeRef.current = null;
    setStepResult(null);
    setActiveFeedback("");
  }, [exerciseId]);

  // ── Per-frame processor (called from onFrameUpdate, non-blocking) ─────────
  const processFrame = useCallback(
    (landmarks: NormalizedLandmark[] | null) => {
      const template = templateRef.current;
      if (!template || !landmarks || landmarks.length === 0) return;

      // 1. Smooth landmarks (EMA)
      smoothedLandmarksRef.current = smoothLandmarks(
        landmarks,
        smoothedLandmarksRef.current
      );

      // 2. Determine active side
      const side = getBestSide(smoothedLandmarksRef.current);

      // 3. Run engine (pure function, synchronous)
      const result = processEngineFrame(
        engineStateRef.current,
        smoothedLandmarksRef.current,
        template,
        side,
        Date.now()
      );

      engineStateRef.current = result.engineState;

      // 4. Update React state only when something meaningful changed
      const stepChanged = result.currentStepIndex !== lastStepIndexRef.current;
      const issueChanged = (result.primaryIssue?.code ?? null) !== lastIssueCodeRef.current;

      if (stepChanged || issueChanged) {
        lastStepIndexRef.current = result.currentStepIndex;
        lastIssueCodeRef.current = result.primaryIssue?.code ?? null;
        setStepResult(result);

        // 5. Groq feedback for new/changed issue
        if (result.primaryIssue) {
          const issue = result.primaryIssue;
          const step = template.steps[result.currentStepIndex];

          if (groqServiceRef.current.shouldRequest(issue)) {
            setFeedbackLoading(true);

            groqServiceRef.current
              .requestFeedback(
                issue,
                exerciseId,
                exerciseName,
                step?.title ?? "",
                step?.instruction ?? ""
              )
              .then((feedback) => {
                setActiveFeedback(feedback);
              })
              .finally(() => setFeedbackLoading(false));
          } else {
            // Still show cached or fallback while in cooldown
            const cached = groqServiceRef.current.getCachedFeedback();
            setActiveFeedback(cached || issue.fallbackMessage);
          }
        } else {
          // No issue — clear feedback
          setActiveFeedback("");
          setFeedbackLoading(false);
        }
      }
    },
    [exerciseId, exerciseName]
  );

  // ── Derive output from latest result ─────────────────────────────────────
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
    feedbackLoading,
    processFrame,
  };
}
