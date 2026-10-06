"use client";

/**
 * hooks/useMovementSession.ts
 *
 * Runs the whole movement-intelligence loop in the browser for one exercise:
 *
 *   camera → MediaPipe → MovementEngine (deterministic) → overlay (drawn here, not via React)
 *                                         └─ events → coach reducer → cue / voice / model
 *
 * React state is only touched when something a person can see changes (a rep, a cue, a
 * phase, the confidence level, a joint changing colour) and at a few Hz for numeric
 * readouts. The skeleton is drawn imperatively every frame. Nothing in the frame loop
 * waits on the network: the language model is asked for wording only when the coach
 * decides it is worth it, and the loop works identically without it.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { FilesetResolver, HandLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";
import { MovementEngine, type ChunkSummary } from "@/lib/movement/judge/engine";
import { createCoachState, reduceCoach, type CoachEffect, type CoachInput, type CoachState, type Observation } from "@/lib/movement/coach/coachState";
import { buildMovementUi, initialUi, uiSignature, type MovementUi } from "@/lib/movement/ui/movementUi";
import { requestCoachCue } from "@/lib/movement/coach/llm";
import { HAND_MODEL_PATH, MEDIAPIPE_WASM_BASE, POSE_MODEL_PATH } from "@/lib/movement/runtime/mediapipe";
import type { MovementTemplate } from "@/lib/movement/template/schema";
import type { MovementEvent } from "@/lib/movement/types";
import { drawOverlay } from "@/components/movement/overlay";
import VoiceService from "@/services/voice/voiceService";

export interface UseMovementSessionOptions {
  template: MovementTemplate;
  targetReps: number;
  paused?: boolean;
  /** 1-based set number, for the coach's records. */
  set?: number;
  autoStart?: boolean;
  voiceEnabled?: boolean;
  /** Ask the language model for wording when it helps. Off = fully deterministic. */
  llmEnabled?: boolean;
  getToken?: () => Promise<string | null>;
  onStream?: (stream: MediaStream | null) => void;
  /** Called once when the target number of reps has been counted. */
  onDone?: () => void;
  onRepCompleted?: (e: Extract<MovementEvent, { type: "rep_completed" }>) => void;
}

export type { MovementUi, JointStatus } from "@/lib/movement/ui/movementUi";

const UI_SYNC_MS = 250;

