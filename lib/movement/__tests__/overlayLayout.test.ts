import test from "node:test";
import assert from "node:assert/strict";
import { bodyInStage, chooseLayout, stabilizeLayout, type StageRect } from "../ui/overlayLayout";

const LAPTOP = { w: 1440, h: 900 };
const PHONE = { w: 390, h: 844 };
const rect = (x0: number, x1: number, y0 = 0.1, y1 = 0.9): StageRect => ({ x0, x1, y0, y1 });

test("the person's box is mapped like the video: mirrored left to right", () => {
  // A 16:9 camera into a 16:9 stage: no crop. A person on the camera's left appears on the stage's right (a mirror).
  const r = bodyInStage({ x0: 0.1, x1: 0.3, y0: 0.2, y1: 0.8 }, 16 / 9, { w: 1600, h: 900 });
  assert.ok(Math.abs(r.x0 - 0.7) < 1e-9 && Math.abs(r.x1 - 0.9) < 1e-9);
  assert.deepEqual([r.y0, r.y1], [0.2, 0.8]);
  const unmirrored = bodyInStage({ x0: 0.1, x1: 0.3, y0: 0.2, y1: 0.8 }, 16 / 9, { w: 1600, h: 900 }, false);
  assert.ok(Math.abs(unmirrored.x0 - 0.1) < 1e-9);
});

test("cover mapping: a wide video in a less wide stage is cropped at the sides, so the same body looks bigger", () => {
  const exact = bodyInStage({ x0: 0.4, x1: 0.6, y0: 0.2, y1: 0.8 }, 16 / 9, { w: 1600, h: 900 });
  const cropped = bodyInStage({ x0: 0.4, x1: 0.6, y0: 0.2, y1: 0.8 }, 16 / 9, LAPTOP);
  assert.ok(cropped.x1 - cropped.x0 > exact.x1 - exact.x0);
  // A body at the very edge of the camera frame is outside a cropped stage: clipped, not negative.
  const edge = bodyInStage({ x0: 0, x1: 0.1, y0: 0.2, y1: 0.8 }, 16 / 9, { w: 900, h: 900 });
  assert.ok(edge.x0 >= 0 && edge.x1 <= 1);
});

test("a person in the middle of a wide screen leaves the two side lanes free", () => {
  const l = chooseLayout(rect(0.34, 0.66), LAPTOP);
  assert.deepEqual([l.mode, l.progress, l.verdict], ["lanes", "left", "right"]);
  assert.ok(l.lane >= 240 && l.lane <= LAPTOP.w * 0.42);
});

test("nobody in view: the standard lanes, so the stage looks settled while someone gets into position", () => {
  assert.deepEqual([chooseLayout(null, LAPTOP).progress, chooseLayout(null, LAPTOP).verdict], ["left", "right"]);
});

test("a wide person (arms out) or one off to the side: both lanes go to the side that has room", () => {
  const right = chooseLayout(rect(0.05, 0.62), LAPTOP);
  assert.deepEqual([right.mode, right.progress, right.verdict], ["stacked", "right", "right"]);
  const left = chooseLayout(rect(0.4, 0.95), LAPTOP);
  assert.deepEqual([left.mode, left.progress, left.verdict], ["stacked", "left", "left"]);
});

test("a lane never overlaps the body: the free space beside the person is always at least the lane plus a gap", () => {
  for (let x0 = 0.05; x0 <= 0.5; x0 += 0.05) {
    for (let width = 0.1; width <= 0.8; width += 0.1) {
      const body = rect(x0, Math.min(0.98, x0 + width));
      const l = chooseLayout(body, LAPTOP);
      if (l.mode === "compact" && l.verdict === "top") continue; // a band along the top: checked below
      const freeL = body.x0 * LAPTOP.w;
      const freeR = (1 - body.x1) * LAPTOP.w;
      for (const side of new Set([l.progress, l.verdict])) {
        if (side === "left") assert.ok(freeL >= l.lane + 16 - 1e-6, `left lane ${l.lane} vs room ${freeL} (${x0}, ${width})`);
        if (side === "right") assert.ok(freeR >= l.lane + 16 - 1e-6, `right lane ${l.lane} vs room ${freeR} (${x0}, ${width})`);
      }
    }
  }
});

test("when neither side has room the feedback shrinks to a compact band, and finally goes along the top", () => {
  const small = chooseLayout(rect(0.15, 0.85), LAPTOP);
  assert.equal(small.mode, "compact");
  assert.ok(small.lane < chooseLayout(null, LAPTOP).lane, "the compact band is narrower than a full lane");
  const huge = chooseLayout(rect(0.02, 0.98), LAPTOP);
  assert.deepEqual([huge.mode, huge.progress, huge.verdict], ["compact", "top", "top"]);
});

test("a tall phone screen uses top and bottom bands, along its longer axis", () => {
  const l = chooseLayout(rect(0.1, 0.9, 0.3, 0.7), PHONE);
  assert.equal(l.orientation, "tall");
  assert.deepEqual([l.mode, l.progress, l.verdict], ["lanes", "top", "bottom"]);
  const low = chooseLayout(rect(0.1, 0.9, 0.05, 0.62), PHONE);
  assert.equal(low.verdict, "bottom");
  assert.equal(low.mode, "stacked");
});

test("bigger text asked for by the patient gives the lanes more room, until the body would be crowded", () => {
  const narrow = rect(0.42, 0.58); // a person who takes little of the width
  const normal = chooseLayout(narrow, LAPTOP, 1);
  const big = chooseLayout(narrow, LAPTOP, 1.2);
  assert.equal(normal.mode, "lanes");
  assert.equal(big.mode, "lanes");
  assert.ok(big.lane > normal.lane);
  const biggest = chooseLayout(narrow, LAPTOP, 2);
  assert.notEqual(biggest.mode, "lanes", "text too large for the side margins stacks or shrinks rather than covering the person");
});

test("the layout does not jump about: a different one is adopted only after it has been wanted for a while", () => {
  const standard = chooseLayout(rect(0.34, 0.66), LAPTOP);
  const crowded = chooseLayout(rect(0.05, 0.62), LAPTOP);
  let s = stabilizeLayout(null, standard, 0);
  assert.equal(s.current.mode, "lanes");
  s = stabilizeLayout(s, crowded, 100);
  assert.equal(s.current.mode, "lanes", "not yet");
  s = stabilizeLayout(s, standard, 700);
  assert.equal(s.pending, null, "a flicker back cancels the change");
  s = stabilizeLayout(s, crowded, 800);
  s = stabilizeLayout(s, crowded, 1200);
  assert.equal(s.current.mode, "lanes");
  s = stabilizeLayout(s, crowded, 2400);
  assert.equal(s.current.mode, "stacked", "adopted after 1.5 s of wanting it");
});
