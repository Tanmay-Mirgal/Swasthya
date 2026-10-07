/**
 * lib/movement/ui/overlayLayout.ts
 *
 * Where the big feedback goes on the camera stage so it never covers the person. Pure geometry, no React.
 *
 * The stage has a progress lane (the good-rep count) and a verdict lane (GOOD / NOT COUNTED / CAN'T SEE YOU). On a wide
 * screen they are the left and right edges, which the body rarely reaches; on a tall screen they are the top and bottom
 * bands. When the person is wide or off to one side, both go to the side with room; when neither side has room they
 * shrink to a compact band. The person's box is mapped from the video frame onto the stage with the SAME rules the video
 * itself is drawn with (cover, mirrored), so "where the body is" matches what the patient sees.
 */
import type { BodyBox } from "./movementUi";

export interface StageSize {
  w: number;
  h: number;
}

/** A rectangle as fractions (0..1) of the stage. */
export interface StageRect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export type Anchor = "left" | "right" | "top" | "bottom";

export interface OverlayLayout {
  /** lanes: one on each side. stacked: both on the side with room. compact: neither side has room. */
  mode: "lanes" | "stacked" | "compact";
  orientation: "wide" | "tall";
  progress: Anchor;
  verdict: Anchor;
  /** Thickness of a lane in CSS px: a width for left/right, a height for top/bottom. */
  lane: number;
}

/** Space kept between a lane and the body, in CSS px. */
const GAP = 16;

/**
 * Maps the person's box from video fractions onto the stage, as the video is drawn: scaled to cover the stage,
 * centred, and mirrored left-to-right. Clipped to the stage.
 */
export function bodyInStage(box: BodyBox, videoAspect: number, stage: StageSize, mirror = true): StageRect {
  const stageAspect = stage.w / stage.h;
  // Cover: the video is scaled until it fills both dimensions; the longer one overflows and is cropped equally.
  const overflowX = videoAspect > stageAspect; // video wider than the stage: crop left and right
  const mapX = (x: number) => (overflowX ? 0.5 + (x - 0.5) * (videoAspect / stageAspect) : x);
  const mapY = (y: number) => (overflowX ? y : 0.5 + (y - 0.5) * (stageAspect / videoAspect));
  let x0 = mapX(box.x0), x1 = mapX(box.x1);
  const y0 = mapY(box.y0), y1 = mapY(box.y1);
  if (mirror) [x0, x1] = [1 - x1, 1 - x0];
  const c = (v: number) => Math.min(1, Math.max(0, v));
  return { x0: c(x0), x1: c(x1), y0: c(y0), y1: c(y1) };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The lanes for this person on this stage. `viewScale` (1 to 2) is how much bigger the patient asked the text to be. */
export function chooseLayout(body: StageRect | null, stage: StageSize, viewScale = 1): OverlayLayout {
  const wide = stage.w >= stage.h * 1.05;
  if (wide) {
    const lane = clamp(stage.w * 0.3 * viewScale, 240, stage.w * 0.42);
    if (!body) return { mode: "lanes", orientation: "wide", progress: "left", verdict: "right", lane };
    const freeL = body.x0 * stage.w - GAP;
    const freeR = (1 - body.x1) * stage.w - GAP;
    if (freeL >= lane && freeR >= lane) return { mode: "lanes", orientation: "wide", progress: "left", verdict: "right", lane };
    if (freeR >= lane && freeR >= freeL) return { mode: "stacked", orientation: "wide", progress: "right", verdict: "right", lane };
    if (freeL >= lane) return { mode: "stacked", orientation: "wide", progress: "left", verdict: "left", lane };
    // Neither side has room for a full lane: a compact band on the side with more room, else along the top.
    const compact = clamp(stage.w * 0.2, 180, lane);
    if (Math.max(freeL, freeR) >= compact) {
      const side: Anchor = freeR >= freeL ? "right" : "left";
      return { mode: "compact", orientation: "wide", progress: side, verdict: side, lane: compact };
    }
    return { mode: "compact", orientation: "wide", progress: "top", verdict: "top", lane: clamp(stage.h * 0.22, 120, 220) };
  }
  const band = clamp(stage.h * 0.2 * viewScale, 150, stage.h * 0.34);
  if (!body) return { mode: "lanes", orientation: "tall", progress: "top", verdict: "bottom", lane: band };
  const freeT = body.y0 * stage.h - GAP;
  const freeB = (1 - body.y1) * stage.h - GAP;
  if (freeT >= band && freeB >= band) return { mode: "lanes", orientation: "tall", progress: "top", verdict: "bottom", lane: band };
  if (freeB >= band && freeB >= freeT) return { mode: "stacked", orientation: "tall", progress: "bottom", verdict: "bottom", lane: band };
  if (freeT >= band) return { mode: "stacked", orientation: "tall", progress: "top", verdict: "top", lane: band };
  const compact = clamp(stage.h * 0.14, 110, band);
  const side: Anchor = freeB >= freeT ? "bottom" : "top";
  return { mode: "compact", orientation: "tall", progress: side, verdict: side, lane: compact };
}

/** Layouts are equal when they put the same things in the same places (the exact size may follow the stage). */
export const sameLayout = (a: OverlayLayout, b: OverlayLayout) => a.mode === b.mode && a.orientation === b.orientation && a.progress === b.progress && a.verdict === b.verdict;

export interface LayoutState {
  current: OverlayLayout;
  /** A different layout that has been wanted continuously since `since`. */
  pending: { layout: OverlayLayout; since: number } | null;
}

/**
 * Stops the lanes from jumping around when the person shifts a little: a different layout is only adopted once it has
 * been wanted without a break for `holdMs`. The size always follows the stage immediately.
 */
export function stabilizeLayout(state: LayoutState | null, wanted: OverlayLayout, now: number, holdMs = 1500): LayoutState {
  if (!state) return { current: wanted, pending: null };
  if (sameLayout(state.current, wanted)) return { current: { ...state.current, lane: wanted.lane }, pending: null };
  if (state.pending && sameLayout(state.pending.layout, wanted)) {
    return now - state.pending.since >= holdMs ? { current: wanted, pending: null } : { current: state.current, pending: { layout: wanted, since: state.pending.since } };
  }
  return { current: state.current, pending: { layout: wanted, since: now } };
}
