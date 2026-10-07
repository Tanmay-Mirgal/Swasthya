import test from "node:test";
import assert from "node:assert/strict";
import { EVIDENCE, progressFacts, type HistorySession } from "./progressFacts";

const s = (dateKey: string, over: Partial<HistorySession> = {}): HistorySession => ({ dateKey, exerciseId: "seated-knee-extension", judged: true, validReps: 20, invalidReps: 10, rom: 80, romUnit: "deg", targetRom: 90, ...over });

test("better range than last time, only when it clears the noise margin", () => {
  assert.deepEqual(progressFacts(s("2026-10-07", { rom: 86 }), [s("2026-10-06", { rom: 80 })]).highlights, ["Your range was better than your last session."]);
  assert.deepEqual(progressFacts(s("2026-10-07", { rom: 84 }), [s("2026-10-06", { rom: 80 })]).highlights, [], "4 degrees is inside the noise");
  assert.deepEqual(progressFacts(s("2026-10-07", { rom: 70 }), [s("2026-10-06", { rom: 80 })]).highlights, [], "a smaller range is simply not mentioned");
});

test("nothing is compared across units, or against sessions the engine did not judge", () => {
  assert.deepEqual(progressFacts(s("2026-10-07", { rom: 150, romUnit: "pct" }), [s("2026-10-06", { rom: 80 })]).highlights, []);
  assert.deepEqual(progressFacts(s("2026-10-07", { rom: 95 }), [s("2026-10-06", { rom: 60, judged: false })]).highlights, []);
  assert.deepEqual(progressFacts(s("2026-10-07", { rom: 95, judged: false }), [s("2026-10-06")]).highlights, []);
});

test("too few judged reps is not evidence, on either side", () => {
  const few = EVIDENCE.minJudgedReps - 1;
  assert.deepEqual(progressFacts(s("2026-10-07", { rom: 95, validReps: few, invalidReps: 0 }), [s("2026-10-06")]).highlights, []);
  assert.deepEqual(progressFacts(s("2026-10-07", { rom: 95 }), [s("2026-10-06", { validReps: 2, invalidReps: 1 })]).highlights, []);
});

test("sessions from the same day or later, or of another exercise, are not 'previous'", () => {
  assert.deepEqual(progressFacts(s("2026-10-07", { rom: 95 }), [s("2026-10-07", { rom: 60 }), s("2026-10-08", { rom: 60 }), s("2026-10-05", { rom: 60, exerciseId: "heel-raise" })]).highlights, []);
});

test("best range so far needs history and a clear margin", () => {
  const history = [s("2026-10-03", { rom: 70 }), s("2026-10-05", { rom: 78 })];
  assert.ok(progressFacts(s("2026-10-07", { rom: 82 }), history).highlights.includes("That’s your best range so far."));
  assert.ok(!progressFacts(s("2026-10-07", { rom: 80 }), history).highlights.includes("That’s your best range so far."), "2 degrees over the best is noise");
  assert.ok(!progressFacts(s("2026-10-07", { rom: 90 }), [s("2026-10-05", { rom: 70 })]).highlights.includes("That’s your best range so far."), "one earlier session is not enough for 'best'");
});

test("first time reaching the target range: needs earlier sessions, all short of it", () => {
  const first = progressFacts(s("2026-10-07", { rom: 91 }), [s("2026-10-05", { rom: 80 }), s("2026-10-03", { rom: 85 })]);
  assert.equal(first.highlights[0], "This is the first time you’ve reached the range your therapist set.");
  assert.ok(!progressFacts(s("2026-10-07", { rom: 91 }), [s("2026-10-05", { rom: 92 })]).highlights.some((h) => /first time/.test(h)), "already reached before");
  assert.ok(!progressFacts(s("2026-10-07", { rom: 91 }), []).highlights.some((h) => /first time/.test(h)), "no history: nothing to be first against");
  assert.ok(!progressFacts(s("2026-10-07", { rom: 150, romUnit: "pct", targetRom: 90 }), [s("2026-10-05", { rom: 50, romUnit: "pct" })]).highlights.some((h) => /first time/.test(h)), "a target in degrees never judges a percent range");
});

