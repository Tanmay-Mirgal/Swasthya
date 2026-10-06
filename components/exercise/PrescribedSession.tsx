"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/react";
import { BookOpen, CheckCircle2 } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import MovementStage from "@/components/movement/MovementStage";
import FocusFrame from "./FocusFrame";
import LivePanel from "./LivePanel";
import PoseGuidePanel from "./PoseGuidePanel";
import { Button, Dialog, Notice, PageLoading, SetsGrid } from "@/components/ui";
import { SessionDone, SessionIntro } from "./SessionViews";
import { startHref } from "@/components/patient/PatientHome";
import { getExerciseById } from "@/lib/exercises/registry";
import { useMovementSession } from "@/hooks/useMovementSession";
import { useVoicePreference } from "./useVoiceCoach";
import { getMovementTemplate } from "@/lib/movement/template/registry";
import type { MovementTemplate } from "@/lib/movement/template/schema";
import { summaryToPayload } from "@/lib/movement/analytics/chunkPayload";
import type { ExerciseProgress } from "@/lib/rehab/schedule";
import type { PlanSnapshot } from "@/lib/rehab/sessionService";
import { flushOutbox, outbox, type OutboxChunk } from "@/lib/rehab/chunkOutbox";
import { recordingSupported, useReviewRecording } from "@/lib/rehab/useReviewRecording";

type Phase = "loading" | "unavailable" | "consent" | "active" | "paused" | "rest" | "done";

interface Props {
  exerciseId: string;
  planId: string;
  exerciseKey: string;
  reviewId?: string;
}

const uuid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `c-${Date.now()}-${Math.random().toString(36).slice(2)}`);

/**
 * One prescribed exercise, one set at a time. The prescription decides how many reps a set
 * has; the patient only decides how to split a set into chunks (8 reps, rest, 7 reps).
 * Every chunk is saved to the server as it ends, so progress survives a pause, a dropped
 * connection or leaving the page, and the same reps are never counted twice.
 */
export default function PrescribedSession(props: Props) {
  const template = getMovementTemplate(props.exerciseId);
  if (!template) {
    return (
      <AppShell title="Exercise" showBackNav backHref="/">
        <Notice tone="danger" title="That exercise isn’t available">Go back to Today and choose another.</Notice>
      </AppShell>
    );
  }
  return <PrescribedSessionInner key={props.exerciseId} {...props} template={template} />;
}

