/* eslint-disable react-hooks/immutability */
/* eslint-disable react-hooks/purity */
"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/navigation/AppShell";
import PoseDetector, { FrameUpdateData } from "@/components/pose/PoseDetector";
import RepCounter from "@/components/exercise/RepCounter";
import LiveMetrics from "@/components/exercise/LiveMetrics";
import FeedbackBanner from "@/components/exercise/FeedbackBanner";
import { getExerciseById } from "@/lib/exercises/registry";
import { saveSession } from "@/lib/session/sessionStore";
import { FeedbackMessage, SessionRecord } from "@/lib/exercises/types";
import PoseGuidePanel from "@/components/exercise/PoseGuidePanel";
import { useExerciseEngine } from "@/hooks/useExerciseEngine";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Maximize, Minimize, BookOpen } from "lucide-react";

interface PageProps {
  params: Promise<{ exerciseId: string }>;
}

export default function DynamicLiveExercisePage({ params }: PageProps) {
  const resolvedParams = use(params);
  const exercise = getExerciseById(resolvedParams.exerciseId) || getExerciseById("seated-knee-extension")!;

  const router = useRouter();
  const [frameData, setFrameData] = useState<FrameUpdateData | null>(null);
  const [isFullScreenMode, setIsFullScreenMode] = useState<boolean>(false);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);

  useEffect(() => {
    // Default to full screen on desktop viewports (width >= 768px)
    if (typeof window !== "undefined" && window.innerWidth >= 768) {
      setIsFullScreenMode(true);
    }
  }, []);

  const engine = useExerciseEngine(exercise.id, exercise.name);

  const startTimeRef = useRef<number>(Date.now());
  const isEndingRef = useRef<boolean>(false);

  const handleFrameUpdate = useCallback(
    (data: FrameUpdateData) => {
      setFrameData(data);

      if (data.landmarks) {
        engine.processFrame(data.landmarks);
      }

      if (
        data.repState.completedReps >= data.repState.targetReps &&
        !isEndingRef.current
      ) {
        isEndingRef.current = true;
        setTimeout(() => {
          finishSession(data);
        }, 1000);
      }
    },
    [engine]
  );

  const finishSession = (latestData?: FrameUpdateData | null) => {
    const finalData = latestData || frameData;
    const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
    const completedReps = finalData?.repState.completedReps || 0;
    const targetReps = finalData?.repState.targetReps || exercise.targetReps;
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

    saveSession(record);
    router.push(`/exercise/${exercise.id}/summary`);
  };

  const completedReps = frameData?.repState.completedReps ?? 0;
  const targetReps = frameData?.repState.targetReps ?? exercise.targetReps;
  const jointAngle = Math.round(frameData?.jointAngle ?? 0);
  const rom = Math.round(frameData?.romTracker?.rom ?? 0);
  const tempo = frameData?.repState?.tempoTracker?.lastRepDuration ?? 0;

  const defaultFeedback: FeedbackMessage = {
    type: "info",
    message: "Maintain controlled motion",
  };

  const feedback: FeedbackMessage = engine.activeFeedback
    ? { type: "warning", message: engine.activeFeedback }
    : (frameData?.feedback ?? defaultFeedback);

  return (
    <AppShell
      title={exercise.name}
      showBackNav
      backHref="/exercise"
      hideNav
      maxWidth="full"
      rightAction={
        <button
          onClick={() => setIsGuideOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer"
          title="View Exercise Guide"
        >
          <BookOpen className="w-3.5 h-3.5 text-blue-600" />
          <span>Guide</span>
        </button>
      }
    >
      <div className="w-full max-w-lg lg:max-w-7xl mx-auto flex flex-col flex-1 pb-4">
        
        {/* Desktop 2-Column Workstation Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Main Camera Viewfinder (Left 8 cols on desktop) */}
          <div className="lg:col-span-8 flex flex-col space-y-4">
            
            {/* Live Camera Overlay */}
            <div className="w-full relative rounded-3xl overflow-hidden shadow-md border border-slate-200 bg-black min-h-[380px] lg:min-h-[540px] flex items-center justify-center">
              <PoseDetector
                onFrameUpdate={handleFrameUpdate}
                autoStart={true}
                targetReps={exercise.targetReps}
                exerciseId={exercise.id}
                bodySegment={exercise.bodySegment}
                forceFullScreen={isFullScreenMode}
                onFullScreenChange={setIsFullScreenMode}
                incorrectLandmarkIndices={engine.incorrectLandmarkIndices}
                lowConfidenceLandmarkIndices={engine.lowConfidenceLandmarkIndices}
              >
                {/* Floating HUD during Fullscreen */}
                {isFullScreenMode && (
                  <div className="flex flex-col justify-between h-full w-full pointer-events-none p-4 space-y-4">
                    <div className="flex items-center justify-between gap-2 bg-white/90 backdrop-blur-md p-3 rounded-xl border border-slate-200 pointer-events-auto shadow-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider">{exercise.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-700 mr-1">
                          {completedReps} / {targetReps} reps
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsGuideOpen(true)}
                          className="bg-white/80"
                        >
                          <BookOpen className="w-3.5 h-3.5 mr-1 text-blue-600" /> Guide
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsFullScreenMode(false)}
                        >
                          <Minimize className="w-3 h-3 mr-1" /> Exit
                        </Button>
                      </div>
                    </div>

                    <div className="pointer-events-auto max-w-md mx-auto w-full">
                      <FeedbackBanner feedback={feedback} issueCode={engine.activeIssueCode ?? undefined} isLoading={engine.feedbackLoading} />
                    </div>

                    <div className="space-y-3 pointer-events-auto">
                      <div className="bg-white/90 backdrop-blur-md p-3 rounded-xl border border-slate-200 shadow-sm">
                        <LiveMetrics kneeAngle={jointAngle} rom={rom} tempo={tempo} />
                      </div>
                      <Button size="lg" className="w-full" onClick={() => finishSession(frameData)}>
                        Finish Session
                      </Button>
                    </div>
                  </div>
                )}
              </PoseDetector>
            </div>

            {/* Desktop Action Controls under camera */}
            {!isFullScreenMode && (
              <div className="hidden lg:flex items-center justify-between gap-3 pt-1">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setIsFullScreenMode((prev) => !prev)}
                  className="rounded-xl text-xs font-semibold"
                >
                  <Maximize className="w-4 h-4 mr-2" />
                  Full Screen View
                </Button>

                <Button
                  variant="primary"
                  size="md"
                  onClick={() => finishSession(frameData)}
                  className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs"
                >
                  End & Save Session
                </Button>
              </div>
            )}
          </div>

          {/* Right Column (4 cols on desktop): Reps, Guide, Feedback, Metrics */}
          {!isFullScreenMode && (
            <div className="lg:col-span-4 flex flex-col space-y-4">
              
              {/* Rep Counter */}
              <RepCounter completedReps={completedReps} targetReps={targetReps} />

              {/* Live Step Guidance */}
              <Card className="rounded-2xl border-slate-200 shadow-2xs">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="shrink-0 w-8 h-8 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold flex items-center justify-center">
                    {engine.currentStepIndex + 1}/{engine.totalSteps}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900 truncate">
                        {engine.currentStepTitle}
                      </h3>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100 uppercase tracking-widest shrink-0">
                        {engine.currentPhase}
                      </span>
                    </div>
                    {engine.currentStepInstruction && (
                      <p className="text-sm text-slate-500 mt-1 leading-snug">
                        {engine.currentStepInstruction}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Feedback Banner */}
              <FeedbackBanner feedback={feedback} issueCode={engine.activeIssueCode ?? undefined} isLoading={engine.feedbackLoading} />

              {/* Biomechanical Metrics */}
              <LiveMetrics kneeAngle={jointAngle} rom={rom} tempo={tempo} />

              {/* Mobile Only Action Controls */}
              <div className="lg:hidden mt-auto pt-2 grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setIsFullScreenMode((prev) => !prev)}
                >
                  <Maximize className="w-4 h-4 mr-2" />
                  Full Screen
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => finishSession(frameData)}
                >
                  End Session
                </Button>
              </div>

            </div>
          )}

        </div>

        {/* Exercise Guide Modal Panel */}
        <PoseGuidePanel
          isOpen={isGuideOpen}
          onOpenChange={setIsGuideOpen}
          exerciseId={exercise.id}
          exerciseName={exercise.name}
          instructions={exercise.instructions}
        />
      </div>
    </AppShell>
  );
}
