/**
 * components/movement/overlay.ts
 *
 * Draws the skeleton for one frame, straight onto a canvas, outside React. The colour of a
 * joint or bone is the engine's verdict, not decoration:
 *
 *   GREEN   tracked, within tolerance        RED     sustained deviation (drawn bigger, ringed, crossed)
 *   YELLOW  not seen clearly enough to judge (hollow, dashed ring)
 *   white   not part of this exercise (small, quiet)
 *
 * Red and yellow differ from green by SHAPE as well as colour, so it reads without colour vision.
 * The canvas is sized to the video's pixel size and styled like the video (object-cover,
 * mirrored), so normalised landmark coordinates land on the right pixels.
 */
import { BODY_SEGMENTS, DRAWN_LANDMARKS } from "@/lib/movement/landmarks";
import type { FrameResult } from "@/lib/movement/judge/engine";
import { JOINT_ERROR, JOINT_NEUTRAL, JOINT_OK, JOINT_UNCERTAIN } from "@/lib/movement/types";

export const OVERLAY_COLORS = {
  ok: "#35C47C",
  error: "#FF4D3D",
  uncertain: "#FFD23F",
  neutral: "rgba(255,255,255,0.62)",
  underStroke: "rgba(8,12,10,0.55)",
  ringInk: "#0B1410",
} as const;

/** Face outline and hand/foot stubs of the 33-point pose, drawn as quiet context (not judged). */
const CONTEXT_SEGMENTS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8], [9, 10],
  [15, 17], [15, 19], [17, 19], [15, 21], [16, 18], [16, 20], [18, 20], [16, 22],
];
/** Pose points that are drawn as quiet dots when the exercise is not judging them. */
const CONTEXT_POINTS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 17, 18, 19, 20, 21, 22];

/** MediaPipe's 21-point hand skeleton. */
const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];
export type HandPoints = ReadonlyArray<ReadonlyArray<{ x: number; y: number }>>;

/** Landmarks fainter than this are not drawn at all. */
const MIN_DRAW_VISIBILITY = 0.25;

const colorOfBone = (j: Uint8Array, a: number, b: number, red: boolean) => {
  if (red) return OVERLAY_COLORS.error;
  if (j[a] === JOINT_UNCERTAIN || j[b] === JOINT_UNCERTAIN) return OVERLAY_COLORS.uncertain;
  if (j[a] === JOINT_OK && j[b] === JOINT_OK) return OVERLAY_COLORS.ok;
  return OVERLAY_COLORS.neutral;
};

export interface OverlayDebug {
  /** Displayed (CSS) size of the video box, to expose any object-cover scale and crop. */
  boxW: number;
  boxH: number;
}

const DEBUG_LANDMARKS: [string, number][] = [
  ["L SHOULDER", 11], ["R SHOULDER", 12], ["L ELBOW", 13], ["R ELBOW", 14],
  ["L HIP", 23], ["R HIP", 24], ["L KNEE", 25], ["R KNEE", 26], ["L ANKLE", 27], ["R ANKLE", 28],
];

/**
 * Development aid (enable with ?landmarkDebug=1): prints the video, canvas and box sizes, the
 * object-cover scale and crop offsets, and for ten joints the normalised value, the pixel
 * position, and the gap between the raw and the filtered position. Cyan = raw (what is drawn),
 * magenta = filtered (what is measured). The canvas is mirrored by CSS, so text is un-mirrored.
 */
