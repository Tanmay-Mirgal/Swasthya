import test from "node:test";
import assert from "node:assert/strict";
import { nextSessionLine, routineLines, sessionHighlight, sessionSummaryLines, summarizeDay, weekConsistency, type SessionFacts } from "./milestones";

const base: SessionFacts = { exerciseId: "seated-knee-extension", completedSets: 3, targetSets: 3, completedReps: 30, judged: true, validReps: 24, invalidReps: 6, partialReps: 1, correctionAttempts: 3, correctionsSucceeded: 2, rom: 82, targetRom: 90, romUnit: "deg" };

test("highlight: each line appears only when the data makes it true", () => {
  assert.equal(sessionHighlight({ ...base, rom: 92 }), "You reached the range your therapist set.");
  assert.equal(sessionHighlight({ ...base, validReps: 30, invalidReps: 0, partialReps: 0 }), "Every rep had good form.");
  assert.equal(sessionHighlight(base), "You fixed 2 things as you went.");
  assert.equal(sessionHighlight({ ...base, correctionsSucceeded: 1 }), "You fixed 1 thing as you went.");
  assert.equal(sessionHighlight({ ...base, correctionsSucceeded: 0 }), "You completed every set.");
  assert.equal(sessionHighlight({ ...base, correctionsSucceeded: 0, completedSets: 2 }), null, "nothing is said when nothing special is true");
});

test("highlight: a range in percent is never compared with a target in degrees", () => {
  assert.notEqual(sessionHighlight({ ...base, rom: 150, romUnit: "pct" }), "You reached the range your therapist set.");
  assert.notEqual(sessionHighlight({ ...base, rom: 95, romUnit: undefined }), "You reached the range your therapist set.");
  assert.notEqual(sessionHighlight({ ...base, rom: 95, targetRom: undefined }), "You reached the range your therapist set.");
});

test("highlight: nothing about form or corrections for reps the engine did not judge", () => {
  const manual: SessionFacts = { exerciseId: "x", completedSets: 3, targetSets: 3, completedReps: 30, judged: false };
  assert.equal(sessionHighlight(manual), "You completed every set.");
  assert.equal(sessionHighlight({ ...manual, validReps: 30, invalidReps: 0, partialReps: 0, correctionsSucceeded: 4 }), "You completed every set.", "unjudged numbers are ignored");
  assert.deepEqual(sessionSummaryLines(manual), ["3 sets completed", "30 reps counted"]);
});

test("summary lines: good form is shown only for judged reps, and is a count, not a score", () => {
  assert.deepEqual(sessionSummaryLines(base), ["3 sets completed", "30 reps counted", "24 reps with good form"]);
  assert.deepEqual(sessionSummaryLines({ ...base, completedSets: 1, completedReps: 1, validReps: 1 }), ["1 set completed", "1 rep counted", "1 rep with good form"]);
});

test("day summary: the routine is complete only when every exercise due is done", () => {
  const plan = { completedExercises: 2, totalExercises: 3, completedSets: 6, totalSets: 9 };
  const sessions = [{ completedReps: 30, judged: true, validReps: 24, invalidReps: 6 }, { completedReps: 20, judged: true, validReps: 20, invalidReps: 0 }];
  const part = summarizeDay(plan, sessions);
  assert.equal(part.routineComplete, false);
  const full = summarizeDay({ ...plan, completedExercises: 3, completedSets: 9 }, sessions);
  assert.equal(full.routineComplete, true);
  assert.deepEqual([full.validReps, full.goodFormShare, full.repsCounted], [44, 88, 50]);
  assert.deepEqual(routineLines(full), ["3 exercises completed", "9 sets completed", "44 reps with good form"]);
});

