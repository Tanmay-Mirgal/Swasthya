"use client";

import { useState, useCallback, use, useMemo } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/navigation/AppShell";
import PoseDetector, { FrameUpdateData } from "@/components/pose/PoseDetector";
import { getExerciseById } from "@/lib/exercises/registry";
import { ConfidenceCheckResult } from "@/lib/pose/confidence";
import { CheckCircle2, User } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ exerciseId: string }>;
}

function getChecklist(confidence: ConfidenceCheckResult | undefined, bodySegment: string) {
  if (!confidence) {
    if (bodySegment === "neck") return [{name: "Face", detected: false}, {name: "Shoulders", detected: false}];
    if (bodySegment === "upper") return [{name: "Shoulder", detected: false}, {name: "Elbow", detected: false}, {name: "Wrist", detected: false}];
    return [{name: "Hip", detected: false}, {name: "Knee", detected: false}, {name: "Ankle", detected: false}];
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
  const missing = checklist.filter(c => !c.detected).map(c => c.name);
  if (missing.length === checklist.length) return "Step into frame";
  return `${missing.join(" & ")} not visible`;
}

function getGuidanceMessage(confidence: ConfidenceCheckResult, bodySegment: string) {
  if (!confidence.personDetected) return "Please stand in front of the camera.";
  
  if (bodySegment === "lower") {
    if (!confidence.joint3Visible && confidence.joint1Visible) return "Move the camera further back or point it down to see your ankle.";
    if (!confidence.joint1Visible && confidence.joint3Visible) return "Move the camera back or point it up to see your hip.";
    return "Move back until your full leg is visible in the frame.";
  }
  
  if (bodySegment === "upper") {
    return "Ensure your shoulder, elbow, and wrist are fully visible.";
  }
  
  if (bodySegment === "neck") {
    return "Sit straight, facing the camera so your face and shoulders are clear.";
  }
  
  return "Adjust your camera position.";
}

export default function DynamicCameraSetupPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const exercise = getExerciseById(resolvedParams.exerciseId) || getExerciseById("seated-knee-extension")!;
  const router = useRouter();

  const [frameData, setFrameData] = useState<FrameUpdateData | null>(null);

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
    <AppShell hideNav showBackNav backHref="/exercise">
      <div className="flex flex-col h-full flex-1 pb-6 w-full max-w-lg mx-auto">
        
        {/* 1. Header Area */}
        <div className="px-4 pt-2 pb-5">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 leading-tight">
            {exercise.name}
          </h1>
          <p className="text-base text-slate-500 mt-1.5 leading-relaxed max-w-sm">
            {isNeck 
              ? "Sit facing the camera directly." 
              : isUpper 
              ? "Ensure your upper body is clearly visible." 
              : "Place your device far enough back to see your full leg."}
          </p>
        </div>

        {/* 2. Camera Hero */}
        <div className="px-4 flex-shrink-0 relative">
          <div className="w-full relative rounded-3xl overflow-hidden shadow-lg border border-slate-200 bg-zinc-950 isolate">
            <PoseDetector
              onFrameUpdate={handleFrameUpdate}
              autoStart={true}
              exerciseId={exercise.id}
              bodySegment={exercise.bodySegment}
            >
              {/* Frame Guide / Silhouette */}
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

              {/* Dynamic Camera Overlay Banner */}
              {!isReady && confidence && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20">
                  <div className="bg-black/70 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-white/95 text-sm font-medium tracking-wide whitespace-nowrap">
                      {getCameraOverlayMessage(confidence, exercise.bodySegment)}
                    </span>
                  </div>
                </div>
              )}
            </PoseDetector>
          </div>
        </div>

        {/* 3. Status and Actions Area */}
        <div className="flex-1 flex flex-col justify-end px-4 mt-8 space-y-6">
          
          {/* Dynamic Status / Checklist */}
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

            {/* Checklist */}
            <div className="flex flex-wrap gap-2">
              {getChecklist(confidence, exercise.bodySegment).map(item => (
                <div 
                  key={item.name} 
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-300",
                    item.detected 
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60" 
                      : "bg-slate-50 text-slate-500 border border-slate-200"
                  )}
                >
                  {item.detected 
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> 
                    : <div className="w-4 h-4 rounded-full border-2 border-slate-300" />}
                  {item.name}
                </div>
              ))}
            </div>

            {/* Guidance Text */}
            <div className="min-h-[24px]">
              {!isReady && confidence?.personDetected && (
                <p className="text-sm text-slate-600 animate-in fade-in duration-300">
                  {getGuidanceMessage(confidence, exercise.bodySegment)}
                </p>
              )}
            </div>

          </div>

          {/* Primary CTA */}
          <Button
            size="lg"
            onClick={handleStartExercise}
            disabled={!isReady}
            className={cn(
              "w-full h-14 text-base font-semibold transition-all duration-300 shadow-xl rounded-2xl",
              isReady 
                ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20" 
                : "bg-slate-100 text-slate-400 opacity-90 cursor-not-allowed shadow-none hover:bg-slate-100"
            )}
          >
            {isReady ? "Start Session" : "Awaiting position..."}
          </Button>

        </div>
      </div>
    </AppShell>
  );
}