function PrescribedSessionInner({ exerciseId, planId, exerciseKey, reviewId, template }: Props & { template: MovementTemplate }) {
  const router = useRouter();
  const { getToken, userId } = useAuth();
  const exercise = getExerciseById(exerciseId);

  const [phase, setPhase] = useState<Phase>("loading");
  const [snap, setSnap] = useState<PlanSnapshot | null>(null);
  const [progress, setProgress] = useState<ExerciseProgress | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [chunkTarget, setChunkTarget] = useState(1);
  const [guideOpen, setGuideOpen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [discomfort, setDiscomfort] = useState<string | null>(null);
  const [restSeconds, setRestSeconds] = useState(0);
  const [wantsRecording, setWantsRecording] = useState<boolean | null>(null);
  const [recordingAvailable, setRecordingAvailable] = useState(false);
  const [streamReady, setStreamReady] = useState(false);
  const [nextExercise, setNextExercise] = useState<{ exerciseId: string; key: string; name: string } | null>(null);

  const { voiceEnabled, toggleVoice } = useVoicePreference();
  const [currentSet, setCurrentSet] = useState(1);
  const cameraStartedRef = useRef(false);
  const recording = useReviewRecording({ reviewId: reviewId ?? null, userId, getToken });
  const { attachStream, start: startRecording, stop: stopRecording, upload: uploadRecording, discard: discardRecording, hasClip } = recording;
  const [bestRom, setBestRom] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const chunkIdRef = useRef(uuid());
  const chunkStartRef = useRef(new Date());
  const chunkSubmittedRef = useRef(false);
  const endingRef = useRef(false);
  const bestRomRef = useRef(0);
  const phaseRef = useRef<Phase>("loading");
  const progressRef = useRef<ExerciseProgress | null>(null);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  const doneRef = useRef<() => void>(() => undefined);
  const session = useMovementSession({
    template,
    targetReps: chunkTarget,
    paused: phase !== "active",
    set: currentSet,
    autoStart: false,
    voiceEnabled,
    llmEnabled: true,
    getToken,
    onStream: (s) => {
      attachStream(s);
      setStreamReady(Boolean(s));
    },
    onDone: () => doneRef.current(),
  });
  const { start: startCamera, stop: stopCamera, reset: resetSession, getSummary, announceSetComplete } = session;

  const authedFetch = useCallback(
    async (url: string, init?: RequestInit) => {
      const token = await getToken();
      return fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}), Authorization: `Bearer ${token}` } });
    },
    [getToken]
  );

  // ── Sending chunks ────────────────────────────────────────────────────────
  const sendChunk = useCallback(
    async (c: OutboxChunk): Promise<{ result: "sent" | "retry" | "drop"; exercise?: ExerciseProgress; sessionId?: string; message?: string }> => {
      try {
        const res = await authedFetch("/api/patient/plan/sets", {
          method: "POST",
          body: JSON.stringify({ ...c, day: undefined }),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.success) return { result: "sent", exercise: json.data.exercise as ExerciseProgress, sessionId: json.data.sessionId as string };
        if (res.status === 401 || res.status >= 500) return { result: "retry", message: "We couldn’t save that yet." };
        return { result: "drop", message: json.error || "That set can’t be saved." };
      } catch {
        return { result: "retry", message: "You appear to be offline." };
      }
    },
    [authedFetch]
  );

  const loadPlan = useCallback(async () => {
    try {
      const tz = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone);
      const res = await authedFetch(`/api/patient/plan?tz=${tz}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "load");
      return json.data as PlanSnapshot;
    } catch (e) {
      throw new Error(e instanceof Error && e.message !== "load" ? e.message : "We couldn’t load your plan.");
    }
  }, [authedFetch]);

  // Any chunk left over from a dropped connection or a closed tab is sent first.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await flushOutbox(async (c) => (await sendChunk(c)).result);
        const data = await loadPlan();
        if (cancelled) return;
        setSnap(data);
        const ex = data.daily?.exercises.find((e) => e.key === exerciseKey);
        if (data.state !== "active" || !data.prescription || data.prescription.id !== planId || !ex) {
          setPhase("unavailable");
          return;
        }
        setProgress(ex);
        if (ex.status === "complete") {
          setPhase("done");
          return;
        }
        if (reviewId && data.review?.id === reviewId && data.review.recordingRequired && !data.review.recordingDone && recordingSupported()) {
          try {
            const r = await authedFetch("/api/recordings/upload");
            const j = await r.json();
            if (!cancelled && j?.data?.available) setRecordingAvailable(true);
          } catch {
            /* no recording offered if we cannot confirm storage is available */
          }
        }
        if (!cancelled) setPhase("consent");
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "We couldn’t load your plan.");
          setPhase("unavailable");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authedFetch, exerciseKey, loadPlan, planId, reviewId, sendChunk]);

  // When connectivity returns, send anything still queued.
  useEffect(() => {
    const onOnline = () => void flushOutbox(async (c) => (await sendChunk(c)).result).then(() => setSaveNotice(null));
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [sendChunk]);

  // ── Chunk lifecycle ───────────────────────────────────────────────────────
  const beginChunk = useCallback(
    (ex: ExerciseProgress) => {
      const cur = ex.currentSetIndex !== null ? ex.sets[ex.currentSetIndex] : null;
      if (!cur) return;
      chunkIdRef.current = uuid();
      chunkStartRef.current = new Date();
      chunkSubmittedRef.current = false;
      endingRef.current = false;
      setChunkTarget(cur.remainingReps);
      setCurrentSet(cur.index + 1);
      resetSession(cur.remainingReps, cur.index + 1);
      if (!cameraStartedRef.current) {
        cameraStartedRef.current = true;
        void startCamera();
      }
      setPhase("active");
    },
    [resetSession, setChunkTarget, setPhase, startCamera]
  );

  const buildChunk = useCallback((): OutboxChunk | null => {
    const ex = progressRef.current;
    const summary = getSummary();
    if (!ex || ex.currentSetIndex === null || !summary || summary.counted <= 0) return null;
    const payload = summaryToPayload(summary);
    if (summary.rom > bestRomRef.current) {
      bestRomRef.current = summary.rom;
      setBestRom(summary.rom);
    }
    return {
      ...payload,
      chunkId: chunkIdRef.current,
      prescriptionId: planId,
      exerciseKey,
      setIndex: ex.currentSetIndex,
      startedAt: chunkStartRef.current.toISOString(),
      endedAt: new Date().toISOString(),
      day: new Date().toDateString(),
    };
  }, [exerciseKey, getSummary, planId]);

  /** Saves the current chunk. Resolves to the updated exercise, or null if nothing was counted or it is still queued. */
  const submitChunk = useCallback(async (): Promise<ExerciseProgress | null> => {
    if (chunkSubmittedRef.current) return progressRef.current;
    const chunk = buildChunk();
    chunkSubmittedRef.current = true;
    if (!chunk) return progressRef.current;
    outbox.add(chunk);
    const r = await sendChunk(chunk);
    if (r.result === "sent" && r.exercise) {
      outbox.remove(chunk.chunkId);
      if (r.sessionId) setSessionId(r.sessionId);
      setSaveNotice(null);
      setProgress(r.exercise);
      progressRef.current = r.exercise;
      return r.exercise;
    }
    if (r.result === "drop") {
      outbox.remove(chunk.chunkId);
      setSaveNotice(r.message ?? "That set can’t be saved.");
      return progressRef.current;
    }
    setSaveNotice("Your reps are kept on this device and will be saved as soon as you’re back online.");
    return progressRef.current;
  }, [buildChunk, sendChunk, setProgress, setSaveNotice]);

  const finishExercise = useCallback(
    async (ex: ExerciseProgress | null) => {
      await stopRecording();
      stopCamera();
      setPhase("done");
      try {
        const data = await loadPlan();
        setSnap(data);
        const next = data.daily?.exercises.find((e) => e.status !== "complete" && e.key !== exerciseKey);
        setNextExercise(next ? { exerciseId: next.exerciseId, key: next.key, name: next.name } : null);
      } catch {
        /* the done screen still works without the next-exercise hint */
      }
      if (ex && reviewId && wantsRecording && hasClip()) void uploadRecording();
    },
    [exerciseKey, hasClip, loadPlan, reviewId, setNextExercise, setPhase, setSnap, stopCamera, stopRecording, uploadRecording, wantsRecording]
  );

  const endChunk = useCallback(
    async (kind: "pause" | "set_complete") => {
      if (endingRef.current) return;
      endingRef.current = true;
      if (kind === "set_complete") announceSetComplete();
      const ex = await submitChunk();
      if (kind === "pause") {
        setPhase("paused");
        return;
      }
      if (ex && ex.status === "complete") await finishExercise(ex);
      else {
        setRestSeconds(0);
        setPhase("rest");
      }
    },
    [announceSetComplete, finishExercise, setPhase, setRestSeconds, submitChunk]
  );

  // The engine counted the chunk's target: save it a moment later so the last rep is seen.
  useEffect(() => {
    doneRef.current = () => {
      if (phaseRef.current === "active" && !endingRef.current) setTimeout(() => void endChunk("set_complete"), 900);
    };
  }, [endChunk]);

  // Closing the tab mid-chunk: keep the reps in the outbox so the next visit saves them.
  useEffect(() => {
    const onHide = () => {
      if (phaseRef.current !== "active" || chunkSubmittedRef.current) return;
      const chunk = buildChunk();
      if (chunk) {
        outbox.add(chunk);
        chunkSubmittedRef.current = true;
      }
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [buildChunk]);

  // Rest timer (counts up; the patient rests as long as they need).
  useEffect(() => {
    if (phase !== "rest") return;
    const t = setInterval(() => setRestSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // The review clip starts with the first set, only if the patient agreed.
  useEffect(() => {
    if (phase === "active" && wantsRecording && streamReady) startRecording();
  }, [phase, wantsRecording, streamReady, startRecording]);

  const leave = useCallback(
    async (href: string) => {
      setConfirmEnd(false);
      await stopRecording();
      discardRecording();
      if (phaseRef.current === "active") await submitChunk();
      router.push(href);
    },
    [discardRecording, router, setConfirmEnd, stopRecording, submitChunk]
  );

  // ── Views ─────────────────────────────────────────────────────────────────
  if (!exercise) {
    return (
      <AppShell title="Exercise" showBackNav backHref="/">
        <Notice tone="danger" title="That exercise isn’t available">Go back to Today and choose another.</Notice>
      </AppShell>
    );
  }

  if (phase === "loading") {
    return (
      <AppShell title={exercise.name} showBackNav backHref="/" hideNav>
        <PageLoading label="Getting your set ready" />
      </AppShell>
    );
  }

  if (phase === "unavailable") {
    return (
      <AppShell title={exercise.name} showBackNav backHref="/">
        <div className="mx-auto max-w-xl pt-6">
          <Notice tone={loadError ? "danger" : "info"} title={loadError ? "We couldn’t load your plan" : "This exercise isn’t on today’s plan"} action={<Button asChild size="sm" variant="secondary"><Link href="/">Back to Today</Link></Button>}>
            {loadError ?? "Your plan may have changed, or you have finished it for today. Open Today to see what is due."}
          </Notice>
        </div>
      </AppShell>
    );
  }

  const set = progress && progress.currentSetIndex !== null ? progress.sets[progress.currentSetIndex] : null;
  const rx = snap?.prescription;
  const meta = rx?.exercises.find((e) => e.key === exerciseKey);

  if (phase === "consent" && progress) {
    return (
      <AppShell title={exercise.name} showBackNav backHref="/" hideNav>
        <SessionIntro
          name={exercise.name}
          progress={progress}
          doctorName={rx?.doctorName}
          instructions={meta?.instructions}
          modifications={meta?.modifications}
          askRecording={recordingAvailable && wantsRecording === null}
          recordingOn={Boolean(wantsRecording)}
          reviewRecordingChosen={Boolean(reviewId)}
          onChooseRecording={setWantsRecording}
          onStart={() => beginChunk(progress)}
        />
      </AppShell>
    );
  }

  if (phase === "done" && progress) {
    return (
      <AppShell title="Exercise done" showBackNav backHref="/" maxWidth="default">
        <SessionDone
          progress={progress}
          bestRom={bestRom}
          romUnit={template.rep.unit}
          sessionId={sessionId}
          discomfort={discomfort}
          onDiscomfort={async (id) => {
            setDiscomfort(id);
            try {
              await authedFetch("/api/patient/plan/discomfort", { method: "POST", body: JSON.stringify({ prescriptionId: planId, exerciseKey, discomfort: id }) });
            } catch {
              /* optional: nothing breaks if it is not saved */
            }
          }}
          recording={reviewId && wantsRecording ? { state: recording.state, error: recording.error, onRetry: () => void uploadRecording() } : null}
          saveNotice={saveNotice}
          next={nextExercise && rx ? { href: startHref(nextExercise.exerciseId, planId, nextExercise.key), name: nextExercise.name } : null}
        />
      </AppShell>
    );
  }

  // active, paused, rest: the camera stays on so the next set starts straight away.
  const ui = session.ui;
  const chunkReps = ui.counted;
  const base = set ? set.completedReps : 0;
  const setTarget = set?.targetReps ?? chunkTarget;
  const paused = phase !== "active";
  const doneInSet = set ? base + (phase === "rest" ? 0 : chunkReps) : 0;

  return (
    <>
      <FocusFrame
        title={exercise.name}
        subtitle={set ? `Set ${set.index + 1} of ${progress?.targetSets} · ${doneInSet} of ${setTarget} reps` : undefined}
        backLabel="Stop"
        onBack={() => (chunkReps > 0 || (progress?.completedReps ?? 0) > 0 ? setConfirmEnd(true) : void leave("/"))}
        actions={
          <Button variant="outline" size="sm" onClick={() => setGuideOpen(true)}>
            <BookOpen className="size-4" aria-hidden="true" /> Guide
          </Button>
        }
        camera={
          <MovementStage videoRef={session.videoRef} canvasRef={session.canvasRef} ui={ui} error={session.error} onRetry={() => void startCamera()} quiet={paused}>
            {phase === "paused" && (
              <div className="flex size-full items-center justify-center bg-slate-950/55">
                <p className="rounded-lg bg-[var(--paper)] px-5 py-3 text-lg font-bold text-slate-900">Paused</p>
              </div>
            )}
            {phase === "rest" && (
              <div className="flex size-full items-center justify-center bg-slate-950/55 p-4">
                <p className="rounded-lg bg-[var(--paper)] px-5 py-3 text-center text-lg font-bold text-slate-900">Set {set ? set.index : ""} complete. Rest.</p>
              </div>
            )}
          </MovementStage>
        }
        panel={
          phase === "rest" && progress && set ? (
            <div className="flex flex-col gap-4 p-4 sm:p-5">
              <div>
                <p className="text-base font-bold text-slate-900">Set {set.index} of {progress.targetSets} done</p>
                <p className="mt-1 text-sm text-slate-700">Rest as long as you need. Next is set {set.index + 1}: {set.targetReps} reps.</p>
                <p className="mt-3 font-mono text-4xl font-bold tabular text-slate-900" role="timer" aria-label={`Rested ${restSeconds} seconds`}>{Math.floor(restSeconds / 60)}:{String(restSeconds % 60).padStart(2, "0")}</p>
                <p className="text-xs text-slate-600">Time resting. There is no countdown; this is only so you can see how long it has been.</p>
              </div>
              {saveNotice && <Notice tone="warning" title="Not saved yet">{saveNotice}</Notice>}
              <SetsGrid sets={progress.targetSets} reps={progress.targetReps} completedReps={progress.completedReps} size={progress.targetReps > 12 ? 12 : 16} />
              <div className="grid grid-cols-2 gap-2">
                <Button size="lg" onClick={() => beginChunk(progress)}>Start set {set.index + 1}</Button>
                <Button size="lg" variant="outline" onClick={() => void leave("/")}>Stop for now</Button>
              </div>
            </div>
          ) : (
            <>
              {phase === "paused" && set && (
                <div className="border-b border-slate-300 bg-slate-50 px-4 py-3 sm:px-5">
                  <p className="text-base font-bold text-slate-900"><span className="tabular">{doneInSet}</span> of <span className="tabular">{setTarget}</span> reps in this set</p>
                  <p className="text-sm text-slate-700"><span className="tabular">{setTarget - doneInSet}</span> to go. Your reps are saved. Resume when you’re ready.</p>
                </div>
              )}
              {saveNotice && <div className="px-4 pt-3 sm:px-5"><Notice tone="warning" title="Not saved yet">{saveNotice}</Notice></div>}
              <LivePanel
                ui={ui}
                paused={paused}
                voiceEnabled={voiceEnabled}
                onToggleVoice={toggleVoice}
                repsBefore={base}
                setTarget={setTarget}
                contextLabel={set && progress ? `Set ${set.index + 1} of ${progress.targetSets}` : undefined}
                contextDetail={set ? (base > 0 ? `${base} saved earlier in this set; this part counts up to ${chunkTarget} more.` : `${setTarget} reps in this set`) : undefined}
                pauseLabel="Pause and rest"
                endLabel="Stop for now"
                reachedLabel="Finish set"
                onTogglePause={() => {
                  if (phase === "paused") {
                    if (progress) beginChunk(progress);
                  } else if (chunkReps > 0) void endChunk("pause");
                  else setPhase("paused");
                }}
                onFinish={() => (ui.done ? void endChunk("set_complete") : setConfirmEnd(true))}
                onOpenGuide={() => setGuideOpen(true)}
              />
            </>
          )
        }
      />

      <PoseGuidePanel isOpen={guideOpen} onOpenChange={setGuideOpen} exerciseId={exercise.id} exerciseName={exercise.name} instructions={exercise.instructions} />

      <Dialog
        open={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        title="Stop for now?"
        description={chunkReps > 0 && phase === "active" ? `Your ${chunkReps} ${chunkReps === 1 ? "rep is" : "reps are"} saved to this set.` : "Everything you have finished is already saved."}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmEnd(false)}>Keep going</Button>
            <Button variant="danger" onClick={() => void leave("/")}>Stop for now</Button>
          </>
        }
      >
        <p className="text-sm text-slate-700">You can pick up from this exact set later from Today. Your therapist’s target doesn’t change.</p>
        {reviewId && wantsRecording && <p className="mt-2 text-sm text-slate-700"><CheckCircle2 className="mr-1 inline size-4 align-[-3px] text-emerald-700" aria-hidden="true" />The recording will not be kept. You can record again from Today.</p>}
      </Dialog>
    </>
  );
}