test("day summary: a day with no judged reps shows no form numbers at all, and a rest day is never 'complete'", () => {
  const d = summarizeDay({ completedExercises: 2, totalExercises: 2, completedSets: 4, totalSets: 4 }, [{ completedReps: 20, judged: false }, { completedReps: 20, judged: false }]);
  assert.deepEqual([d.validReps, d.goodFormShare, d.routineComplete], [null, null, true]);
  assert.deepEqual(routineLines(d), ["2 exercises completed", "4 sets completed"]);
  assert.equal(summarizeDay({ completedExercises: 0, totalExercises: 0, completedSets: 0, totalSets: 0 }, []).routineComplete, false);
});

test("consistency counts days done and never mentions a missed day", () => {
  const week = [{ state: "done" }, { state: "missed" }, { state: "done" }, { state: "partial" }, { state: "todo" }, { state: "todo" }, { state: "todo" }] as const;
  assert.equal(weekConsistency([...week]), "You’ve done your exercises on 2 days this week.");
  assert.equal(weekConsistency([{ state: "done" }]), "You’ve done your exercises on 1 day this week.");
  assert.equal(weekConsistency([{ state: "missed" }, { state: "missed" }, { state: "todo" }]), null, "a quiet week says nothing rather than something discouraging");
  assert.equal(weekConsistency(undefined), null);
  assert.doesNotMatch(String(weekConsistency([...week])), /miss|lost|streak|behind|only/i);
});

test("the next-session line comes from the real schedule, and is absent when there is none", () => {
  const fmt = (d: string) => `on ${d}`;
  assert.equal(nextSessionLine([{ day: "2026-10-08", exercises: ["A"] }], fmt), "Your next session is on 2026-10-08.");
  assert.equal(nextSessionLine([], fmt), null);
  assert.equal(nextSessionLine(undefined, fmt), null);
});

test("engine 4 summary: good reps first, and the attempts that did not count are said plainly", () => {
  const v4: SessionFacts = { exerciseId: "x", completedSets: 3, targetSets: 3, completedReps: 24, judged: true, goodOnly: true, validReps: 24, invalidReps: 4, partialReps: 5, correctionAttempts: 3, correctionsSucceeded: 2, rom: 82, targetRom: 90, romUnit: "deg" };
  assert.deepEqual(sessionSummaryLines(v4), ["3 sets completed", "24 good reps", "9 attempts did not count"]);
  assert.deepEqual(sessionSummaryLines({ ...v4, invalidReps: 0, partialReps: 0 }), ["3 sets completed", "24 good reps"]);
  assert.equal(sessionHighlight({ ...v4, invalidReps: 0, partialReps: 0, rom: 82 }), "Every attempt counted as a good rep.");
  assert.equal(sessionHighlight(v4), "You fixed 2 things as you went.");
});

// ── A finished set ─────────────────────────────────────────────────────────────

import { evaluateSet, type SetFacts } from "./milestones";

const set: SetFacts = { setNumber: 1, totalSets: 3, exerciseComplete: false, judged: true, goodOnly: true, good: 10, invalid: 2, partial: 1, rom: 70, romUnit: "deg", targetRom: 90, personalBest: { rom: 72, unit: "deg" }, correctionsSucceeded: 0 };
const ids = (f: SetFacts) => evaluateSet(f).milestones.map((m) => m.id);

test("set: an ordinary set is celebrated, but nothing extra is claimed", () => {
  const c = evaluateSet(set);
  assert.deepEqual([c.level, c.headline, c.milestones], [1, "Set 1 complete", []]);
});

test("set: each milestone appears only when the numbers make it true", () => {
  assert.deepEqual(ids({ ...set, rom: 92, personalBest: { rom: 95, unit: "deg" } }), ["target_range"]);
  assert.deepEqual(ids({ ...set, rom: 76 }), ["best_range"], "beats the best by the margin");
  assert.deepEqual(ids({ ...set, invalid: 0, partial: 0 }), ["clean_set"]);
  assert.deepEqual(ids({ ...set, correctionsSucceeded: 2 }), ["fixed_it"]);
  assert.equal(evaluateSet({ ...set, rom: 92, personalBest: null }).level, 2, "a verified milestone raises the celebration");
});

