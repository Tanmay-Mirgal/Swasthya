"use client";

import { useMemo, useState, use } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/react";
import { ArrowRight } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import MovementStage from "@/components/movement/MovementStage";
import { ConfidenceBadge } from "@/components/movement/ConfidenceBadge";
import FocusFrame from "@/components/exercise/FocusFrame";
import CoachLanguageSwitch from "@/components/exercise/CoachLanguageSwitch";
import { useVoicePreference } from "@/components/exercise/useVoiceCoach";
import { Button, Notice, TickBox } from "@/components/ui";
import { useMovementSession } from "@/hooks/useMovementSession";
import { localizeMovementUi } from "@/lib/i18n/coachUi";
import { getMovementTemplate } from "@/lib/movement/template/registry";
import type { MovementTemplate } from "@/lib/movement/template/schema";
import { JOINT_OK } from "@/lib/movement/types";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ exerciseId: string }>;
}

export default function DynamicCameraSetupPage({ params }: PageProps) {
  const { exerciseId } = use(params);
  const template = getMovementTemplate(exerciseId);
  if (!template) {
    return (
      <AppShell title="Exercise" showBackNav backHref="/exercise">
        <div className="mx-auto max-w-xl pt-6">
          <Notice tone="info" title="The camera can’t track this exercise yet" action={<Button asChild size="sm" variant="secondary"><Link href="/exercise">Back to exercises</Link></Button>}>
            Choose an exercise that has movement tracking.
          </Notice>
        </div>
      </AppShell>
    );
  }
  return <CameraSetup key={exerciseId} template={template} />;
}

function CameraSetup({ template }: { template: MovementTemplate }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getToken } = useAuth();
  const { voiceEnabled, language } = useVoicePreference();
  // Everything that identifies the run (free-practice reps, or the prescription and review) travels on to the live page.
  const passthrough = new URLSearchParams();
  for (const key of ["reps", "plan", "ex", "review"]) {
    const v = searchParams.get(key);
    if (v) passthrough.set(key, v);
  }
  const liveQuery = passthrough.toString();
  const [showGuide, setShowGuide] = useState(true);

  const session = useMovementSession({ template, targetReps: 1, voiceEnabled, llmEnabled: false, getToken });
  // The coach's camera advice is shown in the chosen language, the same words the voice says.
  const ui = useMemo(() => localizeMovementUi(session.ui, language), [session.ui, language]);

  const seen = ui.tracking && ui.confidence !== "LOW";
  const isReady = seen && !ui.advice;
  const headline = !ui.tracking ? "I can’t see you yet" : ui.advice ? ui.advice.message : seen ? "Tracking well" : "I can’t see everything yet";
  const detail = isReady ? "I can see everything I need." : ui.advice ? "Adjust your position and I will check again." : template.camera.hint;

  return (
    <FocusFrame
      title={template.name}
      subtitle="Camera check"
      backHref="/exercise"
      camera={
        <MovementStage videoRef={session.videoRef} canvasRef={session.canvasRef} ui={ui} error={session.error} onRetry={() => void session.start()}>
          {showGuide && (
            <div aria-hidden="true" className="absolute inset-0">
              <div className={cn("absolute inset-[8%] rounded-md border-2 border-dashed", isReady ? "border-emerald-300" : "border-white/60")} />
              <div className="absolute inset-y-[8%] left-1/3 w-px bg-white/25" />
              <div className="absolute inset-y-[8%] left-2/3 w-px bg-white/25" />
              <div className="absolute inset-x-[8%] top-1/3 h-px bg-white/25" />
              <div className="absolute inset-x-[8%] top-2/3 h-px bg-white/25" />
            </div>
          )}
        </MovementStage>
      }
      panel={
        <div className="flex flex-col gap-5 p-4 sm:p-5">
          <div>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl font-bold leading-snug text-slate-900">Get in position</h2>
              <CoachLanguageSwitch className="shrink-0" />
            </div>
            <p className="mt-1 text-sm leading-relaxed text-slate-700">{template.camera.hint}</p>
          </div>

          <div role="status" aria-live="polite" className="flex flex-col gap-1.5">
            <p translate={ui.tracking && ui.advice ? "no" : undefined} className="text-base font-semibold text-slate-900">{headline}</p>
            <p className="text-sm text-slate-700">{detail}</p>
            <ConfidenceBadge level={ui.confidence} tracking={ui.tracking} />
          </div>

          <ul className="flex flex-col gap-2" aria-label="Body parts the camera can see">
            {ui.joints.map((j) => {
              const ok = j.state === JOINT_OK;
              return (
                <li key={j.label} className="flex items-center gap-2.5 text-sm font-medium text-slate-900">
                  <TickBox state={ok ? "done" : "todo"} size={22} animate={ok} />
                  {j.label}
                  <span className="sr-only">{ok ? " is visible" : " is not visible yet"}</span>
                  <span aria-hidden="true" className="text-xs font-normal text-slate-600">{ok ? "Visible" : "Not visible yet"}</span>
                </li>
              );
            })}
          </ul>

          <label className="flex items-center gap-2.5 text-sm text-slate-800">
            <input type="checkbox" checked={showGuide} onChange={(e) => setShowGuide(e.target.checked)} className="size-4 accent-emerald-600" />
            Show framing guide on the camera
          </label>

          <div>
            <Button size="lg" className="w-full" disabled={!isReady} onClick={() => router.push(`/exercise/${template.id}/live${liveQuery ? `?${liveQuery}` : ""}`)}>
              Start exercise <ArrowRight className="size-5" aria-hidden="true" />
            </Button>
            {!isReady && <p className="mt-2 text-xs text-slate-600">The button turns on when the camera can see everything it needs.</p>}
          </div>
        </div>
      }
    />
  );
}
