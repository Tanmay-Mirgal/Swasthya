"use client";

import { useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/navigation/AppShell";
import PoseDetector, { FrameUpdateData } from "@/components/pose/PoseDetector";
import { getExerciseById } from "@/lib/exercises/registry";

interface PageProps {
  params: Promise<{ exerciseId: string }>;
}

export default function DynamicCameraSetupPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const exercise = getExerciseById(resolvedParams.exerciseId) || getExerciseById("seated-knee-extension")!;
  const router = useRouter();

  const [frameData, setFrameData] = useState<FrameUpdateData | null>(null);
  const [isFullScreenMode, setIsFullScreenMode] = useState<boolean>(false);

  const handleFrameUpdate = useCallback((data: FrameUpdateData) => {
    setFrameData(data);
  }, []);

  const confidence = frameData?.confidence;
  const isReady = confidence?.status === "READY";
  const isUpper = exercise.bodySegment === "upper";

  const handleStartExercise = () => {
    router.push(`/exercise/${exercise.id}/live`);
  };

  return (
    <AppShell title={exercise.name} showBackNav backHref="/exercise">
      <div className="space-y-4 pt-1 flex flex-col flex-1">
        {/* Instruction Guidance */}
        <div className="space-y-1">
          <h2 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-50">
            Camera Setup
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {isUpper
              ? "Position yourself so your upper body, shoulder, elbow, and wrist are visible in frame."
              : "Position your phone so your upper body, hip, knee, and ankle are clearly visible in the frame."}
          </p>
        </div>

        {/* Live Camera Viewport */}
        <div className="w-full relative">
          <PoseDetector
            onFrameUpdate={handleFrameUpdate}
            autoStart={true}
            exerciseId={exercise.id}
            bodySegment={exercise.bodySegment}
            forceFullScreen={isFullScreenMode}
          >
            {isFullScreenMode && (
              <div className="flex flex-col justify-between h-full w-full pointer-events-none p-3 space-y-4">
                {/* Top HUD */}
                <div className="flex items-center justify-between gap-2 bg-black/60 backdrop-blur-md p-3 rounded-2xl border border-white/10 pointer-events-auto shadow-2xl">
                  <span className="text-xs font-extrabold text-white uppercase tracking-wider">
                    Camera Positioning Setup
                  </span>
                  <button
                    onClick={() => setIsFullScreenMode(false)}
                    className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-semibold backdrop-blur transition-all"
                  >
                    Exit Fullscreen
                  </button>
                </div>

                {/* Bottom HUD */}
                <div className="space-y-3 pointer-events-auto">
                  <div
                    className={`p-3 rounded-xl border text-center text-xs font-semibold backdrop-blur-md ${
                      isReady
                        ? "bg-emerald-950/80 text-emerald-300 border-emerald-800"
                        : "bg-amber-950/80 text-amber-300 border-amber-800"
                    }`}
                  >
                    {isReady ? "✓ Camera ready! You can start the exercise." : confidence?.message || "Adjusting camera..."}
                  </div>
                  <button
                    onClick={handleStartExercise}
                    className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base text-center block rounded-2xl transition-all shadow-lg"
                  >
                    Start Exercise &rarr;
                  </button>
                </div>
              </div>
            )}
          </PoseDetector>
        </div>

        {/* Live Confidence Checklist */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 space-y-2.5 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Visibility Check ({exercise.category})
          </h3>

          <div className="space-y-2 text-xs font-semibold">
            <div className="flex items-center gap-2">
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  confidence?.personDetected
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                    : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800"
                }`}
              >
                {confidence?.personDetected ? "✓" : "•"}
              </span>
              <span className={confidence?.personDetected ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400"}>
                Person detected
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  confidence?.joint1Visible && confidence?.joint2Visible
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                    : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800"
                }`}
              >
                {confidence?.joint1Visible && confidence?.joint2Visible ? "✓" : "•"}
              </span>
              <span className={confidence?.joint1Visible && confidence?.joint2Visible ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400"}>
                {isUpper ? "Shoulder & Elbow visible" : "Hip & Knee visible"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  confidence?.joint3Visible
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                    : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800"
                }`}
              >
                {confidence?.joint3Visible ? "✓" : "•"}
              </span>
              <span className={confidence?.joint3Visible ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400"}>
                {isUpper ? "Wrist visible" : "Ankle visible"}
              </span>
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div
          className={`p-3 rounded-xl border text-center text-xs font-semibold ${
            isReady
              ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
              : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
          }`}
        >
          {isReady ? "✓ Camera ready! You can start the exercise." : confidence?.message || "Adjusting camera..."}
        </div>

        {/* Start Exercise CTA */}
        <div className="mt-auto pt-2 grid grid-cols-2 gap-3">
          <button
            onClick={() => setIsFullScreenMode((prev) => !prev)}
            className="py-4 px-4 bg-emerald-600/10 dark:bg-emerald-950/40 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-bold text-xs rounded-2xl text-center shadow-sm transition-all flex items-center justify-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            <span>Full Screen Cam</span>
          </button>

          <button
            onClick={handleStartExercise}
            className="py-4 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold text-sm text-center block rounded-2xl transition-all shadow-md cursor-pointer"
          >
            Start Exercise &rarr;
          </button>
        </div>
      </div>
    </AppShell>
  );
}
