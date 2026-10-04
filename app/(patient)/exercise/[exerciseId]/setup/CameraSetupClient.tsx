"use client";

import { useState, useCallback, use, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import PoseDetector, { FrameUpdateData } from "@/components/pose/PoseDetector";
import { getExerciseById } from "@/lib/exercises/registry";
import { ConfidenceCheckResult } from "@/lib/pose/confidence";
import { CheckCircle2, User, Camera, ShieldCheck, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ exerciseId: string }>;
}

function getChecklist(confidence: ConfidenceCheckResult | undefined, bodySegment: string) {
  if (!confidence) {
    if (bodySegment === "neck") return [{ name: "Face", detected: false }, { name: "Shoulders", detected: false }];
    if (bodySegment === "upper")
      return [
        { name: "Shoulder", detected: false },
        { name: "Elbow", detected: false },
        { name: "Wrist", detected: false },
      ];
    return [
      { name: "Hip", detected: false },
      { name: "Knee", detected: false },
      { name: "Ankle", detected: false },
    ];
  }

  if (bodySegment === "neck") {
    return [
      { name: "Face", detected: confidence.joint1Visible },
      { name: "Shoulders", detected: confidence.joint2Visible && confidence.joint3Visible },
    ];
  }
  if (bodySegment === "upper") {
    return [
      { name: "Shoulder", detected: confidence.joint1Visible },
      { name: "Elbow", detected: confidence.joint2Visible },
      { name: "Wrist", detected: confidence.joint3Visible },
    ];
  }
  return [
    { name: "Hip", detected: confidence.joint1Visible },
    { name: "Knee", detected: confidence.joint2Visible },
    { name: "Ankle", detected: confidence.joint3Visible },
  ];
}

function getCameraOverlayMessage(confidence: ConfidenceCheckResult, bodySegment: string) {
  if (confidence.status === "READY") return "Ready to start";
  if (!confidence.personDetected) return "Searching for you...";

  const checklist = getChecklist(confidence, bodySegment);
  const missing = checklist.filter((c) => !c.detected).map((c) => c.name);
  if (missing.length === checklist.length) return "Step into frame";
  return `${missing.join(" & ")} not visible`;
}

function getGuidanceMessage(confidence: ConfidenceCheckResult, bodySegment: string) {
  if (!confidence.personDetected) return "Please stand in front of the camera.";

  if (bodySegment === "lower") {
    if (!confidence.joint3Visible && confidence.joint1Visible)
      return "Move the camera further back or point it down to see your ankle.";
    if (!confidence.joint1Visible && confidence.joint3Visible)
      return "Move the camera back or point it up to see your hip.";
    return "Move back until your full leg is visible in the frame.";
  }

  if (bodySegment === "upper") {
    if (!confidence.joint1Visible) return "Adjust camera so your shoulder is visible.";
    if (!confidence.joint3Visible) return "Step back slightly so your hands/wrists are visible.";
    return "Keep your upper body centered in the frame.";
  }

  if (bodySegment === "neck") {
    if (!confidence.joint1Visible) return "Position camera at eye level.";
    return "Keep your head and shoulders inside the frame.";
  }

  return "Adjust your camera position.";
}

