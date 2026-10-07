import test from "node:test";
import assert from "node:assert/strict";
import { createCoachState, reduceCoach, type CoachEffect, type CoachInput, type CoachState } from "../coach/coachState";
import { COACH_CONFIG } from "../coach/config";
import { getMovementTemplate } from "../template/registry";
import type { MovementEvent } from "../types";

const knee = getMovementTemplate("seated-knee-extension")!;
const OPTS = { llmEnabled: false };

const rest = (t: number): MovementEvent => ({ type: "phase_changed", t, phase: "rest", rep: 0 });
const good = (t: number, rep: number): MovementEvent => ({ type: "rep_completed", t, rep, valid: true, reasons: [], rom: 80, durationMs: 4000, confidence: 0.95 });
const flagged = (t: number, rep: number): MovementEvent => ({ type: "rep_not_counted", t, rep, reasons: ["trunk_lean"], rom: 80, durationMs: 4000, confidence: 0.95 });
const short = (t: number, almost = true): MovementEvent => ({ type: "partial_rep", t, reached: 0.6, almost });
const spoken = (fx: CoachEffect[]) => fx.filter((e): e is Extract<CoachEffect, { kind: "speak" }> => e.kind === "speak").map((e) => e.text);

function start(target = 8): CoachState {
  return reduceCoach(createCoachState(knee), { type: "set_started", t: 0, set: 1, targetReps: target, repsBefore: 0 }, knee, OPTS).state;
}
/** Feeds attempts 8 s apart, each followed by the movement settling at rest. */
function play(s: CoachState, attempts: ("good" | "flagged" | "short")[]) {
  const fx: CoachEffect[] = [];
  let goodN = 0;
  attempts.forEach((a, i) => {
    const t = 8000 * (i + 1);
    const ev = a === "good" ? good(t, ++goodN) : a === "flagged" ? flagged(t, goodN) : short(t);
    // The coach ticks twice a second in the product, so a line held back by the minimum gap is spoken a moment later.
    const ticks = [700, 1500, 2300, 3100, 3900].map((d) => ({ type: "tick", t: t + d }) as CoachInput);
    for (const e of [ev, rest(t + 50), ...ticks]) {
      const r = reduceCoach(s, e, knee, OPTS);
      s = r.state;
      fx.push(...r.effects);
    }
  });
  return { state: s, fx };
}

test("an attempt that did not count is said plainly, shown as a result, and never moves the good-rep count", () => {
  const { state, fx } = play(start(), ["good", "flagged"]);
  assert.equal(state.sessionMetrics.valid, 1);
  assert.equal(state.sessionMetrics.invalid, 1);
  assert.equal(state.currentRep, 1, "still on 1 good rep");
  assert.ok(spoken(fx).some((t) => /counted/i.test(t)));
  const shown = reduceCoach(start(), flagged(1000, 0), knee, OPTS).state.verdict;
  assert.equal(shown?.kind, "not_counted");
  const partial = reduceCoach(start(), short(1000, true), knee, OPTS);
  assert.equal(partial.state.verdict?.kind, "partial");
  assert.deepEqual(spoken(partial.effects), ["Not counted. Straighten a bit more."], "one message: not counted, and the one thing to change");
  assert.equal(partial.state.verdict?.say, "Not counted. Straighten a bit more.", "the spoken and the shown words are the same object");
  assert.deepEqual(spoken(reduceCoach(start(), short(1000, false), knee, OPTS).effects), ["Not counted. Straighten a bit more."]);
});

test("the result clears itself, so the screen goes back to a quiet state", () => {
  let s = reduceCoach(start(), flagged(1000, 0), knee, OPTS).state;
  assert.ok(s.verdict);
  s = reduceCoach(s, { type: "tick", t: 1000 + COACH_CONFIG.verdictNotCountedMs - 100 }, knee, OPTS).state;
  assert.ok(s.verdict, "still showing while it can be read");
  s = reduceCoach(s, { type: "tick", t: 1000 + COACH_CONFIG.verdictNotCountedMs + 100 }, knee, OPTS).state;
  assert.equal(s.verdict, null);
});

