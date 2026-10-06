"use client";

import { useState, useCallback, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import PoseDetector, { FrameUpdateData } from "@/components/pose/PoseDetector";
import FocusFrame from "@/components/exercise/FocusFrame";
import { Button, TickBox } from "@/components/ui";
import { getExerciseById } from "@/lib/exercises/registry";
import { describeTracking, jointChecklist } from "@/lib/pose/trackingState";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ exerciseId: string }>;
}

export default function DynamicCameraSetupPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const exercise = getExerciseById(resolvedParams.exerciseId) || getExerciseById("seated-knee-extension")!;
  const router = useRouter();
  const searchParams = useSearchParams();
  // Everything that identifies the run (free-practice reps, or the prescription and review) travels on to the live page.
  const passthrough = new URLSearchParams();
  for (const key of ["reps", "plan", "ex", "review"]) {
    const v = searchParams.get(key);
    if (v) passthrough.set(key, v);
  }
  const liveQuery = passthrough.toString();

  const [frameData, setFrameData] = useState<FrameUpdateData | null>(null);
  const [showGuide, setShowGuide] = useState(true);

  const handleFrameUpdate = useCallback((data: FrameUpdateData) => setFrameData(data), []);

  const confidence = frameData?.confidence;
  const tracking = describeTracking(confidence, exercise.bodySegment);
  const isReady = tracking.kind === "ready";
  const checks = jointChecklist(confidence, exercise.bodySegment);

  const placement =
    exercise.bodySegment === "neck"
      ? "Sit facing the camera, with your head and both shoulders in the frame."
      : exercise.bodySegment === "upper"
      ? "Sit about two metres from the camera so your whole arm is in view."
      : "Place your device far enough back that your whole leg is in view.";

  return (
    <FocusFrame
      title={exercise.name}
      subtitle="Camera check"
      backHref="/exercise"
      camera={
        <PoseDetector onFrameUpdate={handleFrameUpdate} autoStart={true} exerciseId={exercise.id} bodySegment={exercise.bodySegment}>
          {showGuide && (
            <div aria-hidden="true" className="absolute inset-0">
              <div className={cn("absolute inset-[8%] rounded-md border-2 border-dashed", isReady ? "border-emerald-300" : "border-white/60")} />
              <div className="absolute inset-y-[8%] left-1/3 w-px bg-white/25" />
              <div className="absolute inset-y-[8%] left-2/3 w-px bg-white/25" />
              <div className="absolute inset-x-[8%] top-1/3 h-px bg-white/25" />
              <div className="absolute inset-x-[8%] top-2/3 h-px bg-white/25" />
            </div>
          )}
        </PoseDetector>
      }
      panel={
        <div className="flex flex-col gap-5 p-4 sm:p-5">
          <div>
            <h2 className="text-xl font-bold leading-snug text-slate-900">Get in position</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-700">{placement}</p>
          </div>

          <div role="status" aria-live="polite">
            <p className="text-base font-semibold text-slate-900">{tracking.title}</p>
            <p className="mt-0.5 text-sm text-slate-700">{tracking.detail}</p>
          </div>

          <ul className="flex flex-col gap-2" aria-label="Body parts the camera can see">
            {checks.map((c) => (
              <li key={c.name} className="flex items-center gap-2.5 text-sm font-medium text-slate-900">
                <TickBox state={c.detected ? "done" : "todo"} size={22} animate={c.detected} />
                {c.name}
                <span className="sr-only">{c.detected ? " is visible" : " is not visible yet"}</span>
                <span aria-hidden="true" className="text-xs font-normal text-slate-600">{c.detected ? "Visible" : "Not visible yet"}</span>
              </li>
            ))}
          </ul>

          <label className="flex items-center gap-2.5 text-sm text-slate-800">
            <input type="checkbox" checked={showGuide} onChange={(e) => setShowGuide(e.target.checked)} className="size-4 accent-emerald-600" />
            Show framing guide on the camera
          </label>

          <div>
            <Button size="lg" className="w-full" disabled={!isReady} onClick={() => router.push(`/exercise/${exercise.id}/live${liveQuery ? `?${liveQuery}` : ""}`)}>
              Start exercise <ArrowRight className="size-5" aria-hidden="true" />
            </Button>
            {!isReady && <p className="mt-2 text-xs text-slate-600">The button turns on when the camera can see everything it needs.</p>}
          </div>
        </div>
      }
    />
  );
}