function drawDebug(ctx: CanvasRenderingContext2D, r: FrameResult, w: number, h: number, d: OverlayDebug) {
  const scale = Math.max(d.boxW / w, d.boxH / h); // object-cover
  const offX = (w * scale - d.boxW) / 2;
  const offY = (h * scale - d.boxH) / 2;
  const k = Math.max(0.6, Math.max(w, h) / 1280);
  for (const [, i] of DEBUG_LANDMARKS) {
    const rx = r.raw[i * 3] * w, ry = r.raw[i * 3 + 1] * h;
    const fx = r.xyz[i * 3] * w, fy = r.xyz[i * 3 + 1] * h;
    ctx.strokeStyle = "#00E5FF"; ctx.lineWidth = 2 * k;
    ctx.beginPath(); ctx.arc(rx, ry, 12 * k, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "#FF2BD6";
    ctx.beginPath(); ctx.moveTo(fx - 8 * k, fy); ctx.lineTo(fx + 8 * k, fy); ctx.moveTo(fx, fy - 8 * k); ctx.lineTo(fx, fy + 8 * k); ctx.stroke();
  }
  const lines = [
    `video ${w}x${h}  canvas ${w}x${h}  box ${Math.round(d.boxW)}x${Math.round(d.boxH)}  dpr ${typeof window === "undefined" ? 1 : window.devicePixelRatio}`,
    `object-cover scale ${scale.toFixed(3)}  crop offset x ${offX.toFixed(0)} y ${offY.toFixed(0)}  mirror: CSS scaleX(-1) on video+canvas, x NOT flipped`,
    ...DEBUG_LANDMARKS.map(([name, i]) => {
      const nx = r.raw[i * 3], ny = r.raw[i * 3 + 1];
      const gap = Math.hypot((r.xyz[i * 3] - nx) * w, (r.xyz[i * 3 + 1] - ny) * h);
      return `${name.padEnd(11)} n(${nx.toFixed(3)}, ${ny.toFixed(3)}) px(${(nx * w).toFixed(0)}, ${(ny * h).toFixed(0)}) vis ${r.vis[i].toFixed(2)} filter lag ${gap.toFixed(1)}px`;
    }),
  ];
  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1); // undo the CSS mirror so the text reads normally
  ctx.font = `${13 * k}px ui-monospace, monospace`;
  ctx.textBaseline = "top";
  lines.forEach((line, n) => {
    const y = 8 * k + n * 17 * k;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(6 * k, y - 2, ctx.measureText(line).width + 8 * k, 17 * k);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(line, 10 * k, y);
  });
  ctx.restore();
}

