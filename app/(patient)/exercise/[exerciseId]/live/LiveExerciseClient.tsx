/* eslint-disable react-hooks/immutability */
/* eslint-disable react-hooks/purity */
"use client";

import { useState, useCallback, useRef, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/react";
import { BookOpen } from "lucide-react";
import PoseDetector, { FrameUpdateData } from "@/components/pose/PoseDetector";
import FocusFrame from "@/components/exercise/FocusFrame";
import LivePanel from "@/components/exercise/LivePanel";
import PoseGuidePanel from "@/components/exercise/PoseGuidePanel";
import { Button, Dialog } from "@/components/ui";
import { getExerciseById } from "@/lib/exercises/registry";
import { saveSession, syncSessionToDatabase } from "@/lib/session/sessionStore";
import { describeTracking } from "@/lib/pose/trackingState";
import { FeedbackMessage, SessionRecord } from "@/lib/exercises/types";
import { useExerciseEngine } from "@/hooks/useExerciseEngine";
import PrescribedSession from "@/components/exercise/PrescribedSession";

interface PageProps {
  params: Promise<{ exerciseId: string }>;
}

/**
 * Prescribed work (opened from Today with ?plan=&ex=) runs set by set against the server.
 * Anything else is free practice: a single run that is saved to this device and account.
 */
export default function DynamicLiveExercisePage({ params }: PageProps) {
  const { exerciseId } = use(params);
  const search = useSearchParams();
  const planId = search.get("plan");
  const exerciseKey = search.get("ex");
  if (planId && exerciseKey) {
    return <PrescribedSession exerciseId={exerciseId} planId={planId} exerciseKey={exerciseKey} reviewId={search.get("review") || undefined} />;
  }
  return <FreePracticeSession params={params} />;
}

function FreePracticeSession({ params }: PageProps) {
  const resolvedParams = use(params);
  const exercise = getExerciseById(resolvedParams.exerciseId) || getExerciseById("seated-knee-extension")!;

  const router = useRouter();
  const searchParams = useSearchParams();
  const { getToken } = useAuth();
  // The prescribed reps per set travel with the link; fall back to the exercise default.
  const repsParam = Number(searchParams.get("reps"));
  const plannedReps = Number.isInteger(repsParam) && repsParam >= 1 && repsParam <= 50 ? repsParam : exercise.targetReps;
  const [frameData, setFrameData] = useState<FrameUpdateData | null>(null);
  const [paused, setPaused] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const engine = useExerciseEngine(exercise.id, exercise.name);

  const startTimeRef = useRef<number>(Date.now());
  const isEndingRef = useRef<boolean>(false);

  const finishSession = (latestData?: FrameUpdateData | null) => {
    const finalData = latestData || frameData;
    const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
    const completedReps = finalData?.repState.completedReps || 0;
    const targetReps = finalData?.repState.targetReps || plannedReps;
    const rom = Math.round(finalData?.romTracker?.rom || 0);

    const record: Omit<SessionRecord, "id" | "date"> = {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      durationSeconds,
      completedReps,
      targetReps,
      minAngle: Math.round(finalData?.romTracker?.minAngle || 0),
      maxAngle: Math.round(finalData?.romTracker?.maxAngle || 160),
      rom,
      averageTempo: finalData?.repState?.tempoTracker?.averageTempo || 2.5,
      goodFormCount: completedReps,
      warningCount: finalData?.repState?.warningCount || 0,
      targetRom: 80,
      targetMet: completedReps >= targetReps,
    };

    const saved = saveSession(record);
    try {
      sessionStorage.setItem("last_completed_session", JSON.stringify(saved));
    } catch {
      /* the summary falls back to the newest saved session */
    }
    // Best effort: copy the session to the account so the therapist and other devices can see it.
    void getToken()
      .then((token) => (token ? syncSessionToDatabase(saved, token) : false))
      .catch(() => false);
    router.push("/session");
  };

  const handleFrameUpdate = useCallback(
    (data: FrameUpdateData) => {
      setFrameData(data);

      if (data.landmarks) {
        engine.processFrame(data.landmarks);
      }

      if (data.repState.completedReps >= data.repState.targetReps && !isEndingRef.current) {
        isEndingRef.current = true;
        setTimeout(() => finishSession(data), 1200);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine]
  );

  const completedReps = frameData?.repState.completedReps ?? 0;
  const targetReps = frameData?.repState.targetReps ?? plannedReps;
  const defaultFeedback: FeedbackMessage = { type: "info", message: "Move slowly and stay in control." };
  const feedback: FeedbackMessage = engine.activeFeedback
    ? { type: "warning", message: engine.activeFeedback }
    : frameData?.feedback ?? defaultFeedback;

  const tracking = describeTracking(frameData?.confidence, exercise.bodySegment);

  return (
    <>
      <FocusFrame
        title={exercise.name}
        subtitle={`${completedReps} of ${targetReps} reps`}
        backLabel="End"
        onBack={() => (completedReps > 0 ? setConfirmEnd(true) : router.push("/exercise"))}
        actions={
          <Button variant="outline" size="sm" onClick={() => setIsGuideOpen(true)}>
            <BookOpen className="size-4" aria-hidden="true" /> Guide
          </Button>
        }
        camera={
          <PoseDetector
            onFrameUpdate={handleFrameUpdate}
            autoStart={true}
            paused={paused}
            targetReps={plannedReps}
            exerciseId={exercise.id}
            bodySegment={exercise.bodySegment}
            incorrectLandmarkIndices={engine.incorrectLandmarkIndices}
            lowConfidenceLandmarkIndices={engine.lowConfidenceLandmarkIndices}
          >
            {paused && (
              <div className="flex size-full items-center justify-center bg-slate-950/55">
                <p className="rounded-lg bg-[var(--paper)] px-5 py-3 text-lg font-bold text-slate-900">Paused</p>
              </div>
            )}
            {!paused && frameData && tracking.kind !== "ready" && (
              <div className="absolute inset-x-3 bottom-3 flex justify-center">
                <p role="status" className="max-w-md rounded-lg bg-[var(--paper)] px-4 py-2.5 text-center text-sm font-semibold text-slate-900 shadow-md">
                  {tracking.detail}
                </p>
              </div>
            )}
          </PoseDetector>
        }
        panel={
          <LivePanel
            completedReps={completedReps}
            targetReps={targetReps}
            feedback={feedback}
            issueCode={engine.activeIssueCode ?? undefined}
            tracking={tracking}
            paused={paused}
            stepIndex={engine.currentStepIndex}
            totalSteps={engine.totalSteps}
            stepTitle={engine.currentStepTitle}
            stepInstruction={engine.currentStepInstruction}
            phase={engine.currentPhase}
            angle={frameData?.jointAngle ?? 0}
            rom={frameData?.romTracker?.rom ?? 0}
            tempo={frameData?.repState?.tempoTracker?.lastRepDuration ?? 0}
            onTogglePause={() => setPaused((p) => !p)}
            onFinish={() => (completedReps >= targetReps ? finishSession(frameData) : setConfirmEnd(true))}
            onOpenGuide={() => setIsGuideOpen(true)}
          />
        }
      />

      <PoseGuidePanel
        isOpen={isGuideOpen}
        onOpenChange={setIsGuideOpen}
        exerciseId={exercise.id}
        exerciseName={exercise.name}
        instructions={exercise.instructions}
      />

      <Dialog
        open={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        title="End this session?"
        description={
          completedReps > 0
            ? `Your ${completedReps} completed ${completedReps === 1 ? "rep is" : "reps are"} saved.`
            : "No reps have been counted yet, so nothing will be saved."
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmEnd(false)}>Keep going</Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmEnd(false);
                if (completedReps > 0) finishSession(frameData);
                else router.push("/exercise");
              }}
            >
              End session
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-700">You can start the exercise again at any time from Today.</p>
      </Dialog>
    </>
  );
}