test("set: the best-range claim holds the set to the same evidence bar as a session", () => {
  assert.deepEqual(ids({ ...set, rom: 76, good: 4, invalid: 1, partial: 0 }), [], "too few judged attempts to call anything a best");
  assert.deepEqual(ids({ ...set, rom: 74 }), [], "a margin smaller than the noise is not a best");
  assert.deepEqual(ids({ ...set, rom: 99, personalBest: null }), ["target_range"], "no history, no best");
  assert.deepEqual(ids({ ...set, rom: 140, romUnit: "pct", targetRom: undefined, personalBest: { rom: 72, unit: "deg" } }), [], "a percentage is never compared with degrees");
});

test("set: the target range is only about degrees, and only when a therapist range exists", () => {
  const noHistory = { ...set, personalBest: null };
  assert.deepEqual(ids({ ...noHistory, rom: 150, romUnit: "pct" }), []);
  assert.deepEqual(ids({ ...noHistory, rom: 95, targetRom: undefined }), []);
  assert.deepEqual(ids({ ...noHistory, rom: 95, good: 0 }), [], "no good rep, no range reached");
});

test("set: a clean set needs a few good reps, so one lucky rep is not a 'clean set'", () => {
  assert.deepEqual(ids({ ...set, good: 2, invalid: 0, partial: 0 }), []);
  assert.deepEqual(ids({ ...set, good: 3, invalid: 0, partial: 0 }), ["clean_set"]);
  assert.equal(evaluateSet({ ...set, good: 5, invalid: 0, partial: 0, goodOnly: false }).milestones[0].detail, "Every rep had good form.");
});

test("set: reps the engine did not judge (counted by hand) earn no form or range milestone", () => {
  const manual: SetFacts = { ...set, judged: false, invalid: 0, partial: 0, rom: 99, correctionsSucceeded: 3 };
  assert.deepEqual(ids(manual), []);
  assert.equal(evaluateSet(manual).level, 1);
});

test("set: halfway is marked once, as the middle is crossed, and never on the last set", () => {
  const at = (setNumber: number, totalSets: number) => ids({ ...set, setNumber, totalSets, invalid: 1 }).includes("halfway");
  assert.deepEqual([1, 2, 3].map((n) => at(n, 3)), [false, true, false]);
  assert.deepEqual([1, 2, 3, 4].map((n) => at(n, 4)), [false, true, false, false]);
  assert.deepEqual([1, 2, 3, 4, 5].map((n) => at(n, 5)), [false, false, true, false, false]);
  assert.equal(at(1, 2), false, "two sets have no middle to mark");
  assert.deepEqual(ids({ ...set, setNumber: 3, totalSets: 3, exerciseComplete: true, invalid: 1 }), ["exercise_complete"]);
});

test("set: finishing the exercise and the routine raise the celebration, in priority order", () => {
  const ex = evaluateSet({ ...set, setNumber: 3, exerciseComplete: true });
  assert.deepEqual([ex.level, ex.headline, ex.milestones[0].id], [2, "Exercise complete", "exercise_complete"]);
  assert.equal(ex.milestones[0].detail, "3 sets done.");
  const day = evaluateSet({ ...set, setNumber: 3, exerciseComplete: true, routineComplete: true, rom: 95, personalBest: null });
  assert.deepEqual([day.level, day.headline], [3, "Today’s routine complete"]);
  assert.deepEqual(day.milestones.map((m) => m.id), ["routine_complete", "exercise_complete", "target_range"]);
});

test("set: nothing here is a score, a rank or a streak, and nothing blames", () => {
  const all = evaluateSet({ ...set, setNumber: 2, rom: 95, invalid: 0, partial: 0, correctionsSucceeded: 2, personalBest: { rom: 60, unit: "deg" } });
  const text = all.milestones.map((m) => `${m.title} ${m.detail} ${m.spoken}`).join(" ");
  assert.doesNotMatch(text, /score|rank|streak|points?|level up|xp|badge|beat|record|only|miss|lost|behind/i);
});
