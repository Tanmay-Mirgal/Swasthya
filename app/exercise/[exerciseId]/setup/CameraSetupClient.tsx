"use client";

import { useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/navigation/AppShell";
import PoseDetector, { FrameUpdateData } from "@/components/pose/PoseDetector";
import { getExerciseById } from "@/lib/exercises/registry";
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  Play,
  Maximize2,
} from "lucide-react";

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
  const isNeck = exercise.bodySegment === "neck";

  const handleStartExercise = () => {
    router.push(`/exercise/${exercise.id}/live`);
  };

  return (
    <AppShell title={exercise.name} showBackNav backHref="/exercise">
      <div className="space-y-4 pt-1 flex flex-col flex-1">
        {/* Instruction Guidance Header Card */}
        <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-4 shadow-xl backdrop-blur-xl space-y-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <Camera className="w-4 h-4" />
            </div>
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-emerald-400">
              Camera Positioning Guide
            </h2>
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed">
            {isNeck
              ? "Sit facing the camera directly. Ensure nose and both shoulders are visible in frame."
              : isUpper
              ? "Position yourself so shoulder, elbow, and wrist are clearly visible."
              : "Position device 1.5–2.5m away so full leg, hip, knee, and ankle are in frame."}
          </p>
        </div>

        {/* Live Camera Viewport */}
        <div className="w-full relative rounded-2xl overflow-hidden shadow-2xl border border-zinc-800">
          <PoseDetector
            onFrameUpdate={handleFrameUpdate}
            autoStart={true}
            exerciseId={exercise.id}
            bodySegment={exercise.bodySegment}
            forceFullScreen={isFullScreenMode}
          >
            {isFullScreenMode && (
              <div className="flex flex-col justify-between h-full w-full pointer-events-none p-4 space-y-4">
                {/* Top HUD */}
                <div className="flex items-center justify-between gap-2 bg-black/70 backdrop-blur-xl p-3.5 rounded-2xl border border-white/10 pointer-events-auto shadow-2xl">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-black text-white uppercase tracking-wider">
                      Positioning Mode
                    </span>
                  </div>
                  <button
                    onClick={() => setIsFullScreenMode(false)}
                    className="px-3.5 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold backdrop-blur transition-all"
                  >
                    Exit Fullscreen
                  </button>
                </div>

                {/* Bottom HUD */}
                <div className="space-y-3 pointer-events-auto">
                  <div
                    className={`p-3.5 rounded-2xl border text-center text-xs font-bold backdrop-blur-xl shadow-xl flex items-center justify-center gap-2 ${
                      isReady
                        ? "bg-emerald-950/90 text-emerald-300 border-emerald-500/50 shadow-[0_0_25px_rgba(16,185,129,0.2)]"
                        : "bg-amber-950/90 text-amber-300 border-amber-500/50"
                    }`}
                  >
                    {isReady ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Camera ready! You can begin the session.</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
                        <span>{confidence?.message || "Adjusting camera positioning..."}</span>
                      </>
                    )}
                  </div>
                  <button
                    onClick={handleStartExercise}
                    className="w-full py-4 px-6 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-base text-center block rounded-2xl transition-all shadow-xl shadow-emerald-950/50"
                  >
                    Start Session &rarr;
                  </button>
                </div>
              </div>
            )}
          </PoseDetector>
        </div>

        {/* Live Confidence Checklist */}
        <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-4 space-y-3 shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">
              Landmark Checklist ({exercise.category})
            </h3>
            {isReady && (
              <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800">
                100% READY
              </span>
            )}
          </div>

          <div className="space-y-2.5 text-xs font-semibold">
            {/* Check 1: Person Detected */}
            <div className="flex items-center gap-2.5">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  confidence?.personDetected
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                    : "bg-zinc-800 text-zinc-500 border border-zinc-700/60"
                }`}
              >
                {confidence?.personDetected ? "✓" : "•"}
              </div>
              <span className={confidence?.personDetected ? "text-zinc-200" : "text-zinc-500"}>
                Person detected in frame
              </span>
            </div>

            {/* Check 2: Joint 1/2 */}
            <div className="flex items-center gap-2.5">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  confidence?.joint1Visible && confidence?.joint2Visible
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                    : "bg-zinc-800 text-zinc-500 border border-zinc-700/60"
                }`}
              >
                {confidence?.joint1Visible && confidence?.joint2Visible ? "✓" : "•"}
              </div>
              <span
                className={
                  confidence?.joint1Visible && confidence?.joint2Visible
                    ? "text-zinc-200"
                    : "text-zinc-500"
                }
              >
                {isNeck ? "Nose & Left Shoulder visible" : isUpper ? "Shoulder & Elbow visible" : "Hip & Knee visible"}
              </span>
            </div>

            {/* Check 3: Joint 3 */}
            <div className="flex items-center gap-2.5">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  confidence?.joint3Visible
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                    : "bg-zinc-800 text-zinc-500 border border-zinc-700/60"
                }`}
              >
                {confidence?.joint3Visible ? "✓" : "•"}
              </div>
              <span className={confidence?.joint3Visible ? "text-zinc-200" : "text-zinc-500"}>
                {isNeck ? "Right Shoulder visible" : isUpper ? "Wrist visible" : "Ankle visible"}
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Status Banner */}
        <div
          className={`p-3.5 rounded-2xl border text-center text-xs font-bold backdrop-blur-xl flex items-center justify-center gap-2 transition-all ${
            isReady
              ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
              : "bg-amber-950/80 text-amber-300 border-amber-500/40"
          }`}
        >
          {isReady ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Camera ready! Click Start to begin tracking.</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
              <span>{confidence?.message || "Adjusting camera setup..."}</span>
            </>
          )}
        </div>

        {/* Action Button Controls */}
        <div className="mt-auto pt-2 grid grid-cols-2 gap-3">
          <button
            onClick={() => setIsFullScreenMode((prev) => !prev)}
            className="py-3.5 px-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 font-bold text-xs rounded-2xl text-center shadow-md transition-all flex items-center justify-center gap-2"
          >
            <Maximize2 className="w-4 h-4 text-emerald-400" />
            <span>Fullscreen</span>
          </button>

          <button
            onClick={handleStartExercise}
            className="py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 active:scale-95 text-white font-extrabold text-xs text-center rounded-2xl transition-all shadow-lg flex items-center justify-center gap-1.5"
          >
            <span>Start Session</span>
            <Play className="w-3.5 h-3.5 fill-current" />
          </button>
        </div>
      </div>
    </AppShell>
  );
}