test("the wording never blames, and never uses technical terms", () => {
  const lines = new Set<string>();
  for (const kind of ["flagged", "short"] as const) {
    let s = start();
    for (let i = 0; i < 6; i++) {
      const r = reduceCoach(s, kind === "flagged" ? flagged(5000 * (i + 1), 0) : short(5000 * (i + 1), i % 2 === 0), knee, OPTS);
      s = r.state;
      spoken(r.effects).forEach((t) => lines.add(t));
    }
  }
  const text = [...lines].join(" | ");
  assert.doesNotMatch(text, /invalid|error|incorrect|wrong|bad|fail|low confidence|landmark|angle|threshold|combo|lost/i, text);
});

test("three attempts in a row that did not count: the guide is offered; nothing else changes yet", () => {
  const { state, fx } = play(start(), ["flagged", "short", "flagged"]);
  assert.equal(state.suggestDemo, true);
  assert.equal(state.offerFinish, false);
  assert.ok(spoken(fx).some((t) => /guide/i.test(t)));
});

test("five in a row: a rest is suggested and 'finish for today' is offered, without blame", () => {
  const { state, fx } = play(start(), ["flagged", "short", "flagged", "short", "flagged"]);
  assert.equal(state.offerFinish, true);
  const cues = fx.filter((e): e is Extract<CoachEffect, { kind: "cue" }> => e.kind === "cue").map((e) => e.cue.text);
  assert.ok(cues.includes("Let’s take a short rest. You can finish here for today if you’d like."), "shown on screen as well as spoken");
  assert.ok(spoken(fx).includes("Let’s take a short rest. You can finish here for today if you’d like."));
  assert.doesNotMatch(spoken(fx).join(" "), /fail|wrong|bad|give up|can’t|cannot/i);
});

test("a good rep breaks the run: nothing is offered to someone who is making progress", () => {
  const { state } = play(start(), ["flagged", "short", "good", "flagged", "short", "good", "flagged"]);
  assert.equal(state.suggestDemo, false);
  assert.equal(state.offerFinish, false);
  assert.equal(state.streak, 1);
});

test("many scattered attempts that did not count still trigger a rest once they clearly outnumber the good ones", () => {
  // 7 not counted (never more than 2 in a row) against 2 good: at least 6, and at least twice the good reps.
  const { state } = play(start(), ["flagged", "short", "good", "flagged", "short", "flagged", "good", "short", "flagged"]);
  assert.equal(state.notCountedInChunk, 7);
  assert.equal(state.offerFinish, true);
  const fine = play(start(), ["flagged", "good", "short", "good", "flagged", "good", "short", "good", "flagged", "good"]);
  assert.equal(fine.state.offerFinish, false, "5 not counted against 5 good is not struggling");
});

test("a camera that could not see (an uncertain rep) is never held against the patient", () => {
  let s = start();
  for (let i = 0; i < 6; i++) s = reduceCoach(s, { type: "uncertain_rep", t: 1000 * (i + 1), reached: 0.5, reason: "dropout" }, knee, OPTS).state;
  assert.deepEqual([s.streak, s.notCountedInChunk, s.suggestDemo, s.offerFinish], [0, 0, false, false]);
});

test("a new chunk starts fresh: the offers and the run are cleared", () => {
  const { state } = play(start(), ["flagged", "short", "flagged", "short", "flagged"]);
  assert.equal(state.offerFinish, true);
  const fresh = reduceCoach(state, { type: "set_started", t: 99_000, set: 1, targetReps: 5, repsBefore: 3 }, knee, OPTS).state;
  assert.deepEqual([fresh.streak, fresh.notCountedInChunk, fresh.suggestDemo, fresh.offerFinish, fresh.verdict], [0, 0, false, false, null]);
});

test("several tries at the same rep count as several attempts when deciding what is persistent", () => {
  let s = start();
  const err = (t: number): MovementEvent => ({ type: "movement_error", t, exercise: knee.id, phase: "peak", joint: "shoulder", error: "trunk_lean", severity: "major", direction: "high", measured: 30, expected: 18, confidence: 0.95, rep: 1, oneShot: false });
  for (let i = 0; i < 3; i++) {
    s = reduceCoach(s, err(8000 * i + 1000), knee, OPTS).state; // the same rep slot every time: nothing was credited
    s = reduceCoach(s, flagged(8000 * i + 3000, 0), knee, OPTS).state;
  }
  assert.equal(s.issues["trunk_lean"].repsAffected.length, 3);
});
