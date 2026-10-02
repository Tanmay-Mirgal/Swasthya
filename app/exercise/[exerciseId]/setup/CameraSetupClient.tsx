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
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

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
      <div className="space-y-4 flex flex-col flex-1 pb-4">
        {/* Instruction Guidance Header Card */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-slate-700" />
              <h2 className="text-sm font-semibold text-slate-900">
                Camera Setup
              </h2>
            </div>
            <p className="text-sm text-slate-500">
              {isNeck
                ? "Sit facing the camera directly. Ensure your head and shoulders are visible."
                : isUpper
                ? "Position yourself so your shoulder, elbow, and wrist are clearly visible."
                : "Position your device 1.5–2.5 meters away so your full leg is in frame."}
            </p>
          </CardContent>
        </Card>

        {/* Live Camera Viewport */}
        <div className="w-full relative rounded-2xl overflow-hidden shadow-sm border border-slate-200">
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
                <div className="flex items-center justify-between bg-white/90 backdrop-blur-md p-3 rounded-xl border border-slate-200 pointer-events-auto">
                  <span className="text-sm font-medium text-slate-900">
                    Camera Setup
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsFullScreenMode(false)}
                  >
                    Exit Fullscreen
                  </Button>
                </div>

                {/* Bottom HUD */}
                <div className="space-y-3 pointer-events-auto">
                  <div
                    className={`p-3 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 ${
                      isReady
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}
                  >
                    {isReady ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Ready to begin</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 animate-pulse" />
                        <span>{confidence?.message || "Adjusting camera..."}</span>
                      </>
                    )}
                  </div>
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={handleStartExercise}
                  >
                    Start Session
                  </Button>
                </div>
              </div>
            )}
          </PoseDetector>
        </div>

        {/* Dynamic Status Banner */}
        <div
          className={`p-4 rounded-2xl border text-sm font-medium flex items-center gap-3 transition-colors ${
            isReady
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-amber-50 text-amber-700 border-amber-200"
          }`}
        >
          {isReady ? (
            <>
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>Camera ready. You can begin the session.</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{confidence?.message || "Position yourself in frame..."}</span>
            </>
          )}
        </div>

        {/* Action Button Controls */}
        <div className="mt-auto grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            size="lg"
            onClick={() => setIsFullScreenMode((prev) => !prev)}
            className="w-full"
          >
            <Maximize2 className="w-4 h-4 mr-2" />
            Fullscreen
          </Button>

          <Button
            size="lg"
            className="w-full"
            onClick={handleStartExercise}
          >
            Start
            <Play className="w-4 h-4 ml-2 fill-current" />
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
