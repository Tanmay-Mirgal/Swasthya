import test from "node:test";
import assert from "node:assert/strict";
import { MovementEngine } from "../judge/engine";
import { getAllMovementTemplates, getMovementTemplate } from "../template/registry";
import { validateTemplate } from "../template/validate";
import { eventsOf, run } from "../testing/synth";
import { EXERCISE_CASES, withDropout, type ExerciseCase } from "../testing/generators";

/**
 * THE TEST MATRIX. Every exercise goes through the same conditions and must give the same kinds of answers:
 *
 *   clean            → counted, nothing flagged
 *   short            → NOT counted (a partial attempt)
 *   flicked          → NOT counted (below the tempo floor, or never reaching range)
 *   mandatory fault  → NOT counted (invalid, with the rule named)
 *   not seen         → NOT counted and NOT blamed (uncertain)
 *
 * It uses the synthetic person, so it proves the rules and the engine, not real-camera accuracy.
 */
const engine = (c: ExerciseCase, reps = 10) => new MovementEngine(getMovementTemplate(c.id)!, { targetReps: reps });
const summaryOf = (c: ExerciseCase, build: ReturnType<ExerciseCase["build"]>, ms: number, fps = c.fps ?? 30) => {
  const e = engine(c);
  const r = run(e, build, ms, { fps });
  return { s: e.getSummary(), r };
};

test("the matrix covers every registered exercise, and every template is valid", () => {
  assert.deepEqual(EXERCISE_CASES.map((c) => c.id).sort(), getAllMovementTemplates().map((t) => t.id).sort());
  for (const t of getAllMovementTemplates()) assert.deepEqual(validateTemplate(t), []);
});

for (const c of EXERCISE_CASES) {
  test(`${c.id}: a clean repetition counts and nothing is flagged`, () => {
    const { s, r } = summaryOf(c, c.build(), c.lead + 2 * c.period + 400);
    assert.equal(s.counted, 2, JSON.stringify(s.attempts));
    assert.deepEqual([s.invalid, s.partial, s.uncertain], [0, 0, 0]);
    assert.equal(eventsOf(r.events, "movement_error").length, 0);
  });

  test(`${c.id}: a repetition that does not reach the range is NOT counted`, () => {
    const { s } = summaryOf(c, c.build({ peak: c.shortPeak ?? 0.55 }), c.lead + 2 * c.period + 400);
    assert.equal(s.counted, 0, "nothing credited");
    assert.ok(s.partial >= 1, `a partial attempt is recorded (${JSON.stringify(s)})`);
  });

  test(`${c.id}: a flicked repetition never counts`, () => {
    const period = Math.round(getMovementTemplate(c.id)!.validity.tempoFloorMs * 0.8);
    const { s } = summaryOf(c, c.build({ period }), c.lead + 6 * period, 60);
    assert.equal(s.counted, 0, `flicked reps are not credited: ${JSON.stringify(s)}`);
  });

  test(`${c.id}: not being seen is never blamed on the person`, () => {
    const { s, r } = summaryOf(c, withDropout(c.build(), c.lead, Math.round(c.period * 0.3), 1500), c.lead + c.period + 1200);
    assert.equal(s.counted, 0, "a repetition that was not seen cannot be called good");
    assert.ok(s.uncertain >= 1, JSON.stringify(s));
    assert.equal(eventsOf(r.events, "movement_error").length, 0, "and nothing is flagged as a mistake");
  });

  if (c.faultCode) {
    test(`${c.id}: a mandatory fault (${c.faultCode}) makes the repetition NOT count, and names the rule`, () => {
      const { s, r } = summaryOf(c, c.build({ fault: true }), c.lead + c.period + 400);
      assert.equal(s.counted, 0, JSON.stringify(s));
      assert.ok(s.invalid >= 1, `recorded as an attempt that broke a rule (${JSON.stringify(s)})`);
      assert.ok(eventsOf(r.events, "rep_not_counted").some((e) => e.reasons.includes(c.faultCode as string)), JSON.stringify(eventsOf(r.events, "rep_not_counted")));
    });
  }
}
