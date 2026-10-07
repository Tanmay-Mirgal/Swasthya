"use client";

import { useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/react";
import { BookOpen, CheckCircle2, Info, Pause, Volume2 } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import MovementStage from "@/components/movement/MovementStage";
import FocusFrame from "./FocusFrame";
import LivePanel from "./LivePanel";
import PoseGuidePanel from "./PoseGuidePanel";
import { Button, Dialog, Notice, PageLoading } from "@/components/ui";
import Countdown from "./Countdown";
import ManualCounter from "./ManualCounter";
import ReadyCheck, { isCameraReady } from "./ReadyCheck";
import LiveStage, { StageAction } from "./stage/LiveStage";
import StageDetails from "./stage/StageDetails";
import { useViewScale } from "./stage/useViewScale";
import { getStartForMe, setStartForMe, type StartForMe } from "@/lib/preferences";
import RestPanel from "./RestPanel";
import CaptionsBar from "./CaptionsBar";
import SettingsSheet from "./SettingsSheet";
import Celebration, { useCelebration } from "./Celebration";
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
import { evaluateSet, nextSessionLine, weekConsistency, type DaySummary, type SessionFacts, type SetCelebration } from "@/lib/rehab/milestones";
import { primeCheer } from "@/lib/sound/cheer";
import { addDays, formatDateKey } from "@/lib/rehab/dates";
import { flowReducer, initialFlow, isJudging, type FlowPhase } from "@/lib/rehab/sessionFlow";
import VoiceService from "@/services/voice/voiceService";

/** The live screen is the side-panel layout (camera left, controls right). The distance-first stage is kept but off; `NEXT_PUBLIC_LIVE_V2=1` turns it on. */
const LIVE_V2 = process.env.NEXT_PUBLIC_LIVE_V2 === "1";
/** How long nobody is in view before a set pauses by itself, and how long they must be back before it offers to carry on. */
const AUTO_PAUSE_MS = 5000;
const AUTO_RESUME_MS = 1500;

interface Props {
  exerciseId: string;
  planId: string;
  exerciseKey: string;
  reviewId?: string;
}

/** The "today's routine is complete" facts, from the plan snapshot. Null unless every exercise due today is done. */
function routineFrom(data: PlanSnapshot): { summary: DaySummary; weekLine: string | null; nextLine: string | null } | null {
  const summary = data.todaySummary;
  if (!summary || !summary.routineComplete) return null;
  const when = (day: string) => (day === addDays(data.today, 1) ? "tomorrow" : `on ${formatDateKey(day, { weekday: "long", day: "numeric", month: "short" })}`);
  return { summary, weekLine: weekConsistency(data.week), nextLine: nextSessionLine(data.upcoming, when) };
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

  const [flow, dispatchFlow] = useReducer(flowReducer, undefined, initialFlow);
  const phase = flow.phase;
  const mode = flow.mode;
  const [manualCount, setManualCount] = useState(0);
  const [snap, setSnap] = useState<PlanSnapshot | null>(null);
  const [progress, setProgress] = useState<ExerciseProgress | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [chunkTarget, setChunkTarget] = useState(1);
  const [guideOpen, setGuideOpen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmFinishEarly, setConfirmFinishEarly] = useState(false);
  /** Set when the patient chooses "Finish for today": the chunk that ends the visit carries it to the server. */
  const finishedEarlyRef = useRef(false);
  /** This patient's hold and accepted range from the prescription, applied to the engine at the start of every chunk. */
  const toleranceRef = useRef<{ holdMs: number | null; minRange: number | null }>({ holdMs: null, minRange: null });
  const [discomfort, setDiscomfort] = useState<string | null>(null);
  const [restSeconds, setRestSeconds] = useState(0);
  const [wantsRecording, setWantsRecording] = useState<boolean | null>(null);
  const [recordingAvailable, setRecordingAvailable] = useState(false);
  const [streamReady, setStreamReady] = useState(false);
  const [nextExercise, setNextExercise] = useState<{ exerciseId: string; key: string; name: string } | null>(null);

  const { voiceEnabled, toggleVoice, setVoiceEnabled, voiceSettings, updateVoiceSettings, language } = useVoicePreference();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const viewScale = useViewScale();
  const [startForMe, setStartForMeState] = useState<StartForMe>(() => getStartForMe());
  /** True once the chunk just ended has been saved: its reps are then already in the set's total. */
  const [chunkSaved, setChunkSaved] = useState(false);
  const [captionLines, setCaptionLines] = useState<string[]>([]);
  /** Records a spoken line for the captions (always, in the language it is spoken in), and speaks it when the voice is on. */
  const say = useCallback(
    (text: string, interrupt = false) => {
      setCaptionLines((l) => [...l.slice(-2), VoiceService.prepare(text).text]);
      if (voiceEnabled) VoiceService.speak(text, { interrupt });
    },
    [voiceEnabled]
  );
  /** The party popper, and what the set just finished earned. Both reset when the next set begins. */
  const { burst, fire } = useCelebration(voiceSettings.celebrations);
  const [celebration, setCelebration] = useState<SetCelebration | null>(null);
  /** What this set has been so far, across any pauses inside it, so "clean set" is judged on the whole set and not on the last chunk. */
  const setStatsRef = useRef({ setIndex: -1, good: 0, invalid: 0, partial: 0, rom: 0, fixed: 0 });
  /** The best range from earlier sessions measured the same way, if there is enough history for "best" to mean something. */
  const personalBestRef = useRef<{ rom: number; unit: "deg" | "pct" } | null>(null);
  /** The saved facts about this exercise today, as of the last save. */
  const factsRef = useRef<SessionFacts | null>(null);
  const [currentSet, setCurrentSet] = useState(1);
  const cameraStartedRef = useRef(false);
  const recording = useReviewRecording({ reviewId: reviewId ?? null, userId, getToken });
  const { attachStream, start: startRecording, stop: stopRecording, upload: uploadRecording, discard: discardRecording, hasClip } = recording;
  const [bestRom, setBestRom] = useState(0);
  const [facts, setFacts] = useState<SessionFacts | null>(null);
  const [highlights, setHighlights] = useState<string[]>([]);
  const [lastTime, setLastTime] = useState<string | null>(null);
  const [routine, setRoutine] = useState<{ summary: DaySummary; weekLine: string | null; nextLine: string | null } | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const chunkIdRef = useRef(uuid());
  const chunkStartRef = useRef(new Date());
  const chunkSubmittedRef = useRef(false);
  const endingRef = useRef(false);
  const bestRomRef = useRef(0);
  const phaseRef = useRef<FlowPhase>("loading");
  const modeRef = useRef(mode);
  const manualCountRef = useRef(0);
  const progressRef = useRef<ExerciseProgress | null>(null);
  useEffect(() => {
    phaseRef.current = phase;
    modeRef.current = mode;
  }, [phase, mode]);
  useEffect(() => {
    manualCountRef.current = manualCount;
  }, [manualCount]);
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  const doneRef = useRef<() => void>(() => undefined);
  const session = useMovementSession({
    template,
    targetReps: chunkTarget,
    paused: !isJudging(flow),
    // Keep the camera view live (skeleton, "can I see you") through the camera check, countdown, pause and rest, without judging anything.
    observe: mode === "camera",
    set: currentSet,
    autoStart: false,
    voiceEnabled,
    // Model-written wording is English only: Hindi and Marathi lines come from the reviewed catalogue, so what is shown, captioned and spoken always agree.
    llmEnabled: language === "en",
    getToken,
    onStream: (s) => {
      attachStream(s);
      setStreamReady(Boolean(s));
    },
    onDone: () => doneRef.current(),
    onSpoken: (text) => setCaptionLines((l) => [...l.slice(-2), VoiceService.prepare(text).text]),
  });
  const { start: startCamera, stop: stopCamera, reset: resetSession, configure: configureEngine, getSummary, announceSetComplete } = session;
  const uiRef = useRef(session.ui);
  const cameraErrorRef = useRef<string | null>(null);
  useEffect(() => {
    uiRef.current = session.ui;
    cameraErrorRef.current = session.error;
  }, [session.ui, session.error]);

  const authedFetch = useCallback(
    async (url: string, init?: RequestInit) => {
      const token = await getToken();
      return fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}), Authorization: `Bearer ${token}` } });
    },
    [getToken]
  );

  // ── Sending chunks ────────────────────────────────────────────────────────
  const sendChunk = useCallback(
    async (c: OutboxChunk): Promise<{ result: "sent" | "retry" | "drop"; exercise?: ExerciseProgress; sessionId?: string; session?: SessionFacts; highlights?: string[]; message?: string }> => {
      try {
        const res = await authedFetch("/api/patient/plan/sets", {
          method: "POST",
          body: JSON.stringify({ ...c, day: undefined }),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.success) return { result: "sent", exercise: json.data.exercise as ExerciseProgress, sessionId: json.data.sessionId as string, session: json.data.session as SessionFacts | undefined, highlights: json.data.highlights as string[] | undefined };
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
        const mine = data.prescription?.exercises.find((e) => e.key === exerciseKey);
        toleranceRef.current = { holdMs: mine?.holdSeconds ? mine.holdSeconds * 1000 : null, minRange: mine?.minRangeOverride ?? null };
        const ex = data.daily?.exercises.find((e) => e.key === exerciseKey);
        if (data.state !== "active" || !data.prescription || data.prescription.id !== planId || !ex) {
          dispatchFlow({ type: "unavailable" });
          return;
        }
        setProgress(ex);
        if (ex.status === "complete") {
          setRoutine(routineFrom(data));
          dispatchFlow({ type: "loaded", complete: true });
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
        try {
          const pr = await authedFetch(`/api/patient/progress?exerciseId=${encodeURIComponent(exerciseId)}`);
          const pj = await pr.json();
          if (!cancelled && pr.ok && pj?.data?.lastTime) setLastTime(pj.data.lastTime as string);
          if (!cancelled && pr.ok && pj?.data?.personalBest) personalBestRef.current = pj.data.personalBest as { rom: number; unit: "deg" | "pct" };
        } catch {
          /* the line is a nicety: nothing breaks without it */
        }
        if (!cancelled) dispatchFlow({ type: "loaded", complete: false });
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "We couldn’t load your plan.");
          dispatchFlow({ type: "unavailable" });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authedFetch, exerciseId, exerciseKey, loadPlan, planId, reviewId, sendChunk]);

  // When connectivity returns, send anything still queued.
  useEffect(() => {
    const onOnline = () => void flushOutbox(async (c) => (await sendChunk(c)).result).then(() => setSaveNotice(null));
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [sendChunk]);

  // ── Chunk lifecycle ───────────────────────────────────────────────────────
  /** Gets the next stretch of reps ready (fresh chunk id, engine reset). The countdown, not this, starts the set. */
  const prepareChunk = useCallback(
    (ex: ExerciseProgress) => {
      const cur = ex.currentSetIndex !== null ? ex.sets[ex.currentSetIndex] : null;
      if (!cur) return;
      chunkIdRef.current = uuid();
      chunkStartRef.current = new Date();
      chunkSubmittedRef.current = false;
      endingRef.current = false;
      setChunkSaved(false);
      setChunkTarget(cur.remainingReps);
      setCurrentSet(cur.index + 1);
      setManualCount(0);
      manualCountRef.current = 0;
      configureEngine(toleranceRef.current);
      resetSession(cur.remainingReps, cur.index + 1, cur.completedReps);
    },
    [configureEngine, resetSession, setChunkTarget]
  );

  /** The camera starts once, at the camera check, and stays on until the exercise ends. */
  const startCameraOnce = useCallback(() => {
    if (cameraStartedRef.current) return;
    cameraStartedRef.current = true;
    void startCamera();
  }, [startCamera]);

  /** Adds a finished chunk to the running totals of the set it belongs to (starting afresh when a new set begins). */
  const noteSetStats = useCallback((setIndex: number, add: { good?: number; invalid?: number; partial?: number; rom?: number; fixed?: number }) => {
    const cur = setStatsRef.current.setIndex === setIndex ? setStatsRef.current : { setIndex, good: 0, invalid: 0, partial: 0, rom: 0, fixed: 0 };
    setStatsRef.current = { setIndex, good: cur.good + (add.good ?? 0), invalid: cur.invalid + (add.invalid ?? 0), partial: cur.partial + (add.partial ?? 0), rom: Math.max(cur.rom, add.rom ?? 0), fixed: cur.fixed + (add.fixed ?? 0) };
  }, []);

  const buildChunk = useCallback((): OutboxChunk | null => {
    const ex = progressRef.current;
    if (modeRef.current === "manual") {
      if (!ex || ex.currentSetIndex === null || manualCountRef.current <= 0) return null;
      // Counted by the patient: no range, no form score, no per-rep judgment.
      noteSetStats(ex.currentSetIndex, { good: manualCountRef.current });
      return {
        chunkId: chunkIdRef.current,
        prescriptionId: planId,
        exerciseKey,
        setIndex: ex.currentSetIndex,
        reps: manualCountRef.current,
        source: "manual",
        startedAt: chunkStartRef.current.toISOString(),
        endedAt: new Date().toISOString(),
        day: new Date().toDateString(),
      };
    }
    const summary = getSummary();
    // A stretch with no good rep but real attempts is still saved: those attempts are the patient's effort, and the therapist's picture of it.
    const notCounted = summary ? summary.invalid + summary.partial + summary.uncertain : 0;
    if (!ex || ex.currentSetIndex === null || !summary || (summary.counted <= 0 && notCounted <= 0)) return null;
    noteSetStats(ex.currentSetIndex, { good: summary.counted, invalid: summary.invalid, partial: summary.partial, rom: summary.rom, fixed: summary.corrections.succeeded });
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
      ...(finishedEarlyRef.current ? { finishedEarly: { reason: "not_counted" as const } } : {}),
      day: new Date().toDateString(),
    };
  }, [exerciseKey, getSummary, noteSetStats, planId]);

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
      if (r.session) {
        setFacts(r.session);
        factsRef.current = r.session;
      }
      if (r.highlights) setHighlights(r.highlights);
      setSaveNotice(null);
      setChunkSaved(true);
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

  /** Checks what the set just finished earned. Pure facts in, verified milestones out; nothing is claimed that the numbers do not show. */
  const buildCelebration = useCallback(
    (setIndex: number, totalSets: number, exerciseComplete: boolean, routineComplete: boolean): SetCelebration => {
      const st = setStatsRef.current.setIndex === setIndex ? setStatsRef.current : { good: 0, invalid: 0, partial: 0, rom: 0, fixed: 0 };
      return evaluateSet({
        setNumber: setIndex + 1,
        totalSets,
        exerciseComplete,
        routineComplete,
        judged: modeRef.current === "camera",
        goodOnly: true,
        good: st.good,
        invalid: st.invalid,
        partial: st.partial,
        rom: st.rom > 0 ? st.rom : undefined,
        romUnit: template.rep.unit,
        targetRom: factsRef.current?.targetRom,
        personalBest: personalBestRef.current,
        correctionsSucceeded: st.fixed,
      });
    },
    [template.rep.unit]
  );

  const finishExercise = useCallback(
    async (ex: ExerciseProgress | null) => {
      await stopRecording();
      stopCamera();
      dispatchFlow({ type: "finish" });
      let routineDone = false;
      try {
        const data = await loadPlan();
        setSnap(data);
        const next = data.daily?.exercises.find((e) => e.status !== "complete" && e.key !== exerciseKey);
        setNextExercise(next ? { exerciseId: next.exerciseId, key: next.key, name: next.name } : null);
        const r = routineFrom(data);
        setRoutine(r);
        routineDone = r !== null;
        if (r) say("Today’s routine is complete. Well done.");
      } catch {
        /* the done screen still works without the next-exercise hint */
      }
      if (ex) {
        // The biggest moments: the exercise is done, and possibly the whole day.
        const c = buildCelebration(ex.targetSets - 1, ex.targetSets, true, routineDone);
        setCelebration(c);
        fire(c.level, { on: voiceEnabled, volume: voiceSettings.volume });
      }
      if (ex && reviewId && wantsRecording && hasClip()) void uploadRecording();
    },
    [buildCelebration, exerciseKey, fire, hasClip, loadPlan, reviewId, say, setNextExercise, setSnap, stopCamera, stopRecording, uploadRecording, voiceEnabled, voiceSettings.volume, wantsRecording]
  );

  const endChunk = useCallback(
    async (kind: "pause" | "set_complete") => {
      if (endingRef.current) return;
      endingRef.current = true;
      const cur = progressRef.current;
      if (kind === "set_complete") {
        const lastSet = cur !== null && cur.currentSetIndex !== null && cur.currentSetIndex >= cur.targetSets - 1;
        if (lastSet) say("Exercise complete. Well done.");
        else announceSetComplete();
      }
      const ex = await submitChunk();
      // Whatever ended the chunk, an exercise that is now complete is finished: never leave the patient paused with nothing to resume.
      if (ex && ex.status === "complete") {
        await finishExercise(ex);
        return;
      }
      if (kind === "pause") {
        dispatchFlow({ type: "pause" });
        return;
      }
      setRestSeconds(0);
      if (kind === "set_complete" && cur && cur.currentSetIndex !== null) {
        // A finished set is always marked; a verified milestone makes it bigger, and the best one is said aloud.
        const c = buildCelebration(cur.currentSetIndex, cur.targetSets, false, false);
        setCelebration(c);
        fire(c.level, { on: voiceEnabled, volume: voiceSettings.volume });
        const extra = c.milestones[0];
        if (extra) say(extra.spoken);
      }
      dispatchFlow({ type: "set_complete", exerciseComplete: false });
    },
    [announceSetComplete, buildCelebration, finishExercise, fire, say, setRestSeconds, submitChunk, voiceEnabled, voiceSettings.volume]
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

  // ── Countdown: 3 · 2 · 1, always shown and spoken when the voice is on. "Three" is said when it starts. ───
  useEffect(() => {
    if (phase !== "countdown") return;
    const t = setTimeout(() => {
      say(flow.count > 1 ? ["", "", "Two", "One"][flow.count] ?? "" : "Begin.", true);
      dispatchFlow({ type: "tick" });
    }, 1000);
    return () => clearTimeout(t);
  }, [phase, flow.count, say]);

  // Manual mode: when the patient has tapped the last rep of this part of the set, save it a moment later.
  useEffect(() => {
    if (mode !== "manual" || phase !== "active" || manualCount < chunkTarget || endingRef.current) return;
    const t = setTimeout(() => void endChunk("set_complete"), 900);
    return () => clearTimeout(t);
  }, [mode, phase, manualCount, chunkTarget, endChunk]);

  /** Carries on without the camera. Reps already counted by the camera are saved first. */
  const switchToManual = useCallback(async () => {
    if (phaseRef.current === "active") await submitChunk();
    stopCamera();
    const ex = progressRef.current;
    const startsCountdown = phaseRef.current === "intro" || phaseRef.current === "ready";
    if (ex && startsCountdown) prepareChunk(ex);
    dispatchFlow({ type: "use_manual" });
    if (startsCountdown) say("Three", true);
  }, [prepareChunk, say, stopCamera, submitChunk]);

  /** Starts a set, or resumes after a pause, through the countdown. */
  const beginSet = useCallback(
    (event: "ready" | "begin_set") => {
      setCelebration(null);
      if (progressRef.current) prepareChunk(progressRef.current);
      dispatchFlow({ type: event });
      say("Three", true);
    },
    [prepareChunk, say]
  );

  /** Pauses (saving what was done so far) or cancels a countdown. One path for the button, the keyboard and "the person left the frame". */
  const pauseNow = useCallback(() => {
    const u = uiRef.current;
    const work = modeRef.current === "camera" && ((u?.counted ?? 0) > 0 || (u?.notCounted ?? 0) > 0);
    if (phaseRef.current === "active" && work) void endChunk("pause");
    else dispatchFlow({ type: "pause" });
  }, [endChunk]);

  // Hands-free: nobody in view for a few seconds pauses the set (reps so far are saved); when the person is back and seen clearly, it offers the 3·2·1
  // again by itself. Nothing is lost and nobody is told off for stepping away. A pause the patient chose is never undone for them.
  const lostSinceRef = useRef<number | null>(null);
  const foundSinceRef = useRef<number | null>(null);
  const autoPausedRef = useRef(false);
  useEffect(() => {
    if (mode !== "camera") return;
    const id = setInterval(() => {
      const u = uiRef.current;
      const now = Date.now();
      const ph = phaseRef.current;
      if (ph === "active") {
        foundSinceRef.current = null;
        if (!u.tracking && !cameraErrorRef.current && u.status === "running") {
          lostSinceRef.current ??= now;
          if (now - lostSinceRef.current >= AUTO_PAUSE_MS) {
            lostSinceRef.current = null;
            autoPausedRef.current = true;
            say("Paused. Step back in when you’re ready.", true);
            pauseNow();
          }
        } else {
          lostSinceRef.current = null;
        }
      } else if (ph === "paused") {
        lostSinceRef.current = null;
        if (autoPausedRef.current && u.tracking && u.confidence !== "LOW") {
          foundSinceRef.current ??= now;
          if (now - foundSinceRef.current >= AUTO_RESUME_MS) {
            foundSinceRef.current = null;
            autoPausedRef.current = false;
            beginSet("begin_set");
          }
        } else {
          foundSinceRef.current = null;
        }
      } else {
        lostSinceRef.current = null;
        foundSinceRef.current = null;
        if (ph !== "loading" && ph !== "intro") autoPausedRef.current = false;
      }
    }, 500);
    return () => clearInterval(id);
  }, [mode, beginSet, pauseNow, say]);

  const anyDialogOpen = settingsOpen || guideOpen || confirmEnd || confirmFinishEarly || detailsOpen;
  // Hands-free rest, only if the patient chose it: the next set starts itself (through the 3·2·1) after the chosen time. Never while a dialog is open.
  useEffect(() => {
    if (mode !== "camera" || phase !== "rest" || startForMe === 0 || anyDialogOpen) return;
    const t = setTimeout(() => beginSet("begin_set"), startForMe * 1000);
    return () => clearTimeout(t);
  }, [mode, phase, startForMe, anyDialogOpen, beginSet]);

  // Keyboard and presenter clicker: Space, Enter, Page Down or Right Arrow carry on (start, next set, resume); P, Page Up, Left Arrow or Escape pause.
  useEffect(() => {
    if (mode !== "camera" || anyDialogOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target instanceof HTMLElement ? e.target : null;
      const onControl = Boolean(el?.closest("button, a, input, select, textarea, summary, [contenteditable='true']"));
      const forward = e.key === "PageDown" || e.key === "ArrowRight" || ((e.key === " " || e.key === "Enter") && !onControl);
      const back = e.key === "PageUp" || e.key === "ArrowLeft" || e.key === "Escape" || e.key === "p" || e.key === "P";
      const ph = phaseRef.current;
      if (forward) {
        if (ph === "ready" && isCameraReady(uiRef.current)) beginSet("ready");
        else if (ph === "rest" || ph === "paused") beginSet("begin_set");
        else return;
      } else if (back) {
        if (ph === "active" || ph === "countdown") pauseNow();
        else return;
      } else {
        return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, anyDialogOpen, beginSet, pauseNow]);

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

  if (phase === "intro" && progress) {
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
          steps={exercise.instructions}
          lastTime={lastTime}
          onStart={() => {
            VoiceService.prime();
            primeCheer();
            startCameraOnce();
            dispatchFlow({ type: "start" });
          }}
          onManual={() => {
            VoiceService.prime();
            primeCheer();
            void switchToManual();
          }}
        />
      </AppShell>
    );
  }

  if (phase === "done" && progress) {
    return (
      <>
      <Celebration burst={burst} />
      <AppShell title="Exercise done" showBackNav backHref="/" maxWidth="default">
        <SessionDone
          celebrate={celebration !== null}
          progress={progress}
          bestRom={bestRom}
          romUnit={template.rep.unit}
          sessionId={sessionId}
          facts={facts}
          highlights={highlights}
          routine={routine}
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
      </>
    );
  }

  // Everything from the camera check to the rest between sets. The camera, once started, stays on.
  const ui = session.ui;
  const manual = mode === "manual";
  const chunkReps = manual ? manualCount : ui.counted;
  // Anything worth saving: good reps, or attempts that did not count.
  const hasWork = chunkReps > 0 || (!manual && ui.notCounted > 0);
  const base = set ? set.completedReps : 0;
  const setTarget = set?.targetReps ?? chunkTarget;
  const paused = phase !== "active";
  // Reps in this set so far. Once a chunk is saved its reps are already in `base`, so they are not added again while paused or resting.
  const doneInSet = set ? base + (phase === "rest" || (phase === "paused" && chunkSaved) ? 0 : chunkReps) : 0;
  const askStop = () => (hasWork || (progress?.completedReps ?? 0) > 0 ? setConfirmEnd(true) : void leave("/"));
  const setLabel = set && progress ? `Set ${set.index + 1} of ${progress.targetSets}` : "";

  const restPanel =
    phase === "rest" && progress && set ? (
      <RestPanel
        setDone={set.index}
        totalSets={progress.targetSets}
        nextSetReps={set.targetReps}
        targetReps={progress.targetReps}
        completedReps={progress.completedReps}
        restSeconds={restSeconds}
        saveNotice={saveNotice}
        celebration={celebration}
        onStartNext={() => beginSet("begin_set")}
        onStop={() => void leave("/")}
      />
    ) : null;

  const onTogglePause = () => {
    if (phase === "paused") beginSet("begin_set");
    else if (phase === "active" && hasWork) void endChunk("pause");
    else dispatchFlow({ type: "pause" });
  };

  let main: ReactNode;
  if (manual) {
    main = (
      <AppShell title={exercise.name} hideNav>
        {restPanel ? (
          <div className="mx-auto max-w-xl pt-2">{restPanel}</div>
        ) : phase === "countdown" ? (
          <div className="mx-auto max-w-xl space-y-4 pt-2">
            <div className="h-80 w-full overflow-hidden rounded-lg bg-slate-900"><Countdown count={flow.count} /></div>
            <Button size="lg" variant="outline" className="w-full" onClick={() => dispatchFlow({ type: "pause" })}>Not yet</Button>
          </div>
        ) : (
          <>
            {voiceSettings.captions && <div className="mx-auto mb-4 max-w-xl"><CaptionsBar lines={captionLines} /></div>}
            {saveNotice && <div className="mx-auto mb-4 max-w-xl"><Notice tone="warning" title="Not saved yet">{saveNotice}</Notice></div>}
            <ManualCounter
              name={exercise.name}
              setLabel={`${setLabel}${base > 0 ? `, ${base} saved earlier` : ""}`}
              count={manualCount}
              target={chunkTarget}
              instruction={exercise.instructions[0] ?? template.setup.instruction}
              paused={phase === "paused"}
              onAdd={() => setManualCount((n) => Math.min(chunkTarget, n + 1))}
              onUndo={() => setManualCount((n) => Math.max(0, n - 1))}
              onPause={onTogglePause}
              onResume={onTogglePause}
              onFinish={() => void endChunk("set_complete")}
            />
          </>
        )}
        <div className="mx-auto mt-6 max-w-xl"><Button size="lg" variant="ghost" onClick={askStop}>Stop for now</Button></div>
      </AppShell>
    );
  } else if (LIVE_V2) {
    const day = snap?.daily?.exercises ?? [];
    const lastOne = day.length > 1 && day.filter((e) => e.status !== "complete").length === 1 && day.some((e) => e.key === exerciseKey && e.status !== "complete");
    main = (
      <LiveStage
        mode={phase === "ready" ? "ready" : phase === "countdown" ? "countdown" : phase === "paused" ? "paused" : phase === "rest" ? "rest" : "active"}
        ui={ui}
        videoRef={session.videoRef}
        canvasRef={session.canvasRef}
        error={session.error}
        onRetry={() => void startCamera()}
        onManual={() => void switchToManual()}
        viewScale={viewScale.viewScale}
        title={exercise.name}
        subtitle={phase === "ready" ? "Camera check" : setLabel || undefined}
        tag={lastOne ? "Last one today" : null}
        onBack={askStop}
        actions={
          <>
            {phase === "active" && (
              <StageAction onClick={pauseNow}>
                <Pause className="size-6" aria-hidden="true" /> Pause
              </StageAction>
            )}
            <StageAction onClick={() => setSettingsOpen(true)} label="Voice and sound settings">
              <Volume2 className="size-6" aria-hidden="true" /> <span className="hidden md:inline">Sound</span>
            </StageAction>
            <StageAction onClick={() => setGuideOpen(true)} label="Open the exercise guide">
              <BookOpen className="size-6" aria-hidden="true" /> <span className="hidden md:inline">Guide</span>
            </StageAction>
            <StageAction onClick={() => setDetailsOpen(true)} label="Details">
              <Info className="size-6" aria-hidden="true" /> <span className="hidden md:inline">Details</span>
            </StageAction>
          </>
        }
        goodInSet={doneInSet}
        setTarget={setTarget}
        setLabel={setLabel}
        captions={voiceSettings.captions ? captionLines : undefined}
        notice={saveNotice}
        calibration={{ calibrated: viewScale.calibrated, canGrow: viewScale.canGrow, onYes: viewScale.confirm, onBigger: viewScale.bigger }}
        cameraReady={isCameraReady(ui)}
        placementHint={template.camera.hint}
        onReady={() => {
          // Pressing start without answering the reading check accepts the current text size.
          if (!viewScale.calibrated) viewScale.confirm();
          beginSet("ready");
        }}
        count={flow.count}
        onNotYet={() => dispatchFlow({ type: "pause" })}
        onResume={() => beginSet("begin_set")}
        onStop={() => (phase === "rest" ? void leave("/") : askStop())}
        celebration={celebration}
        setsDone={set?.index ?? 0}
        totalSets={progress?.targetSets ?? 1}
        nextSetReps={set?.targetReps ?? 0}
        restSeconds={restSeconds}
        onStartNext={() => beginSet("begin_set")}
        onOpenGuide={() => setGuideOpen(true)}
        onFinishEarly={() => setConfirmFinishEarly(true)}
      />
    );
  } else {
    main = (
      <FocusFrame
        title={exercise.name}
        subtitle={phase === "ready" ? "Camera check" : set ? `Set ${set.index + 1} of ${progress?.targetSets} · ${doneInSet} of ${setTarget} reps` : undefined}
        backLabel="Stop"
        onBack={askStop}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)} aria-label="Voice and sound settings">
              <Volume2 className="size-4" aria-hidden="true" /> <span className="hidden sm:inline">Sound</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setGuideOpen(true)}>
              <BookOpen className="size-4" aria-hidden="true" /> Guide
            </Button>
          </>
        }
        camera={
          <MovementStage videoRef={session.videoRef} canvasRef={session.canvasRef} ui={ui} error={session.error} onRetry={() => void startCamera()} onManual={() => void switchToManual()} quiet={phase !== "active" && phase !== "ready"}>
            {phase === "countdown" && <Countdown count={flow.count} />}
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
        panelTop={voiceSettings.captions ? <CaptionsBar lines={captionLines} /> : undefined}
        panel={
          phase === "ready" ? (
            <ReadyCheck ui={ui} hint={template.camera.hint} onReady={() => beginSet("ready")} onManual={() => void switchToManual()} />
          ) : phase === "countdown" ? (
            <div className="flex flex-col gap-4 p-4 sm:p-5">
              <p className="text-xl font-bold text-slate-900">Get ready</p>
              <p className="text-base text-slate-800">Take your starting position. The set begins in {flow.count}.</p>
              <Button size="lg" variant="outline" onClick={() => dispatchFlow({ type: "pause" })}>Not yet</Button>
            </div>
          ) : restPanel ? (
            restPanel
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
                contextLabel={set && progress ? setLabel : undefined}
                contextDetail={set ? (base > 0 ? `${base} saved earlier in this set; this part counts up to ${chunkTarget} more.` : `${setTarget} reps in this set`) : undefined}
                pauseLabel="Pause and rest"
                endLabel="Stop for now"
                reachedLabel="Finish set"
                onTogglePause={onTogglePause}
                onFinish={() => (ui.done ? void endChunk("set_complete") : setConfirmEnd(true))}
                onOpenGuide={() => setGuideOpen(true)}
                onFinishEarly={() => setConfirmFinishEarly(true)}
              />
            </>
          )
        }
      />
    );
  }

  return (
    <>
      {main}
      <Celebration burst={burst} />

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} voiceEnabled={voiceEnabled} onVoiceEnabled={setVoiceEnabled} settings={voiceSettings} onChange={updateVoiceSettings} language={language} viewScale={LIVE_V2 && mode === "camera" ? viewScale.viewScale : undefined} onViewScale={LIVE_V2 && mode === "camera" ? viewScale.setViewScale : undefined} startForMe={mode === "camera" ? startForMe : undefined} onStartForMe={mode === "camera" ? (s) => { setStartForMe(s); setStartForMeState(s); } : undefined} />
      <StageDetails
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        ui={ui}
        therapistTip={meta?.instructions ?? null}
        therapistName={rx?.doctorName ?? null}
        onOpenGuide={() => {
          setDetailsOpen(false);
          setGuideOpen(true);
        }}
        captionLines={captionLines}
      />
      <PoseGuidePanel isOpen={guideOpen} onOpenChange={setGuideOpen} exerciseId={exercise.id} exerciseName={exercise.name} instructions={exercise.instructions} />

      <Dialog
        open={confirmFinishEarly}
        onClose={() => setConfirmFinishEarly(false)}
        title="Finish for today?"
        description={`Your ${chunkReps} good ${chunkReps === 1 ? "rep is" : "reps are"} saved. Your therapist will see how it went. Your prescription doesn’t change.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmFinishEarly(false)}>Keep trying</Button>
            <Button
              onClick={() => {
                finishedEarlyRef.current = true;
                setConfirmFinishEarly(false);
                void leave("/");
              }}
            >
              Finish for today
            </Button>
          </>
        }
      >
        <p className="text-base text-slate-800">There’s no rush. You can pick this up again next time.</p>
      </Dialog>

      <Dialog
        open={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        title="Stop for now?"
        description={hasWork && phase === "active" ? (chunkReps > 0 ? `Your ${chunkReps} good ${chunkReps === 1 ? "rep is" : "reps are"} saved to this set.` : "Your attempts are saved. No good reps yet, and your target doesn’t change.") : "Everything you have finished is already saved."}
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
