import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, dateKeyInTimezone, diffDays, isDateKey, weekdayOf } from "./dates";
import {
  adherenceBetween,
  adherencePercent,
  computeDailyPlan,
  endDateFor,
  exercisesDueOn,
  reviewDays,
  reviewWeekOn,
  type ScheduleInput,
} from "./schedule";
import { applyChunk, totalRepsOf, type SetRecord } from "./chunking";

const plan = (over: Partial<ScheduleInput> = {}): ScheduleInput => ({
  startDate: "2026-10-01", // a Thursday
  endDate: endDateFor("2026-10-01", 30),
  frequency: "daily",
  exercises: [
    { key: "a", exerciseId: "seated-knee-extension", name: "Seated Knee Extension", sets: 3, reps: 15 },
    { key: "b", exerciseId: "seated-bicep-curl", name: "Seated Bicep Curl", sets: 2, reps: 10 },
  ],
  weeklyReview: { enabled: true, cycleDay: 6, requireRecording: true, recordingExerciseKey: "b" },
  ...over,
});

test("date keys: validation, arithmetic, timezone", () => {
  assert.ok(isDateKey("2026-02-28"));
  assert.ok(!isDateKey("2026-02-30"));
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(diffDays("2026-10-01", "2026-10-07"), 6);
  assert.equal(weekdayOf("2026-10-01"), 4);
  // 20:00 UTC on the 1st is already the 2nd in India.
  assert.equal(dateKeyInTimezone(new Date("2026-10-01T20:00:00Z"), "Asia/Kolkata"), "2026-10-02");
  assert.equal(dateKeyInTimezone(new Date("2026-10-01T20:00:00Z"), "UTC"), "2026-10-01");
  assert.equal(dateKeyInTimezone(new Date("2026-10-01T20:00:00Z"), "Not/AZone"), "2026-10-02"); // falls back
});

test("30-day plan ends on day 30", () => {
  assert.equal(endDateFor("2026-10-01", 30), "2026-10-30");
  assert.equal(endDateFor("2026-10-01", 1), "2026-10-01");
});

test("weekly review lands on day 6 of each cycle and not past the end", () => {
  const p = plan();
  const days = reviewDays(p);
  assert.deepEqual(days.map((d) => d.week), [1, 2, 3, 4]);
  assert.deepEqual(days.map((d) => d.day), ["2026-10-06", "2026-10-13", "2026-10-20", "2026-10-27"]);
  assert.equal(reviewWeekOn(p, "2026-10-06"), 1);
  assert.equal(reviewWeekOn(p, "2026-10-07"), null);
  assert.equal(reviewWeekOn(p, "2026-11-02"), null); // outside plan
  assert.equal(reviewWeekOn(plan({ weeklyReview: { enabled: false, cycleDay: 6, requireRecording: false } }), "2026-10-06"), null);
});

test("frequency decides which days are training days", () => {
  const alt = plan({ frequency: "alternate", weeklyReview: undefined });
  assert.equal(exercisesDueOn(alt, "2026-10-01").length, 2); // day 1
  assert.equal(exercisesDueOn(alt, "2026-10-02").length, 0); // day 2 rest
  assert.equal(exercisesDueOn(alt, "2026-10-03").length, 2); // day 3

  const wk = plan({ frequency: "weekdays", weeklyReview: undefined });
  assert.equal(exercisesDueOn(wk, "2026-10-03").length, 0); // Saturday
  assert.equal(exercisesDueOn(wk, "2026-10-05").length, 2); // Monday
  assert.equal(exercisesDueOn(wk, "2026-09-30").length, 0); // before start
});

test("a review day on a rest day still schedules the recorded exercise", () => {
  const alt = plan({ frequency: "alternate" }); // day 6 = Oct 6 is a rest day (even)
  const due = exercisesDueOn(alt, "2026-10-06");
  assert.deepEqual(due.map((e) => e.key), ["b"]);
});

test("daily plan reflects stored progress (2 of 3 sets, partial third)", () => {
  const p = plan({ weeklyReview: undefined });
  const d = computeDailyPlan(p, "2026-10-02", [
    { exerciseKey: "a", sets: [{ index: 0, completedReps: 15 }, { index: 1, completedReps: 15 }, { index: 2, completedReps: 8 }] },
  ]);
  const a = d.exercises.find((e) => e.key === "a")!;
  assert.equal(a.completedSets, 2);
  assert.equal(a.completedReps, 38);
  assert.equal(a.status, "in_progress");
  assert.equal(a.currentSetIndex, 2);
  assert.equal(a.sets[2].remainingReps, 7);
  assert.equal(d.exercises.find((e) => e.key === "b")!.status, "not_started");
  assert.equal(d.totalSets, 5);
  assert.equal(d.completedSets, 2);
  assert.equal(d.completionPercent, 40);
  assert.equal(d.dayNumber, 2);
});

