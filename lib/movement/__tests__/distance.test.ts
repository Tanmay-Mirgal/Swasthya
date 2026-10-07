import test from "node:test";
import assert from "node:assert/strict";
import { capHeightMm, checkDistance, DEVICES, requiredFontPx, TIER_ANGLE_DEG, visualAngleDeg } from "../ui/distance";

const laptop = DEVICES.find((d) => d.id === "laptop13")!;
const phone = DEVICES.find((d) => d.id === "phone")!;

test("required font sizes match the table in the plan (13-inch laptop)", () => {
  const at = (tier: keyof typeof TIER_ANGLE_DEG, d: number) => requiredFontPx(TIER_ANGLE_DEG[tier], d, laptop.mmPerPx);
  assert.deepEqual([at("counter", 1), at("counter", 1.5), at("counter", 2)], [91, 136, 182]);
  assert.deepEqual([at("verdict", 1), at("verdict", 1.5), at("verdict", 2)], [61, 91, 121]);
  assert.deepEqual([at("instruction", 1), at("instruction", 1.5), at("instruction", 2)], [36, 55, 73]);
});

test("a size that is exactly the required one subtends the target angle", () => {
  const px = requiredFontPx(0.5, 1.5, laptop.mmPerPx);
  const angle = visualAngleDeg(capHeightMm(px, laptop.mmPerPx), 1.5);
  assert.ok(Math.abs(angle - 0.5) < 0.01, `angle ${angle}`);
});

test("browser zoom makes the same CSS size physically larger, so it helps", () => {
  const base = visualAngleDeg(capHeightMm(40, laptop.mmPerPx, 1), 2);
  const zoomed = visualAngleDeg(capHeightMm(40, laptop.mmPerPx, 1.5), 2);
  assert.ok(zoomed > base * 1.45 && zoomed < base * 1.55);
  assert.equal(requiredFontPx(0.5, 1.5, laptop.mmPerPx, 1.5) < requiredFontPx(0.5, 1.5, laptop.mmPerPx, 1), true);
});

test("a smaller pixel (phone) needs a larger font for the same angle", () => {
  assert.ok(requiredFontPx(0.5, 1.5, phone.mmPerPx) > requiredFontPx(0.5, 1.5, laptop.mmPerPx));
});

test("today's live panel sizes fail from a distance (the baseline this redesign starts from)", () => {
  // From the current LivePanel: rep number text-5xl (48px), cue sentence text-xl (20px), state word text-base (16px).
  const r = checkDistance(
    [
      { tier: "counter", label: "rep number", fontPx: 48 },
      { tier: "instruction", label: "cue sentence", fontPx: 20 },
      { tier: "verdict", label: "state word", fontPx: 16 },
    ],
    laptop
  );
  assert.ok(r.failures > 0);
  assert.equal(r.rows.filter((x) => !x.ok).length, r.rows.length, "every one of them fails at every distance");
  assert.ok(r.worstFactor > 5, `worst shortfall ${r.worstFactor.toFixed(1)}x`);
});

test("generously sized text passes, and only the distances a tier needs are checked", () => {
  const r = checkDistance([{ tier: "details", label: "tally", fontPx: 20 }, { tier: "verdict", label: "word", fontPx: 130 }], laptop);
  assert.ok(r.rows.filter((x) => x.tier === "details").every((x) => x.distanceM === 0.6));
  assert.equal(r.failures, 0);
  assert.equal(r.worstFactor, 1);
});
