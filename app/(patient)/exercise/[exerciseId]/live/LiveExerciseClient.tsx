"use client";

import { useState, useCallback, useEffect, useMemo, useRef, use } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/react";
import { BookOpen, Volume2 } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import MovementStage from "@/components/movement/MovementStage";
import FocusFrame from "@/components/exercise/FocusFrame";
import Celebration, { burstDurationMs, useCelebration } from "@/components/exercise/Celebration";
import LivePanel from "@/components/exercise/LivePanel";
import CaptionsBar from "@/components/exercise/CaptionsBar";
import PoseGuidePanel from "@/components/exercise/PoseGuidePanel";
import SettingsSheet from "@/components/exercise/SettingsSheet";
import { useVoicePreference } from "@/components/exercise/useVoiceCoach";
import { localizeMovementUi } from "@/lib/i18n/coachUi";
import { localizeShown } from "@/lib/i18n/spoken";
import { primeCheer } from "@/lib/sound/cheer";
import VoiceService from "@/services/voice/voiceService";
import { Button, Dialog, Notice } from "@/components/ui";
import { getExerciseById } from "@/lib/exercises/registry";
import { saveSession, syncSessionToDatabase } from "@/lib/session/sessionStore";
import { useMovementSession } from "@/hooks/useMovementSession";
import { getMovementTemplate } from "@/lib/movement/template/registry";
import type { MovementTemplate } from "@/lib/movement/template/schema";
import { ENGINE_VERSION } from "@/lib/movement/version";
import type { SessionRecord } from "@/lib/exercises/types";
import PrescribedSession from "@/components/exercise/PrescribedSession";

/** Long enough for "Exercise complete. Well done." to be said before the summary opens. */
const CLOSING_WORDS_MS = 2600;

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
  const { voiceEnabled, toggleVoice, setVoiceEnabled, language, voiceSettings, updateVoiceSettings } = useVoicePreference();
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Practice without a prescription sounds and feels like a prescribed set: the same voice settings, captions, closing words and party popper.
  const { burst, fire } = useCelebration(voiceSettings.celebrations);
  /** When the party popper and the closing words will have played out, so leaving for the summary does not cut them short. */
  const holdUntilRef = useRef(0);
  const [captionLines, setCaptionLines] = useState<string[]>([]);
  /** Records a spoken line for the captions (in the chosen language, as on the rest of the screen), and speaks it when the voice is on. */
  const say = useCallback(
    (text: string) => {
      setCaptionLines((l) => [...l.slice(-2), localizeShown(text, language)]);
      if (voiceEnabled) VoiceService.speak(text);
    },
    [voiceEnabled, language]
  );

  // Some browsers only allow speech and sound after a tap: the first touch anywhere on the screen makes every later cue audible.
  useEffect(() => {
    const unlock = () => {
      VoiceService.prime();
      primeCheer();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

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
    onSpoken: (text) => setCaptionLines((l) => [...l.slice(-2), localizeShown(text, language)]),
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
    // Everything is saved by now; only the way out waits, so the confetti and the closing words play to the end.
    const wait = holdUntilRef.current - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    router.push("/session");
  }, [getSummary, getToken, plannedReps, router, startedAt, template]);

  // The engine counted every rep: celebrate and say so now, and save a moment later so the last one is seen.
  useEffect(() => {
    finishRef.current = () => {
      if (!endingRef.current && holdUntilRef.current === 0) {
        fire(1, { on: voiceEnabled, volume: voiceSettings.volume });
        say("Exercise complete. Well done.");
        holdUntilRef.current = Date.now() + Math.max(voiceSettings.celebrations ? burstDurationMs(1) : 0, voiceEnabled ? CLOSING_WORDS_MS : 0);
      }
      setTimeout(() => void finishSession(), 1200);
    };
  }, [finishSession, fire, say, voiceEnabled, voiceSettings.celebrations, voiceSettings.volume]);

  const ui = useMemo(() => localizeMovementUi(session.ui, language), [session.ui, language]);
  const completedReps = ui.counted;

  return (
    <>
      <Celebration burst={burst} />
      <FocusFrame
        title={exercise.name}
        subtitle={`${completedReps} of ${ui.targetReps} good reps`}
        backLabel="End"
        onBack={() => (completedReps > 0 ? setConfirmEnd(true) : router.push("/exercise"))}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)} aria-label="Voice and sound settings">
              <Volume2 className="size-4" aria-hidden="true" /> <span className="hidden sm:inline">Sound</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsGuideOpen(true)}>
              <BookOpen className="size-4" aria-hidden="true" /> Guide
            </Button>
          </>
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
        panelTop={voiceSettings.captions ? <CaptionsBar lines={captionLines} /> : undefined}
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

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} voiceEnabled={voiceEnabled} onVoiceEnabled={setVoiceEnabled} settings={voiceSettings} onChange={updateVoiceSettings} language={language} />

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
