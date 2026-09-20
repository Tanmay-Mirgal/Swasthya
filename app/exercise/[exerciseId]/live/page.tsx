"use client";

import { useState, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/navigation/AppShell";
import PoseDetector, { FrameUpdateData } from "@/components/pose/PoseDetector";
import RepCounter from "@/components/exercise/RepCounter";
import LiveMetrics from "@/components/exercise/LiveMetrics";
import FeedbackBanner from "@/components/exercise/FeedbackBanner";
import { getExerciseById } from "@/lib/exercises/registry";
import { saveSession } from "@/lib/session/sessionStore";
import { FeedbackMessage } from "@/lib/exercises/types";

interface PageProps {
  params: Promise<{ exerciseId: string }>;
}

export default function DynamicLiveExercisePage({ params }: PageProps) {
  const resolvedParams = use(params);
  const exercise = getExerciseById(resolvedParams.exerciseId) || getExerciseById("seated-knee-extension")!;

  const router = useRouter();
  const [frameData, setFrameData] = useState<FrameUpdateData | null>(null);

  const startTimeRef = useRef<number>(Date.now());
  const isEndingRef = useRef<boolean>(false);

  const handleFrameUpdate = useCallback((data: FrameUpdateData) => {
    setFrameData(data);

    if (
      data.repState.completedReps >= data.repState.targetReps &&
      !isEndingRef.current
    ) {
      isEndingRef.current = true;
      setTimeout(() => {
        finishSession(data);
      }, 1000);
    }
  }, []);

  const finishSession = (latestData?: FrameUpdateData | null) => {
    const data = latestData || frameData;
    const durationSeconds = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));

    const record = saveSession({
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      targetReps: data?.repState.targetReps || exercise.targetReps,
      completedReps: data?.repState.completedReps || 0,
      minAngle: data?.romTracker.minAngle || 0,
      maxAngle: data?.romTracker.maxAngle || 0,
      rom: data?.romTracker.rom || 0,
      averageTempo: data?.repState.tempoTracker.averageTempo || 0,
      goodFormCount: data?.repState.goodFormCount || 0,
      warningCount: data?.repState.warningCount || 0,
      durationSeconds,
    });

    if (typeof window !== "undefined") {
      sessionStorage.setItem("last_completed_session", JSON.stringify(record));
    }

    router.push("/session");
  };

  const defaultFeedback: FeedbackMessage = {
    type: "info",
    message: "Initializing camera...",
  };

  const completedReps = frameData?.repState.completedReps ?? 0;
  const targetReps = frameData?.repState.targetReps ?? exercise.targetReps;
  const jointAngle = frameData?.jointAngle ?? 0;
  const rom = frameData?.romTracker.rom ?? 0;
  const tempo = frameData?.repState.tempoTracker.averageTempo ?? 0;
  const feedback = frameData?.feedback ?? defaultFeedback;

  return (
    <AppShell title={exercise.name} showBackNav backHref="/exercise" hideNav>
      <div className="space-y-4 flex flex-col flex-1 pb-4">
        {/* Rep Counter Banner */}
        <RepCounter completedReps={completedReps} targetReps={targetReps} />

        {/* Live Camera + Pose Skeleton Overlay */}
        <div className="w-full">
          <PoseDetector
            onFrameUpdate={handleFrameUpdate}
            autoStart={true}
            targetReps={exercise.targetReps}
            exerciseId={exercise.id}
            bodySegment={exercise.bodySegment}
          />
        </div>

        {/* Live Priority Feedback Banner */}
        <FeedbackBanner feedback={feedback} />

        {/* Live Biomechanical Metrics */}
        <LiveMetrics kneeAngle={jointAngle} rom={rom} tempo={tempo} />

        {/* End Session Button */}
        <div className="mt-auto pt-2">
          <button
            onClick={() => finishSession(frameData)}
            className="w-full py-3.5 px-4 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-sm rounded-xl text-center shadow-md transition-all dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            End Session
          </button>
        </div>
      </div>
    </AppShell>
  );
}
