/**
 * lib/movement/runtime/mediapipe.ts
 *
 * Where the MediaPipe runtime and model come from. The wasm is pinned to the exact version
 * of @mediapipe/tasks-vision in package.json: loading `@latest` risks the JavaScript API and
 * the wasm drifting apart after a release. A test keeps this constant in step with the
 * installed package. Override the base URL (for example to self-host the wasm) with
 * NEXT_PUBLIC_MEDIAPIPE_WASM_BASE.
 */
export const MEDIAPIPE_VERSION = "1.0.1";

export const MEDIAPIPE_WASM_BASE =
  process.env.NEXT_PUBLIC_MEDIAPIPE_WASM_BASE || `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;

/** Served from /public. This is the lite pose model (about 5.8 MB). */
export const POSE_MODEL_PATH = process.env.NEXT_PUBLIC_POSE_MODEL || "/models/pose_landmarker.task";

/**
 * Hand landmarks (21 points per hand) are drawn for context only; they never feed judgment.
 * Same model the previous version used. Override to self-host. Hands run every third frame.
 */
export const HAND_MODEL_PATH =
  process.env.NEXT_PUBLIC_HAND_MODEL ||
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
