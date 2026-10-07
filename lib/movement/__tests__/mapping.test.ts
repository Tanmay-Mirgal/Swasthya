import test from "node:test";
import assert from "node:assert/strict";
import { drawOverlay } from "@/components/movement/overlay";
import { kneeExtensionSession, LEAD_MS, replayUntil } from "../testing/scenarios";
import { PoseLandmark as L } from "../landmarks";

/**
 * Regression guard for landmark plotting. The skeleton is drawn on a canvas whose buffer is the
 * video's own pixel size, and both elements share the same CSS (object-cover, mirrored), so a
 * landmark lands on the body only if it is drawn at (normalised x * buffer width, normalised y * buffer height)
 * from the RAW landmarks, whatever the aspect ratio. These tests pin that.
 */

function recordArcs() {
  const arcs: { x: number; y: number }[] = [];
  const ctx = {
    clearRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    arc(x: number, y: number) {
      arcs.push({ x, y });
    },
    setLineDash() {},
    fill() {},
    stroke() {},
    save() {},
    restore() {},
    fillRect() {},
    fillText() {},
    measureText: () => ({ width: 0 }),
    set fillStyle(_v: string) {},
    set strokeStyle(_v: string) {},
    lineWidth: 1,
    lineCap: "",
    lineJoin: "",
  } as unknown as CanvasRenderingContext2D;
  return { ctx, arcs };
}

const SIZES: [string, number, number][] = [
  ["16:9 laptop", 1280, 720],
  ["4:3", 640, 480],
  ["portrait phone", 720, 1280],
  ["square", 600, 600],
];

for (const [name, w, h] of SIZES) {
  test(`a joint is drawn at its raw normalised position times the buffer size (${name})`, () => {
    const r = replayUntil("seated-knee-extension", kneeExtensionSession(), LEAD_MS + 1500).engine.result;
    const { ctx, arcs } = recordArcs();
    drawOverlay(ctx, r, w, h);
    for (const idx of [L.LEFT_KNEE, L.LEFT_HIP, L.LEFT_SHOULDER]) {
      const x = r.raw[idx * 3] * w;
      const y = r.raw[idx * 3 + 1] * h;
      assert.ok(
        arcs.some((a) => Math.hypot(a.x - x, a.y - y) < 0.5),
        `joint ${idx} should be drawn at (${x.toFixed(1)}, ${y.toFixed(1)})`,
      );
    }
  });
}

test("the skeleton is drawn from raw landmarks, never the filtered (trailing) ones", () => {
  const r = replayUntil("seated-knee-extension", kneeExtensionSession(), LEAD_MS + 2500).engine.result;
  const idx = L.LEFT_KNEE;
  const raw = { x: r.raw[idx * 3] * 1280, y: r.raw[idx * 3 + 1] * 720 };
  const filtered = { x: r.xyz[idx * 3] * 1280, y: r.xyz[idx * 3 + 1] * 720 };
  const { ctx, arcs } = recordArcs();
  drawOverlay(ctx, r, 1280, 720);
  assert.ok(arcs.some((a) => Math.hypot(a.x - raw.x, a.y - raw.y) < 0.5), "raw position is drawn");
  if (Math.hypot(raw.x - filtered.x, raw.y - filtered.y) > 1) {
    assert.ok(!arcs.some((a) => Math.hypot(a.x - filtered.x, a.y - filtered.y) < 0.5), "filtered position is not drawn");
  }
});
