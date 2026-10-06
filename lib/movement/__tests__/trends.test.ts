import test from "node:test";
import assert from "node:assert/strict";
import { buildTrends, type TrendInput } from "../analytics/trends";
import { avgRepSecondsOf } from "@/lib/rehab/chunkQuality";

const NOW = new Date("2026-10-20T09:00:00Z");
const day = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
const s = (n: number, over: Partial<TrendInput> = {}): TrendInput => ({
  id: `s${n}`,
  date: day(n),
  exerciseId: "seated-knee-extension",
  exerciseName: "Seated Knee Extension",
  completedReps: 10,
  targetReps: 10,
  rom: 80,
  judged: true,
  validReps: 8,
  invalidReps: 2,
  correctionAttempts: 4,
  correctionsSucceeded: 3,
  avgConfidence: 0.9,
  avgRepSeconds: 3.2,
  errors: [{ code: "TRUNK_LEAN", label: "Leaning the trunk", reps: 2 }],
  ...over,
});

test("points are oldest-first and carry only what was measured", () => {
  const [t] = buildTrends([s(1), s(5, { validReps: 5, invalidReps: 5 }), s(3)], { now: NOW });
  assert.deepEqual(t.points.map((p) => p.id), ["s5", "s3", "s1"]);
  assert.deepEqual(t.points.map((p) => p.validShare), [50, 80, 80]);
  assert.equal(t.validShareChange, 30);
  assert.equal(t.points[0].correctionRate, 75);
  assert.equal(t.points[0].avgRepSeconds, 3.2);
});

test("older sessions without per-rep judgment are not given a form score, and do not distort the change", () => {
  const [t] = buildTrends([s(9, { judged: false, validReps: undefined, invalidReps: undefined, errors: undefined }), s(4), s(1, { validReps: 9, invalidReps: 1 })], { now: NOW });
  assert.equal(t.points[0].validShare, undefined);
  assert.equal(t.points[0].correctionRate, undefined);
  assert.equal(t.points[0].rom, 80, "range and completion still count");
  assert.equal(t.judgedSessions, 2);
  assert.equal(t.validShareChange, 10, "compared only across judged sessions");
});

test("a single judged session has no change to report", () => {
  assert.equal(buildTrends([s(1)], { now: NOW })[0].validShareChange, undefined);
});

test("an error is called repeated only when it recurs across sessions", () => {
  const sessions = [s(1), s(3), s(5), s(7, { errors: [{ code: "TOO_FAST", reps: 1 }] })];
  const [t] = buildTrends(sessions, { now: NOW });
  assert.deepEqual(t.repeated.map((r) => [r.code, r.sessions, r.of, r.reps]), [["TRUNK_LEAN", 3, 4, 6]]);
  assert.equal(buildTrends([s(1), s(3)], { now: NOW })[0].repeated.length, 0, "two sessions is not a pattern");
});

test("consistency counts distinct active days in the last 28 days", () => {
  const [t] = buildTrends([s(1), s(1.2 as number), s(2), s(40)], { now: NOW });
  assert.equal(t.activeDays28, 2);
});

test("exercises are kept apart and units follow the exercise", () => {
  const trends = buildTrends([s(1), s(2, { exerciseId: "neck-rotation", exerciseName: "Neck Rotation", unit: "pct", rom: 31 })], { now: NOW });
  assert.deepEqual(trends.map((t) => [t.exerciseId, t.unit]), [["neck-rotation", "pct"], ["seated-knee-extension", "deg"]]);
});

test("average rep time comes from stored per-rep records only", () => {
  assert.equal(avgRepSecondsOf([{ chunks: [{ repRecords: [{ n: 1, valid: true, reasons: [], errors: [], rom: 1, ms: 3000, conf: 1 }, { n: 2, valid: true, reasons: [], errors: [], rom: 1, ms: 3400, conf: 1 }] }] }]), 3.2);
  assert.equal(avgRepSecondsOf([{ chunks: [{}] }]), undefined);
  assert.equal(avgRepSecondsOf(undefined), undefined);
});