test("reps beyond the prescribed target never inflate a set", () => {
  const d = computeDailyPlan(plan({ weeklyReview: undefined }), "2026-10-02", [
    { exerciseKey: "a", sets: [{ index: 0, completedReps: 99 }] },
  ]);
  assert.equal(d.exercises[0].sets[0].completedReps, 15);
});

test("rep chunking: 8 + rest + 7 completes a set of 15 with no double count", () => {
  let sets: SetRecord[] = [];
  const r1 = applyChunk({ sets, targetSets: 3, targetReps: 15, setIndex: 0, chunk: { chunkId: "c1", reps: 8 } });
  assert.ok(r1.ok);
  if (!r1.ok) return;
  assert.equal(r1.credited, 8);
  assert.equal(r1.setComplete, false);
  sets = r1.sets;

  // The same chunk retried (network retry) must not count again.
  const retry = applyChunk({ sets, targetSets: 3, targetReps: 15, setIndex: 0, chunk: { chunkId: "c1", reps: 8 } });
  assert.ok(retry.ok && retry.duplicate);
  if (retry.ok) assert.equal(retry.sets[0].completedReps, 8);

  const r2 = applyChunk({ sets, targetSets: 3, targetReps: 15, setIndex: 0, chunk: { chunkId: "c2", reps: 7 } });
  assert.ok(r2.ok && !r2.duplicate);
  if (!r2.ok) return;
  assert.equal(r2.setComplete, true);
  assert.equal(r2.sets[0].completedReps, 15);
  assert.equal(r2.sets[0].chunks.length, 2);
  assert.equal(totalRepsOf(r2.sets, 15), 15);
});

test("chunking: cannot over-credit, skip ahead, reopen a set, or change the target", () => {
  const base = { targetSets: 3, targetReps: 15 };
  // Chunk larger than the target is rejected outright (the patient cannot raise or lower the target).
  assert.equal(applyChunk({ ...base, sets: [], setIndex: 0, chunk: { chunkId: "x", reps: 16 } }).ok, false);
  // Cannot start set 2 before set 1 is done.
  const skip = applyChunk({ ...base, sets: [], setIndex: 1, chunk: { chunkId: "y", reps: 5 } });
  assert.equal(skip.ok, false);
  // A set beyond the prescription does not exist.
  assert.equal(applyChunk({ ...base, sets: [], setIndex: 3, chunk: { chunkId: "z", reps: 1 } }).ok, false);
  // Overflow is clipped to what remains.
  const sets: SetRecord[] = [{ index: 0, completedReps: 12, chunks: [{ chunkId: "p", reps: 12 }] }];
  const clipped = applyChunk({ ...base, sets, setIndex: 0, chunk: { chunkId: "q", reps: 10 } });
  assert.ok(clipped.ok);
  if (clipped.ok) {
    assert.equal(clipped.credited, 3);
    assert.equal(clipped.sets[0].completedReps, 15);
  }
  // A completed set cannot be reopened.
  const full: SetRecord[] = [{ index: 0, completedReps: 15, chunks: [{ chunkId: "p", reps: 15 }] }];
  assert.equal(applyChunk({ ...base, sets: full, setIndex: 0, chunk: { chunkId: "r", reps: 3 } }).ok, false);
});

test("missed days are identified; today is never missed; rest days are skipped", () => {
  const p = plan({ frequency: "alternate", weeklyReview: undefined });
  const logs = {
    "2026-10-01": [
      { exerciseKey: "a", sets: [0, 1, 2].map((i) => ({ index: i, completedReps: 15 })) },
      { exerciseKey: "b", sets: [0, 1].map((i) => ({ index: i, completedReps: 10 })) },
    ],
    // 2026-10-03: nothing logged -> missed
    "2026-10-05": [{ exerciseKey: "a", sets: [{ index: 0, completedReps: 15 }] }], // partial
  };
  const days = adherenceBetween(p, "2026-10-01", "2026-10-07", logs, "2026-10-07");
  assert.deepEqual(
    days.map((d) => [d.day, d.status]),
    [
      ["2026-10-01", "complete"],
      ["2026-10-03", "missed"],
      ["2026-10-05", "partial"],
      ["2026-10-07", "pending"],
    ]
  );
  // Sets completed / sets due over the three past days: (5 + 0 + 1) / (5 + 5 + 5) = 40%
  assert.equal(adherencePercent(days.slice(0, 3)), 40);
});