export function useMovementSession(opts: UseMovementSessionOptions) {
  const { template } = opts;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [ui, setUi] = useState<MovementUi>(() => initialUi(template, opts.targetReps));
  const [error, setError] = useState<string | null>(null);

  // Latest props for the frame loop, which must not be recreated when they change.
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });

  const engineRef = useRef<MovementEngine | null>(null);
  const coachRef = useRef<CoachState | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const handsRef = useRef<{ x: number; y: number }[][] | null>(null);
  const handFrameRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const generationRef = useRef(0);
  const observationsRef = useRef<Observation[]>([]);
  const lastSigRef = useRef("");
  const lastSyncRef = useRef(0);
  const doneFiredRef = useRef(false);
  const statusRef = useRef<MovementUi["status"]>("idle");
  const fpsRef = useRef({ frames: 0, since: 0, value: 0 });
  const bestRomRef = useRef(0);
  const lastRepMsRef = useRef(0);
  const repFlagsRef = useRef<boolean[]>([]);
  const pausedRef = useRef(false);
  // Development aid: ?landmarkDebug=1 overlays coordinates and sizes. Off unless asked for.
  const debugRef = useRef(false);
  useEffect(() => {
    debugRef.current = new URLSearchParams(window.location.search).get("landmarkDebug") === "1";
  }, []);
  const dispatchRef = useRef<(input: CoachInput) => void>(() => undefined);

  // ── UI sync ─────────────────────────────────────────────────────────────────
  const syncUi = useCallback((force = false) => {
    const engine = engineRef.current;
    const coach = coachRef.current;
    if (!engine || !coach) return;
    const next = buildMovementUi(engine.result, coach, optsRef.current.template, {
      status: statusRef.current,
      rom: bestRomRef.current,
      lastRepMs: lastRepMsRef.current,
      repFlags: repFlagsRef.current,
      fps: fpsRef.current.value,
    });
    const sig = uiSignature(next);
    if (!force && sig === lastSigRef.current) return;
    lastSigRef.current = sig;
    setUi(next);
  }, []);

  // ── Coach ────────────────────────────────────────────────────────────────────
  const dispatch = useCallback(
    (input: CoachInput) => {
      const coach = coachRef.current;
      if (!coach) return;
      const o = optsRef.current;
      const { state, effects } = reduceCoach(coach, input, o.template, { llmEnabled: Boolean(o.llmEnabled) });
      coachRef.current = state;
      for (const fx of effects) runEffect(fx);
      if (effects.some((e) => e.kind === "cue" || e.kind === "clear_cue")) syncUi();

      function runEffect(fx: CoachEffect) {
        if (fx.kind === "speak") {
          if (optsRef.current.voiceEnabled !== false) VoiceService.speak(fx.text, { interrupt: fx.interrupt });
        } else if (fx.kind === "stop_speech") {
          VoiceService.stop();
        } else if (fx.kind === "observe") {
          observationsRef.current = [...observationsRef.current.filter((x) => x.code !== fx.observation.code), fx.observation];
        } else if (fx.kind === "llm") {
          void (async () => {
            const token = optsRef.current.getToken ? await optsRef.current.getToken().catch(() => null) : null;
            const text = await requestCoachCue(fx.request, { token: token ?? undefined });
            dispatchRef.current({ type: "llm_result", t: performance.now(), code: fx.code, tier: fx.tier, text });
          })();
        }
      }
    },
    [syncUi]
  );

  useEffect(() => {
    dispatchRef.current = dispatch;
  }, [dispatch]);

  // ── Lifecycle ────────────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    generationRef.current++;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      optsRef.current.onStream?.(null);
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    handLandmarkerRef.current?.close();
    handLandmarkerRef.current = null;
    handsRef.current = null;
    VoiceService.stop();
    statusRef.current = "idle";
  }, []);

  const start = useCallback(async () => {
    const gen = ++generationRef.current;
    const stale = () => generationRef.current !== gen;
    try {
      setError(null);
      statusRef.current = "loading";
      syncUi(true);

      const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_BASE);
      if (stale()) return;
      const create = (delegate: "GPU" | "CPU") =>
        PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: POSE_MODEL_PATH, delegate },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      let landmarker: PoseLandmarker;
      try {
        landmarker = await create("GPU");
      } catch {
        landmarker = await create("CPU"); // some devices have no usable GPU delegate
      }
      if (stale()) {
        landmarker.close();
        return;
      }
      landmarkerRef.current = landmarker;
      // Hands load in the background so the camera starts at once. Failure is non-critical.
      void (async () => {
        for (const delegate of ["GPU", "CPU"] as const) {
          try {
            const hl = await HandLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: HAND_MODEL_PATH, delegate }, runningMode: "VIDEO", numHands: 2 });
            if (stale()) hl.close();
            else handLandmarkerRef.current = hl;
            return;
          } catch {
            /* try the next delegate */
          }
        }
      })();

      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }, audio: false });
      if (stale()) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      optsRef.current.onStream?.(stream);
      // The page may mount the video element in the same tick it asks us to start.
      for (let i = 0; i < 60 && !videoRef.current && !stale(); i++) await new Promise((r) => requestAnimationFrame(() => r(null)));
      if (stale()) return;
      const video = videoRef.current;
      if (!video) throw new Error("The video element is not ready.");
      video.srcObject = stream;
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => resolve();
      });
      await video.play();
      if (stale()) return;

      statusRef.current = "running";
      fpsRef.current = { frames: 0, since: performance.now(), value: 0 };
      let lastVideoTime = -1;

      const loop = () => {
        if (stale()) return;
        const engine = engineRef.current;
        const v = videoRef.current;
        const canvas = canvasRef.current;
        if (engine && v && canvas && v.readyState >= 2 && v.currentTime !== lastVideoTime) {
          lastVideoTime = v.currentTime;
          const now = performance.now();
          if (canvas.width !== v.videoWidth || canvas.height !== v.videoHeight) {
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
          }
          const ctx = canvas.getContext("2d");
          if (pausedRef.current) {
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
          } else {
            const hl = handLandmarkerRef.current;
            if (hl && ++handFrameRef.current % 3 === 0) {
              try {
                const hr = hl.detectForVideo(v, now);
                handsRef.current = hr.landmarks && hr.landmarks.length ? hr.landmarks : null;
              } catch {
                /* ignore a bad hand frame */
              }
            }
            const res = landmarker.detectForVideo(v, now);
            const result = engine.process({
              t: now,
              image: res.landmarks && res.landmarks.length ? res.landmarks[0] : null,
              world: res.worldLandmarks && res.worldLandmarks.length ? res.worldLandmarks[0] : null,
              aspect: v.videoWidth / Math.max(1, v.videoHeight),
            });
            if (ctx) {
              const dbg = debugRef.current ? { boxW: canvas.clientWidth, boxH: canvas.clientHeight } : undefined;
              drawOverlay(ctx, result, canvas.width, canvas.height, { debug: dbg, hands: handsRef.current });
            }

            if (result.events.length) {
              for (const e of result.events) {
                if (e.type === "rep_completed") {
                  bestRomRef.current = Math.max(bestRomRef.current, e.rom);
                  lastRepMsRef.current = e.durationMs;
                  repFlagsRef.current = [...repFlagsRef.current, e.valid];
                  optsRef.current.onRepCompleted?.(e);
                }
                dispatch(e);
              }
              syncUi();
            }
            if (result.done && !doneFiredRef.current) {
              doneFiredRef.current = true;
              syncUi(true);
              optsRef.current.onDone?.();
            }
          }
          const f = fpsRef.current;
          f.frames++;
          if (now - f.since >= 1000) {
            f.value = Math.round((f.frames * 1000) / (now - f.since));
            f.frames = 0;
            f.since = now;
          }
          if (now - lastSyncRef.current >= UI_SYNC_MS) {
            lastSyncRef.current = now;
            syncUi();
          }
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);

      tickRef.current = setInterval(() => {
        if (!pausedRef.current) dispatch({ type: "tick", t: performance.now() });
      }, 500);
      syncUi(true);
    } catch (err) {
      if (stale()) return;
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : "Could not start the camera.";
      setError(msg);
      stop();
      statusRef.current = "error";
      syncUi(true);
    }
  }, [dispatch, stop, syncUi]);

  // Create the engine and coach for this exercise, and start the camera.
  useEffect(() => {
    const o = optsRef.current;
    engineRef.current = new MovementEngine(o.template, { targetReps: o.targetReps });
    coachRef.current = createCoachState(o.template, { set: o.set ?? 1 });
    observationsRef.current = [];
    doneFiredRef.current = false;
    bestRomRef.current = 0;
    lastRepMsRef.current = 0;
    repFlagsRef.current = [];
    if (o.autoStart !== false) void start();
    return () => stop();
    // The engine is built for one exercise; the page is keyed by exercise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id]);

  // Pausing stops judgment and speech; resuming continues from the current state.
  useEffect(() => {
    pausedRef.current = Boolean(opts.paused);
    dispatch({ type: "paused", t: performance.now(), paused: Boolean(opts.paused) });
  }, [opts.paused, dispatch]);

  /** Starts a fresh stretch of work (next set, or the next chunk of a set). Camera and model keep running. */
  const reset = useCallback(
    (targetReps: number, set?: number) => {
      engineRef.current?.reset(targetReps);
      doneFiredRef.current = false;
      bestRomRef.current = 0;
      lastRepMsRef.current = 0;
      repFlagsRef.current = [];
      observationsRef.current = [];
      dispatch({ type: "set_started", t: performance.now(), set: set ?? optsRef.current.set ?? 1 });
      syncUi(true);
    },
    [dispatch, syncUi]
  );

  /** The chunk's measurements so far: counted / valid / invalid reps, errors, corrections, confidence. */
  const getSummary = useCallback((): (ChunkSummary & { observations: Observation[] }) | null => {
    const s = engineRef.current?.getSummary();
    return s ? { ...s, observations: observationsRef.current.slice() } : null;
  }, []);

  /** Tells the coach a set finished (praise), without touching the engine. */
  const announceSetComplete = useCallback(() => dispatch({ type: "set_complete", t: performance.now() }), [dispatch]);

  return { videoRef, canvasRef, ui, error, start, stop, reset, getSummary, announceSetComplete };
}
