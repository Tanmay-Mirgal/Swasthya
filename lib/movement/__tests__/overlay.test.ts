import test from "node:test";
import assert from "node:assert/strict";
import { drawOverlay, OVERLAY_COLORS } from "@/components/movement/overlay";
import { kneeExtensionSession, LEAD_MS, replayUntil } from "../testing/scenarios";
import { PoseLandmark as L } from "../landmarks";

/** A canvas context that records which colours were used to fill and stroke, and where. */
function fakeCtx() {
  const calls: { op: "fill" | "stroke"; color: string; dashed: boolean; x?: number; y?: number; r?: number }[] = [];
  let fillStyle = "";
  let strokeStyle = "";
  let dash: number[] = [];
  let last: { x: number; y: number; r: number } | null = null;
  const ctx = {
    clearRect() {},
    beginPath() {
      last = null;
    },
    moveTo() {},
    lineTo() {},
    arc(x: number, y: number, r: number) {
      last = { x, y, r };
    },
    setLineDash(d: number[]) {
      dash = d;
    },
    fill() {
      calls.push({ op: "fill", color: fillStyle, dashed: false, ...(last ?? {}) });
    },
    stroke() {
      calls.push({ op: "stroke", color: strokeStyle, dashed: dash.length > 0, ...(last ?? {}) });
    },
    set fillStyle(v: string) {
      fillStyle = v;
    },
    set strokeStyle(v: string) {
      strokeStyle = v;
    },
    lineWidth: 1,
    lineCap: "",
    lineJoin: "",
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

const draw = (scenario: Parameters<typeof replayUntil>[1], until: number) => {
  const r = replayUntil("seated-knee-extension", scenario, until);
  const f = fakeCtx();
  drawOverlay(f.ctx, r.engine.result, 1280, 720);
  return { ...f, result: r.engine.result };
};

const nearJoint = (calls: ReturnType<typeof fakeCtx>["calls"], result: ReturnType<typeof draw>["result"], idx: number) => {
  const x = result.raw[idx * 3] * 1280;
  const y = result.raw[idx * 3 + 1] * 720;
  return calls.filter((c) => c.r !== undefined && Math.hypot((c.x as number) - x, (c.y as number) - y) < 0.5);
};

test("a good rep draws green joints and green bones, and nothing red or yellow", () => {
  const { calls, result } = draw(kneeExtensionSession(), LEAD_MS + 6000 + 1000);
  const colours = new Set(calls.map((c) => c.color));
  assert.ok(colours.has(OVERLAY_COLORS.ok));
  assert.ok(!colours.has(OVERLAY_COLORS.error));
  assert.ok(!colours.has(OVERLAY_COLORS.uncertain));
  assert.ok(nearJoint(calls, result, L.LEFT_KNEE).some((c) => c.op === "fill" && c.color === OVERLAY_COLORS.ok));
});

test("a trunk problem makes the shoulder and hip red (bigger, with a cross); the knee stays green", () => {
  const { calls, result } = draw(kneeExtensionSession({ lean: (t) => (t > LEAD_MS + 600 ? 28 : 0) }), LEAD_MS + 3000);
  const shoulder = nearJoint(calls, result, L.LEFT_SHOULDER);
  assert.ok(shoulder.some((c) => c.op === "fill" && c.color === OVERLAY_COLORS.error));
  const radius = Math.max(...shoulder.map((c) => c.r ?? 0));
  const kneeRadius = Math.max(...nearJoint(calls, result, L.LEFT_KNEE).map((c) => c.r ?? 0));
  assert.ok(radius > kneeRadius, "an error is larger than a good joint, so it reads without colour");
  assert.ok(nearJoint(calls, result, L.LEFT_KNEE).every((c) => c.color !== OVERLAY_COLORS.error));
  assert.ok(calls.some((c) => c.op === "stroke" && c.color === OVERLAY_COLORS.error), "the trunk bone is red");
});

test("a joint the camera cannot judge is a hollow dashed yellow ring, and the rest is not judged red", () => {
  const { calls, result } = draw(kneeExtensionSession({ vis: (t) => (t > LEAD_MS ? { [L.LEFT_KNEE]: 0.12 } : undefined), lean: () => 30 }), LEAD_MS + 3000);
  const knee = nearJoint(calls, result, L.LEFT_KNEE);
  assert.ok(knee.some((c) => c.op === "stroke" && c.color === OVERLAY_COLORS.uncertain && c.dashed));
  assert.ok(!knee.some((c) => c.op === "fill"), "hollow");
  assert.ok(![...new Set(calls.map((c) => c.color))].includes(OVERLAY_COLORS.error), "no red while confidence is low");
});

test("with nobody in view nothing is drawn", () => {
  const r = replayUntil("seated-knee-extension", () => ({ image: null, aspect: 1.78 }), 1000);
  const f = fakeCtx();
  drawOverlay(f.ctx, r.engine.result, 1280, 720);
  assert.equal(f.calls.length, 0);
});