test("good form share must rise clearly", () => {
  const better = progressFacts(s("2026-10-07", { rom: 80, validReps: 27, invalidReps: 3 }), [s("2026-10-06", { rom: 80, validReps: 15, invalidReps: 15 })]);
  assert.deepEqual(better.highlights, ["More of your reps had good form than last time."]);
  assert.deepEqual(progressFacts(s("2026-10-07", { rom: 80, validReps: 17, invalidReps: 13 }), [s("2026-10-06", { rom: 80, validReps: 15, invalidReps: 15 })]).highlights, []);
});

test("highlights come in priority order: first target range, best, better than last, form", () => {
  const history = [s("2026-10-03", { rom: 70, validReps: 10, invalidReps: 10 }), s("2026-10-05", { rom: 78, validReps: 10, invalidReps: 10 })];
  const all = progressFacts(s("2026-10-07", { rom: 91, validReps: 28, invalidReps: 2 }), history).highlights;
  assert.deepEqual(all, ["This is the first time you’ve reached the range your therapist set.", "That’s your best range so far.", "Your range was better than your last session.", "More of your reps had good form than last time."]);
});

test("last-time line for the start of a session uses the latest usable judged session", () => {
  const f = progressFacts(null, [s("2026-10-03", { validReps: 5 }), s("2026-10-06", { validReps: 8 }), s("2026-10-07", { validReps: 2, invalidReps: 0 })]);
  assert.equal(f.lastTime, "Last time you completed 8 good repetitions. Let’s see how today feels.");
  assert.equal(progressFacts(null, []).lastTime, null);
  assert.equal(progressFacts(null, [s("2026-10-06", { judged: false })]).lastTime, null, "no claim from sessions the engine did not judge");
  assert.equal(progressFacts(null, [s("2026-10-06", { validReps: 0, invalidReps: 12 })]).lastTime, null, "no 'good repetitions' when there were none");
});

test("personal best is reported only with enough measured history, in one unit", () => {
  const history = [s("2026-10-03", { rom: 70 }), s("2026-10-05", { rom: 78 })];
  assert.deepEqual(progressFacts(null, history).personalBest, { rom: 78, unit: "deg" });
  assert.equal(progressFacts(null, [s("2026-10-05", { rom: 78 })]).personalBest, null);
});

test("no highlight ever claims anything negative, a score, or a cause", () => {
  const history = [s("2026-10-03", { rom: 70, validReps: 10, invalidReps: 10 }), s("2026-10-05", { rom: 78, validReps: 10, invalidReps: 10 })];
  const text = progressFacts(s("2026-10-07", { rom: 91, validReps: 28, invalidReps: 2 }), history).highlights.join(" ");
  assert.doesNotMatch(text, /worse|lost|behind|score|rank|%|because|tired|improv(ed|ing) your (condition|recovery)/i);
});

test("engine 4 sessions are compared only with engine 4 sessions (the share and the credited reps mean different things)", () => {
  const v4 = (dateKey: string, over: Partial<HistorySession> = {}) => s(dateKey, { engine: 4, validReps: 10, invalidReps: 4, partialReps: 6, ...over });
  // Today is v4; the only earlier session is older data: nothing to compare with.
  assert.deepEqual(progressFacts(v4("2026-10-07", { rom: 95 }), [s("2026-10-06", { rom: 60 })]).highlights, []);
  // Today and last time are both v4: compared as usual.
  assert.deepEqual(progressFacts(v4("2026-10-07", { rom: 80 }), [v4("2026-10-06", { rom: 60 })]).highlights, ["Your range was better than your last session."]);
  // The share includes attempts that fell short on v4: 10 good of 20 = 50%; then 17 of 20 = 85%.
  const better = progressFacts(v4("2026-10-07", { rom: 60, validReps: 17, invalidReps: 1, partialReps: 2 }), [v4("2026-10-06", { rom: 60 })]);
  assert.deepEqual(better.highlights, ["More of your attempts counted as good reps than last time."]);
});
