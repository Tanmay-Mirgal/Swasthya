import test from "node:test";
import assert from "node:assert/strict";
import { MovementEngine } from "../judge/engine";
import { getMovementTemplate } from "../template/registry";
import { run } from "../testing/synth";
import { LEAD_MS, MIXED_PLAN, repPlanSession, type RepPlan } from "../testing/scenarios";
import type { MovementEvent } from "../types";

/**
 * THE HARD RULE: a wrong rep is never counted as a completed rep.
 *
 *   Prescribed 8. The patient does: good, good, flagged, good, short, good.
 *   The main progress is 4 / 8 good reps, never 6 / 8.
 */
const knee = () => getMovementTemplate("seated-knee-extension")!;
const PERIOD = 4000;
const session = (plan: RepPlan[]) => repPlanSession(plan, PERIOD);

const EXAMPLE = MIXED_PLAN;
const kinds = (events: MovementEvent[]) => events.filter((e) => e.type === "rep_completed" || e.type === "rep_not_counted" || e.type === "partial_rep").map((e) => e.type);

test("good, good, flagged, good, short, good is 4 / 8 good reps, not 6 / 8", () => {
  const eng = new MovementEngine(knee(), { targetReps: 8 });
  const r = run(eng, session(EXAMPLE), LEAD_MS + 6 * PERIOD + 400);
  assert.deepEqual(kinds(r.events), ["rep_completed", "rep_completed", "rep_not_counted", "rep_completed", "partial_rep", "rep_completed"]);
  const s = eng.getSummary();
  assert.equal(s.counted, 4, "the main counter");
  assert.equal(s.valid, 4);
  assert.equal(s.invalid, 1, "the flagged rep is reported, not hidden");
  assert.equal(s.partial, 1, "the short rep is reported, not hidden");
  assert.equal(r.last.counted, 4);
  assert.equal(r.last.done, false, "4 of 8: not done");
  assert.equal(s.reps.length, 4, "credited reps only");
  assert.equal(s.attempts.filter((a) => a.outcome === "invalid" || a.outcome === "partial").length, 2, "both non-counted attempts are on record");
});

test("the good-rep numbers on the events never move for a rep that did not count", () => {
  const eng = new MovementEngine(knee(), { targetReps: 8 });
  const r = run(eng, session(EXAMPLE), LEAD_MS + 6 * PERIOD + 400);
  const good = r.events.filter((e): e is Extract<MovementEvent, { type: "rep_completed" }> => e.type === "rep_completed").map((e) => e.rep);
  assert.deepEqual(good, [1, 2, 3, 4], "good reps are numbered 1..4 with no gap where the flagged and short attempts were");
  const notCounted = r.events.find((e): e is Extract<MovementEvent, { type: "rep_not_counted" }> => e.type === "rep_not_counted")!;
  assert.equal(notCounted.rep, 2, "it happened after 2 good reps and left the count at 2");
});

test("the set is done only when the prescribed number of GOOD reps is reached, however many attempts it took", () => {
  const eng = new MovementEngine(knee(), { targetReps: 4 });
  const r = run(eng, session(EXAMPLE), LEAD_MS + 6 * PERIOD + 400);
  assert.equal(r.last.counted, 4);
  assert.equal(r.last.done, true, "the 4th good rep, on the 6th attempt, finishes a 4-rep set");
  // And it was not finished early by the attempts that did not count.
  const early = new MovementEngine(knee(), { targetReps: 4 });
  const r5 = run(early, session(EXAMPLE), LEAD_MS + 5 * PERIOD + 400);
  assert.equal(r5.last.done, false, "after 5 attempts only 3 were good");
});

test("a rep that never reaches the full range never credits, however many times it is tried", () => {
  const eng = new MovementEngine(knee(), { targetReps: 3 });
  const r = run(eng, session([{ peak: 0.6 }, { peak: 0.6 }, { peak: 0.6 }, { peak: 0.6 }]), LEAD_MS + 4 * PERIOD);
  const s = eng.getSummary();
  assert.equal(s.counted, 0);
  assert.equal(s.partial, 4);
  assert.equal(r.last.done, false);
});

test("a flagged rep followed by a corrected one: the correction shows as a good rep, and only that one credits", () => {
  const eng = new MovementEngine(knee(), { targetReps: 8 });
  const r = run(eng, session([{ peak: 1, lean: true }, { peak: 1 }]), LEAD_MS + 2 * PERIOD + 400);
  assert.deepEqual(kinds(r.events), ["rep_not_counted", "rep_completed"]);
  assert.equal(eng.getSummary().counted, 1);
});
