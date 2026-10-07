"use client";

import { useState, useCallback, useEffect, useRef, use } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/react";
import { BookOpen } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import MovementStage from "@/components/movement/MovementStage";
import FocusFrame from "@/components/exercise/FocusFrame";
import LivePanel from "@/components/exercise/LivePanel";
import PoseGuidePanel from "@/components/exercise/PoseGuidePanel";
import { useVoicePreference } from "@/components/exercise/useVoiceCoach";
import { Button, Dialog, Notice } from "@/components/ui";
import { getExerciseById } from "@/lib/exercises/registry";
import { saveSession, syncSessionToDatabase } from "@/lib/session/sessionStore";
import { useMovementSession } from "@/hooks/useMovementSession";
import { getMovementTemplate } from "@/lib/movement/template/registry";
import type { MovementTemplate } from "@/lib/movement/template/schema";
import { ENGINE_VERSION } from "@/lib/movement/version";
import type { SessionRecord } from "@/lib/exercises/types";
import PrescribedSession from "@/components/exercise/PrescribedSession";

interface PageProps {
  params: Promise<{ exerciseId: string }>;
}

/**
 * Prescribed work (opened from Today with ?plan=&ex=) runs set by set against the server.
 * Anything else is free practice: a single run that is saved to this device and account.
 */
export default function DynamicLiveExercisePage({ params }: PageProps) {
  const { exerciseId } = use(params);
  const search = useSearchParams();
  const planId = search.get("plan");
  const exerciseKey = search.get("ex");
  if (planId && exerciseKey) {
    return <PrescribedSession exerciseId={exerciseId} planId={planId} exerciseKey={exerciseKey} reviewId={search.get("review") || undefined} />;
  }
  const template = getMovementTemplate(exerciseId);
  if (!template) {
    return (
      <AppShell title="Exercise" showBackNav backHref="/exercise">
        <div className="mx-auto max-w-xl pt-6">
          <Notice tone="info" title="The camera can’t track this exercise yet" action={<Button asChild size="sm" variant="secondary"><Link href="/exercise">Back to exercises</Link></Button>}>
            Only exercises with movement tracking can be practised here. Choose another from the library.
          </Notice>
        </div>
      </AppShell>
    );
  }
  return <FreePracticeSession key={exerciseId} template={template} />;
}

function FreePracticeSession({ template }: { template: MovementTemplate }) {
  const exercise = getExerciseById(template.id)!;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getToken } = useAuth();
  // The prescribed reps per set travel with the link; fall back to the exercise default.
  const repsParam = Number(searchParams.get("reps"));
  const plannedReps = Number.isInteger(repsParam) && repsParam >= 1 && repsParam <= 50 ? repsParam : template.defaultReps;
  const [paused, setPaused] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const { voiceEnabled, toggleVoice, language } = useVoicePreference();

  const [startedAt] = useState(() => Date.now());
  const endingRef = useRef(false);
  const finishRef = useRef<() => void>(() => undefined);

  const session = useMovementSession({
    template,
    targetReps: plannedReps,
    paused,
    voiceEnabled,
    llmEnabled: language === "en", // model-written wording is English only; other languages use the reviewed catalogue
    getToken,
    onDone: () => finishRef.current(),
  });
  const { getSummary } = session;

  const finishSession = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    const s = getSummary();
    const durationSeconds = Math.round((Date.now() - startedAt) / 1000);
    const completedReps = s?.counted ?? 0;
    const record: Omit<SessionRecord, "id" | "date"> = {
      exerciseId: template.id,
      exerciseName: template.name,
      durationSeconds,
      completedReps,
      targetReps: plannedReps,
      rom: s?.rom ?? 0,
      unit: template.rep.unit,
      averageTempo: s && s.reps.length ? Math.round((s.reps.reduce((sum, r) => sum + r.durationMs, 0) / s.reps.length / 100)) / 10 : undefined,
      validReps: s?.valid,
      invalidReps: s?.invalid,
      partialReps: s?.partial,
      correctionAttempts: s?.corrections.attempted,
      correctionsSucceeded: s?.corrections.succeeded,
      avgConfidence: s?.avgConfidence,
      errors: s && Object.keys(s.errors).length ? s.errors : undefined,
      engine: ENGINE_VERSION,
      targetMet: completedReps >= plannedReps,
    };

    const saved = saveSession(record);
    try {
      sessionStorage.setItem("last_completed_session", JSON.stringify(saved));
    } catch {
      /* the summary falls back to the newest saved session */
    }
    // Best effort: copy the session to the account so the therapist and other devices can see it.
    // Wait a moment so the summary can show the saved copy's report; never block leaving for long.
    const serverId = await Promise.race([
      getToken().then((token) => (token ? syncSessionToDatabase(saved, token) : null)).catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1800)),
    ]);
    if (serverId) {
      try {
        sessionStorage.setItem("last_completed_session", JSON.stringify({ ...saved, serverId }));
      } catch {
        /* the summary simply has no report link */
      }
    }
    router.push("/session");
  }, [getSummary, getToken, plannedReps, router, startedAt, template]);

  // The engine counted every rep: save a moment later so the last one is seen.
  useEffect(() => {
    finishRef.current = () => {
      setTimeout(() => void finishSession(), 1200);
    };
  }, [finishSession]);

  const { ui } = session;
  const completedReps = ui.counted;

  return (
    <>
      <FocusFrame
        title={exercise.name}
        subtitle={`${completedReps} of ${ui.targetReps} good reps`}
        backLabel="End"
        onBack={() => (completedReps > 0 ? setConfirmEnd(true) : router.push("/exercise"))}
        actions={
          <Button variant="outline" size="sm" onClick={() => setIsGuideOpen(true)}>
            <BookOpen className="size-4" aria-hidden="true" /> Guide
          </Button>
        }
        camera={
          <MovementStage videoRef={session.videoRef} canvasRef={session.canvasRef} ui={ui} error={session.error} onRetry={() => void session.start()} quiet={paused}>
            {paused && (
              <div className="flex size-full items-center justify-center bg-slate-950/55">
                <p className="rounded-lg bg-[var(--paper)] px-5 py-3 text-lg font-bold text-slate-900">Paused</p>
              </div>
            )}
          </MovementStage>
        }
        panel={
          <LivePanel
            ui={ui}
            paused={paused}
            voiceEnabled={voiceEnabled}
            onToggleVoice={toggleVoice}
            onTogglePause={() => setPaused((p) => !p)}
            onFinish={() => (ui.done ? finishSession() : setConfirmEnd(true))}
            onOpenGuide={() => setIsGuideOpen(true)}
          />
        }
      />

      <PoseGuidePanel isOpen={isGuideOpen} onOpenChange={setIsGuideOpen} exerciseId={exercise.id} exerciseName={exercise.name} instructions={exercise.instructions} />

      <Dialog
        open={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        title="End this session?"
        description={
          completedReps > 0
            ? `Your ${completedReps} good ${completedReps === 1 ? "rep is" : "reps are"} saved.`
            : "No good reps yet, so nothing will be saved."
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmEnd(false)}>Keep going</Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmEnd(false);
                if (completedReps > 0) void finishSession();
                else router.push("/exercise");
              }}
            >
              End session
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-700">You can start the exercise again at any time from Today.</p>
      </Dialog>
    </>
  );
}
