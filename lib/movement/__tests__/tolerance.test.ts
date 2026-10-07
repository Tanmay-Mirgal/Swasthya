import test from "node:test";
import assert from "node:assert/strict";
import { MovementEngine } from "../judge/engine";
import { getMovementTemplate } from "../template/registry";
import { effectiveRep, isValidRangeOverride, rangeOverrideBounds } from "../template/tolerance";
import { eventsOf, repCurve, run, sideFrame } from "../testing/synth";
import { kneeExtensionSession, LEAD_MS } from "../testing/scenarios";

const knee = () => getMovementTemplate("seated-knee-extension")!;
const heel = () => getMovementTemplate("heel-raise")!;
const neck = () => getMovementTemplate("neck-rotation")!;

// ── The range a therapist may choose ───────────────────────────────────────────

test("the allowed range override runs from the template's default down to its 'almost' line, in display units", () => {
  assert.deepEqual(rangeOverrideBounds(knee()), { strict: 150, lenient: 130, unit: "deg" });
  assert.deepEqual(rangeOverrideBounds(heel()), { strict: 15, lenient: 10, unit: "pct" }, "ratios are shown as percent");
  assert.deepEqual(rangeOverrideBounds(getMovementTemplate("seated-bicep-curl")!), { strict: 72, lenient: 95, unit: "deg" }, "a curl's range is an angle that gets smaller");
});

test("an override outside the allowed band is not valid: it can only be more lenient, and never below the 'almost' line", () => {
  assert.equal(isValidRangeOverride(knee(), 140), true);
  assert.equal(isValidRangeOverride(knee(), 150), true);
  assert.equal(isValidRangeOverride(knee(), 130), true);
  assert.equal(isValidRangeOverride(knee(), 129), false, "below the almost line");
  assert.equal(isValidRangeOverride(knee(), 160), false, "stricter than the template");
  assert.equal(isValidRangeOverride(getMovementTemplate("seated-bicep-curl")!, 85), true);
  assert.equal(isValidRangeOverride(getMovementTemplate("seated-bicep-curl")!, 100), false);
  assert.equal(isValidRangeOverride(knee(), NaN), false);
});

test("the rep spec in force is the template's unless a tolerance is given, and a tolerance is clamped into the band", () => {
  assert.equal(effectiveRep(knee()).peakThreshold, 150);
  assert.equal(effectiveRep(knee(), { minRange: 140 }).peakThreshold, 140);
  assert.equal(effectiveRep(knee(), { minRange: 100 }).peakThreshold, 130, "never below the almost line");
  assert.equal(effectiveRep(knee(), { minRange: 175 }).peakThreshold, 150, "never stricter than the template");
  assert.equal(effectiveRep(heel(), { minRange: 12 }).peakThreshold, 0.12, "display percent converts back to a ratio");
  assert.equal(effectiveRep(getMovementTemplate("seated-bicep-curl")!, { minRange: 85 }).peakThreshold, 85);
  assert.equal(effectiveRep(knee(), { holdMs: 2000 }).minPeakHoldMs, 2000);
  assert.equal(effectiveRep(heel(), {}).minPeakHoldMs, 500, "the template's own hold stays when the prescription has none");
});

// ── In the engine ──────────────────────────────────────────────────────────────

test("a shallow rep (139 degrees) does not count by default, and counts once the therapist accepts from 135", () => {
  const strict = new MovementEngine(knee(), { targetReps: 10 });
  run(strict, kneeExtensionSession({ peak: 0.62 }), LEAD_MS + 4000 + 400);
  assert.deepEqual([strict.getSummary().counted, strict.getSummary().partial], [0, 1]);
  const lenient = new MovementEngine(knee(), { targetReps: 10, minRange: 135 });
  run(lenient, kneeExtensionSession({ peak: 0.62 }), LEAD_MS + 4000 + 400);
  const s = lenient.getSummary();
  assert.equal(s.counted, 1);
  assert.deepEqual(s.thresholds, { minRange: 135, unit: "deg", holdMs: null, rangeOverridden: true }, "the gate that was applied is recorded");
});

test("a tolerance can never make the engine stricter or lower than the 'almost' line", () => {
  const stricter = new MovementEngine(knee(), { targetReps: 10, minRange: 170 });
  run(stricter, kneeExtensionSession(), LEAD_MS + 4000 + 400);
  assert.equal(stricter.getSummary().counted, 1, "a full rep still counts");
  assert.equal(stricter.getSummary().thresholds.minRange, 150);
  const tooLow = new MovementEngine(knee(), { targetReps: 10, minRange: 90 });
  run(tooLow, kneeExtensionSession({ peak: 0.4 }), LEAD_MS + 4000 + 400);
  assert.equal(tooLow.getSummary().counted, 0, "a movement that barely leaves the start still does not count");
});

test("configure() applies a tolerance after construction, and clearing it restores the template", () => {
  const eng = new MovementEngine(knee(), { targetReps: 10 });
  eng.configure({ minRange: 135 });
  assert.equal(eng.getSummary().thresholds.minRange, 135);
  eng.configure({});
  assert.equal(eng.getSummary().thresholds.minRange, 150);
});

// ── Hold ───────────────────────────────────────────────────────────────────────

test("a hold the therapist prescribed is mandatory: releasing early means the rep is NOT counted, and the hold is coached", () => {
  const held = new MovementEngine(knee(), { targetReps: 10, holdMs: 300 });
  run(held, kneeExtensionSession(), LEAD_MS + 4000 + 400);
  assert.equal(held.getSummary().counted, 1, "a short hold is met by this rep");
  const strict = new MovementEngine(knee(), { targetReps: 10, holdMs: 3000 });
  const r = run(strict, kneeExtensionSession(), LEAD_MS + 4000 + 400);
  const s = strict.getSummary();
  assert.deepEqual([s.counted, s.invalid], [0, 1]);
  assert.ok(eventsOf(r.events, "rep_not_counted")[0].reasons.includes("short_hold"));
  assert.ok(eventsOf(r.events, "movement_error").some((e) => e.error === "short_hold"), "and the person is told how to fix it");
  assert.equal(s.thresholds.holdMs, 3000);
});

test("a hold written into the template is mandatory too, with a 20% tolerance", () => {
  const frame = (t: number) => sideFrame({ thighTilt: 0, knee: 180, heelLift: 0.09 * (t < 2000 ? 0 : repCurve(t - 2000, 5000, 1)), groundFixed: true }, { noisePx: 1, seed: Math.round(t) });
  // The heel raise asks for a 500 ms pause: this repetition has one.
  const own = new MovementEngine(heel(), { targetReps: 10 });
  run(own, frame, 2000 + 5000 + 400);
  assert.equal(own.getSummary().counted, 1, "a pause at the top counts");
  assert.equal(own.getSummary().thresholds.holdMs, 500);
  // The same movement against a template that asks for a long hold: not counted, and the missed hold is named.
  const longer = structuredClone(heel());
  longer.rep.minPeakHoldMs = 4000;
  const strict = new MovementEngine(longer, { targetReps: 10 });
  const r = run(strict, frame, 2000 + 5000 + 400);
  assert.equal(strict.getSummary().counted, 0);
  assert.ok(eventsOf(r.events, "rep_not_counted").some((e) => e.reasons.includes("short_hold")));
});

test("the neck rotation has no hold, so a quick turn and return is not penalised for one", () => {
  assert.equal(neck().rep.minPeakHoldMs, undefined);
  assert.equal(effectiveRep(neck(), {}).minPeakHoldMs, undefined);
});
