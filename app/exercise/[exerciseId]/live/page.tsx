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
  const [isFullScreenMode, setIsFullScreenMode] = useState<boolean>(false);

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
        <div className="w-full relative">
          <PoseDetector
            onFrameUpdate={handleFrameUpdate}
            autoStart={true}
            targetReps={exercise.targetReps}
            exerciseId={exercise.id}
            bodySegment={exercise.bodySegment}
            forceFullScreen={isFullScreenMode}
          >
            {/* Floating HUD displayed inside camera view during Fullscreen */}
            {isFullScreenMode && (
              <div className="flex flex-col justify-between h-full w-full pointer-events-none p-3 space-y-4">
                {/* Top HUD: Floating Header */}
                <div className="flex items-center justify-between gap-2 bg-black/60 backdrop-blur-md p-3 rounded-2xl border border-white/10 pointer-events-auto shadow-2xl">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-extrabold text-white uppercase tracking-wider">{exercise.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black font-mono text-emerald-400">
                      {completedReps} / {targetReps} reps
                    </span>
                    <button
                      onClick={() => setIsFullScreenMode(false)}
                      className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-semibold backdrop-blur transition-all"
                    >
                      Exit Fullscreen
                    </button>
                  </div>
                </div>

                {/* Center HUD: Live Feedback */}
                <div className="pointer-events-auto max-w-md mx-auto w-full">
                  <FeedbackBanner feedback={feedback} />
                </div>

                {/* Bottom HUD: Live Metrics + Action Button */}
                <div className="space-y-3 pointer-events-auto">
                  <div className="bg-black/60 backdrop-blur-md p-3 rounded-2xl border border-white/10">
                    <LiveMetrics kneeAngle={jointAngle} rom={rom} tempo={tempo} />
                  </div>
                  <button
                    onClick={() => finishSession(frameData)}
                    className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl text-center shadow-lg transition-all"
                  >
                    Finish Session
                  </button>
                </div>
              </div>
            )}
          </PoseDetector>
        </div>

        {/* Live Priority Feedback Banner */}
        <FeedbackBanner feedback={feedback} />

        {/* Live Biomechanical Metrics */}
        <LiveMetrics kneeAngle={jointAngle} rom={rom} tempo={tempo} />

        {/* Action Controls */}
        <div className="mt-auto pt-2 grid grid-cols-2 gap-3">
          <button
            onClick={() => setIsFullScreenMode((prev) => !prev)}
            className="py-3.5 px-4 bg-emerald-600/10 dark:bg-emerald-950/40 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-bold text-xs rounded-xl text-center shadow-sm transition-all flex items-center justify-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            <span>Full Screen Cam</span>
          </button>

          <button
            onClick={() => finishSession(frameData)}
            className="py-3.5 px-4 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs rounded-xl text-center shadow-md transition-all dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            End Session
          </button>
        </div>
      </div>
    </AppShell>
  );
}