export default function DynamicCameraSetupPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const exercise = getExerciseById(resolvedParams.exerciseId) || getExerciseById("seated-knee-extension")!;
  const router = useRouter();

  const [frameData, setFrameData] = useState<FrameUpdateData | null>(null);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);

  useEffect(() => {
    // Default to full screen on desktop viewports (width >= 768px)
    if (typeof window !== "undefined" && window.innerWidth >= 768) {
      setIsFullScreen(true);
    }
  }, []);

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

  const guidanceText = isNeck
    ? "Sit facing the camera directly."
    : isUpper
    ? "Ensure your upper body is clearly visible."
    : "Place your device far enough back to see your full leg.";

  return (
    <AppShell hideNav showBackNav backHref="/exercise" maxWidth="full">
      {/* ── Outer Container ── */}
      <div className="w-full max-w-lg lg:max-w-7xl mx-auto flex flex-col flex-1 pb-6 lg:pb-2 lg:h-[calc(100vh-100px)]">
        
        {/* Mobile / Minimized Header */}
        {!isFullScreen && (
          <div className="px-4 pt-1 pb-4 lg:hidden">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 leading-tight">
              {exercise.name}
            </h1>
            <p className="text-base text-slate-500 mt-1.5 leading-relaxed max-w-sm">
              {guidanceText}
            </p>
          </div>
        )}

        {/* ── Responsive Workstation Grid ── */}
        <div className="flex flex-col lg:grid lg:grid-cols-12 lg:gap-8 flex-1 lg:items-stretch lg:h-full">
          
          {/* Camera Viewfinder (Full Screen on desktop by default) */}
          <div className="w-full px-4 lg:px-0 lg:col-span-8 flex flex-col flex-1 relative lg:h-full">
            <div className="w-full h-full relative rounded-3xl overflow-hidden shadow-lg border border-slate-200 bg-zinc-950 isolate min-h-[360px] md:min-h-[460px] lg:min-h-0 flex items-center justify-center">
              <PoseDetector
                onFrameUpdate={handleFrameUpdate}
                autoStart={true}
                exerciseId={exercise.id}
                bodySegment={exercise.bodySegment}
                forceFullScreen={isFullScreen}
                onFullScreenChange={setIsFullScreen}
              >
                {/* ── Fullscreen HUD Overlays (Rendered when full screen is active) ── */}
                {isFullScreen ? (
                  <div className="flex flex-col justify-between h-full w-full pointer-events-none p-4 sm:p-6 space-y-4">
                    
                    {/* Top Floating Glass Header */}
                    <div className="flex items-center justify-between gap-4 pointer-events-auto">
                      <div className="flex items-center gap-3">
                        <Link
                          href="/exercise"
                          className="p-2.5 rounded-2xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/20 shadow-lg transition-transform active:scale-95 flex items-center justify-center"
                          title="Back to Exercises"
                        >
                          <ArrowLeft className="w-5 h-5 text-white" />
                        </Link>
                        <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20 shadow-lg">
                          <h2 className="text-sm font-bold text-white tracking-wide">
                            {exercise.name}
                          </h2>
                          <p className="text-xs text-slate-300 font-medium">
                            {guidanceText}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Dynamic Camera Center Banner */}
                    {!isReady && confidence && (
                      <div className="self-center z-20">
                        <div className="bg-black/75 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/20 shadow-xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-4">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                          <span className="text-white text-sm font-semibold tracking-wide whitespace-nowrap">
                            {getCameraOverlayMessage(confidence, exercise.bodySegment)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Frame Guide / Silhouette */}
                    <div
                      className={cn(
                        "absolute inset-8 sm:inset-12 rounded-[28px] border-2 border-dashed pointer-events-none transition-colors duration-700 z-10 flex items-center justify-center",
                        isReady ? "border-emerald-500/40 bg-emerald-500/5" : "border-white/15"
                      )}
                    >
                      {!confidence?.personDetected && (
                        <User className="w-1/4 h-1/4 text-white/10 animate-pulse" />
                      )}
                    </div>

                    {/* Bottom Floating Glass HUD Bar */}
                    <div className="pointer-events-auto max-w-4xl mx-auto w-full bg-black/75 backdrop-blur-xl border border-white/20 p-4 sm:p-5 rounded-3xl shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                      {/* Left: Status & Joint Checklist */}
                      <div className="flex flex-col sm:flex-row items-center gap-3.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "w-3 h-3 rounded-full animate-pulse",
                              isReady
                                ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]"
                                : "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]"
                            )}
                          />
                          <span className="text-sm font-bold text-white tracking-wide">
                            {isReady ? "Ready to start" : "Positioning camera..."}
                          </span>
                        </div>

                        {/* Checklist badges */}
                        <div className="flex items-center gap-2">
                          {getChecklist(confidence, exercise.bodySegment).map((item) => (
                            <div
                              key={item.name}
                              className={cn(
                                "flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold backdrop-blur-sm border transition-all duration-300",
                                item.detected
                                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/50"
                                  : "bg-white/10 text-white/60 border-white/15"
                              )}
                            >
                              {item.detected ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <div className="w-3 h-3 rounded-full border border-white/40" />
                              )}
                              <span>{item.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Right: Start Session CTA */}
                      <Button
                        size="lg"
                        onClick={handleStartExercise}
                        disabled={!isReady}
                        className={cn(
                          "w-full md:w-auto h-12 px-8 text-sm font-bold rounded-2xl shadow-xl transition-all duration-200 cursor-pointer",
                          isReady
                            ? "bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-500/30 hover:scale-102 active:scale-98"
                            : "bg-white/20 text-white/50 cursor-not-allowed shadow-none hover:bg-white/20"
                        )}
                      >
                        {isReady ? (
                          <span className="flex items-center gap-2">
                            Start Session <ArrowRight className="w-4 h-4" />
                          </span>
                        ) : (
                          "Awaiting position..."
                        )}
                      </Button>
                    </div>

                  </div>
                ) : (
                  /* ── Normal Embedded Overlays (Rendered when minimized or on mobile) ── */
                  <>
                    <div
                      className={cn(
                        "absolute inset-5 rounded-[24px] border-2 border-dashed pointer-events-none transition-colors duration-700 z-10 flex items-center justify-center",
                        isReady ? "border-emerald-500/40 bg-emerald-500/5" : "border-white/15"
                      )}
                    >
                      {!confidence?.personDetected && (
                        <User className="w-1/3 h-1/3 text-white/10 animate-pulse" />
                      )}
                    </div>

                    {!isReady && confidence && (
                      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20">
                        <div className="bg-black/70 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                          <span className="text-white/95 text-xs sm:text-sm font-medium tracking-wide whitespace-nowrap">
                            {getCameraOverlayMessage(confidence, exercise.bodySegment)}
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </PoseDetector>
            </div>
          </div>

          {/* Right Column (Only visible when NOT in full screen, e.g. on mobile or minimized) */}
          {!isFullScreen && (
            <div className="flex-1 lg:flex-none lg:col-span-4 flex flex-col justify-between px-4 lg:px-6 lg:py-6 mt-6 lg:mt-0 space-y-6 lg:bg-white lg:rounded-3xl lg:border lg:border-slate-200/90 lg:shadow-xs lg:h-full">
              
              <div className="hidden lg:block space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200/60">
                  <Camera className="w-3.5 h-3.5" />
                  <span>Webcam Calibration</span>
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 leading-tight">
                  {exercise.name}
                </h1>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {guidanceText}
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2.5">
                    {isReady ? (
                      <><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" /> Ready to start</>
                    ) : (
                      <><span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]" /> Positioning camera...</>
                    )}
                  </h3>
                </div>

                <div className="flex flex-wrap gap-2">
                  {getChecklist(confidence, exercise.bodySegment).map((item) => (
                    <div
                      key={item.name}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-300",
                        item.detected
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                          : "bg-slate-50 text-slate-500 border border-slate-200"
                      )}
                    >
                      {item.detected ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-slate-300" />
                      )}
                      {item.name}
                    </div>
                  ))}
                </div>

                <div className="min-h-[24px]">
                  {!isReady && confidence?.personDetected && (
                    <p className="text-sm text-slate-600 animate-in fade-in duration-300">
                      {getGuidanceMessage(confidence, exercise.bodySegment)}
                    </p>
                  )}
                  {isReady && (
                    <p className="text-sm text-emerald-600 font-medium flex items-center gap-1.5 animate-in fade-in duration-300">
                      <ShieldCheck className="w-4 h-4" /> Position verified. Press Start Session to begin.
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-2">
                <Button
                  size="lg"
                  onClick={handleStartExercise}
                  disabled={!isReady}
                  className={cn(
                    "w-full h-14 text-base font-semibold transition-all duration-300 shadow-xl rounded-2xl cursor-pointer",
                    isReady
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25 active:scale-98"
                      : "bg-slate-100 text-slate-400 opacity-90 cursor-not-allowed shadow-none hover:bg-slate-100"
                  )}
                >
                  {isReady ? (
                    <span className="flex items-center justify-center gap-2">
                      Start Session <ArrowRight className="w-5 h-5" />
                    </span>
                  ) : (
                    "Awaiting position..."
                  )}
                </Button>
              </div>

            </div>
          )}

        </div>
      </div>
    </AppShell>
  );
}