export function drawOverlay(ctx: CanvasRenderingContext2D, r: FrameResult, w: number, h: number, extras?: { debug?: OverlayDebug; hands?: HandPoints | null }) {
  ctx.clearRect(0, 0, w, h);
  if (!r.tracking) return;

  const k = Math.max(0.6, Math.min(2, Math.max(w, h) / 1280)); // line widths scale with the video
  // Raw landmarks, not the filtered ones: the skeleton must sit on the body, and any filter trails it.
  const { raw: xyz, vis, joints } = r;
  const px = (i: number) => xyz[i * 3] * w;
  const py = (i: number) => xyz[i * 3 + 1] * h;
  const redSet = new Set<number>();
  for (const [a, b] of r.redSegments) {
    redSet.add(a * 40 + b);
    redSet.add(b * 40 + a);
  }

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Context: face outline and finger stubs from the pose model, quiet and uncoloured.
  ctx.beginPath();
  for (const [a, b] of CONTEXT_SEGMENTS) {
    if (vis[a] < MIN_DRAW_VISIBILITY || vis[b] < MIN_DRAW_VISIBILITY) continue;
    ctx.moveTo(px(a), py(a));
    ctx.lineTo(px(b), py(b));
  }
  ctx.lineWidth = 2 * k;
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.stroke();
  for (const i of CONTEXT_POINTS) {
    if (vis[i] < MIN_DRAW_VISIBILITY) continue;
    ctx.beginPath();
    ctx.arc(px(i), py(i), 3 * k, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.lineWidth = 1.5 * k;
    ctx.strokeStyle = "rgba(31,107,79,0.9)";
    ctx.stroke();
  }

  // Hands (separate model, raw, not judged).
  if (extras?.hands) {
    for (const hand of extras.hands) {
      if (!hand || hand.length < 21) continue;
      ctx.beginPath();
      for (const [a, b] of HAND_CONNECTIONS) {
        ctx.moveTo(hand[a].x * w, hand[a].y * h);
        ctx.lineTo(hand[b].x * w, hand[b].y * h);
      }
      ctx.lineWidth = 2.5 * k;
      ctx.strokeStyle = "rgba(187,219,200,0.95)";
      ctx.stroke();
      for (let i = 0; i < 21; i++) {
        const tip = i === 4 || i === 8 || i === 12 || i === 16 || i === 20;
        ctx.beginPath();
        ctx.arc(hand[i].x * w, hand[i].y * h, (tip || i === 0 ? 5 : 3.5) * k, 0, Math.PI * 2);
        ctx.fillStyle = tip || i === 0 ? "#FFFFFF" : "#DCEDE3";
        ctx.fill();
        ctx.lineWidth = 1.5 * k;
        ctx.strokeStyle = "#134333";
        ctx.stroke();
      }
    }
  }

  // Bones: one dark under-stroke for legibility, then colour per verdict (batched by colour).
  const buckets = new Map<string, [number, number][]>();
  for (const [a, b] of BODY_SEGMENTS) {
    const unsure = joints[a] === JOINT_UNCERTAIN || joints[b] === JOINT_UNCERTAIN;
    // A joint that cannot be judged is still shown (in yellow) where the model last placed it.
    if (!unsure && (vis[a] < MIN_DRAW_VISIBILITY || vis[b] < MIN_DRAW_VISIBILITY)) continue;
    const c = colorOfBone(joints, a, b, redSet.has(a * 40 + b));
    const list = buckets.get(c);
    if (list) list.push([a, b]);
    else buckets.set(c, [[a, b]]);
  }
  const stroke = (color: string, width: number, only?: string) => {
    for (const [c, list] of buckets) {
      if (only && c !== only) continue;
      ctx.beginPath();
      for (const [a, b] of list) {
        ctx.moveTo(px(a), py(a));
        ctx.lineTo(px(b), py(b));
      }
      ctx.lineWidth = width;
      ctx.strokeStyle = color === "" ? c : color;
      ctx.stroke();
    }
  };
  stroke(OVERLAY_COLORS.underStroke, 8 * k);
  stroke("", 4 * k);

  // Joints.
  for (const i of DRAWN_LANDMARKS) {
    const state = joints[i];
    if (vis[i] < MIN_DRAW_VISIBILITY && state !== JOINT_UNCERTAIN) continue;
    const x = px(i);
    const y = py(i);
    if (state === JOINT_NEUTRAL) {
      ctx.beginPath();
      ctx.arc(x, y, 3.5 * k, 0, Math.PI * 2);
      ctx.fillStyle = OVERLAY_COLORS.neutral;
      ctx.fill();
      continue;
    }
    if (state === JOINT_UNCERTAIN) {
      ctx.beginPath();
      ctx.setLineDash([4 * k, 3 * k]);
      ctx.arc(x, y, 8 * k, 0, Math.PI * 2);
      ctx.lineWidth = 3 * k;
      ctx.strokeStyle = OVERLAY_COLORS.uncertain;
      ctx.stroke();
      ctx.setLineDash([]);
      continue;
    }
    if (state === JOINT_ERROR) {
      ctx.beginPath();
      ctx.arc(x, y, 11 * k, 0, Math.PI * 2);
      ctx.fillStyle = OVERLAY_COLORS.error;
      ctx.fill();
      ctx.lineWidth = 3 * k;
      ctx.strokeStyle = "#FFFFFF";
      ctx.stroke();
      const c = 4.5 * k;
      ctx.beginPath();
      ctx.moveTo(x - c, y - c);
      ctx.lineTo(x + c, y + c);
      ctx.moveTo(x + c, y - c);
      ctx.lineTo(x - c, y + c);
      ctx.lineWidth = 2.5 * k;
      ctx.strokeStyle = OVERLAY_COLORS.ringInk;
      ctx.stroke();
      continue;
    }
    // OK
    ctx.beginPath();
    ctx.arc(x, y, 6.5 * k, 0, Math.PI * 2);
    ctx.fillStyle = OVERLAY_COLORS.ok;
    ctx.fill();
    ctx.lineWidth = 2.5 * k;
    ctx.strokeStyle = "#FFFFFF";
    ctx.stroke();
  }
  if (extras?.debug) drawDebug(ctx, r, w, h, extras.debug);
}
