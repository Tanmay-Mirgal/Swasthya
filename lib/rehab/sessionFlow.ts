/**
 * lib/rehab/sessionFlow.ts
 *
 * The shape of one prescribed exercise as the patient lives it, as a small pure state machine so every
 * transition can be tested without a camera or a browser:
 *
 *   loading → intro → ready (camera check) → countdown 3·2·1 → active ⇄ paused → rest → countdown → active … → done
 *
 * "Manual" mode is the same flow without the camera: the patient taps each rep themselves. Nothing here judges
 * movement; the engine does that, and only while the phase is `active` in camera mode.
 */

export type FlowPhase = "loading" | "unavailable" | "intro" | "ready" | "countdown" | "active" | "paused" | "rest" | "done";
export type FlowMode = "camera" | "manual";

/** Seconds counted down before every set (and after every pause), so nobody is rushed into position. */
export const COUNTDOWN_FROM = 3;

export interface FlowState {
  phase: FlowPhase;
  mode: FlowMode;
  /** The number on screen during the countdown (3, 2, 1); 0 otherwise. */
  count: number;
}

export type FlowEvent =
  | { type: "loaded"; complete: boolean }
  | { type: "unavailable" }
  /** The patient pressed Start on the intro. */
  | { type: "start" }
  /** The patient chose to continue without the camera (or the camera could not start). */
  | { type: "use_manual" }
  /** The camera check passed and the patient confirmed they are ready. */
  | { type: "ready" }
  /** Start the next set, or resume after a pause. */
  | { type: "begin_set" }
  | { type: "tick" }
  | { type: "pause" }
  | { type: "set_complete"; exerciseComplete: boolean }
  | { type: "finish" };

export const initialFlow = (): FlowState => ({ phase: "loading", mode: "camera", count: 0 });

const counting = (s: FlowState): FlowState => ({ ...s, phase: "countdown", count: COUNTDOWN_FROM });

/** Next state for an event. An event that does not apply in the current phase changes nothing. */
export function flowReducer(s: FlowState, e: FlowEvent): FlowState {
  switch (e.type) {
    case "loaded":
      return s.phase === "loading" ? { ...s, phase: e.complete ? "done" : "intro" } : s;
    case "unavailable":
      return s.phase === "loading" ? { ...s, phase: "unavailable" } : s;
    case "start":
      if (s.phase !== "intro") return s;
      return s.mode === "manual" ? counting(s) : { ...s, phase: "ready" };
    case "use_manual":
      if (s.mode === "manual") return s;
      if (s.phase === "intro" || s.phase === "ready") return counting({ ...s, mode: "manual" });
      if (s.phase === "active") return { ...s, mode: "manual", phase: "paused", count: 0 }; // the camera went away mid-set
      if (s.phase === "paused" || s.phase === "rest" || s.phase === "countdown") return { ...s, mode: "manual" };
      return s;
    case "ready":
      return s.phase === "ready" ? counting(s) : s;
    case "begin_set":
      return s.phase === "rest" || s.phase === "paused" ? counting(s) : s;
    case "tick":
      if (s.phase !== "countdown") return s;
      return s.count > 1 ? { ...s, count: s.count - 1 } : { ...s, phase: "active", count: 0 };
    case "pause":
      return s.phase === "active" || s.phase === "countdown" ? { ...s, phase: "paused", count: 0 } : s;
    case "set_complete":
      return s.phase === "active" || s.phase === "paused" ? { ...s, phase: e.exerciseComplete ? "done" : "rest", count: 0 } : s;
    case "finish":
      return s.phase === "done" ? s : { ...s, phase: "done", count: 0 };
  }
}

/** True while the movement engine should be judging frames. */
export const isJudging = (s: FlowState): boolean => s.mode === "camera" && s.phase === "active";

/** True while the camera window is shown (it stays on from the camera check until the exercise ends). */
export const showsCamera = (s: FlowState): boolean => s.mode === "camera" && (s.phase === "ready" || s.phase === "countdown" || s.phase === "active" || s.phase === "paused" || s.phase === "rest");
