import test from "node:test";
import assert from "node:assert/strict";
import { applyChunk } from "@/lib/rehab/chunking";
import { cleanQuality, clampQuality, formShareOf, rollupQuality } from "@/lib/rehab/chunkQuality";
import { buildTrends, type TrendInput } from "../analytics/trends";
import { buildSessionFacts, deterministicReport } from "../analytics/sessionReport";
import type { IExerciseSession } from "@/models/ExerciseSession";

// ── What is stored: reps are GOOD reps; attempts that did not count sit beside them ──────────────────────────────

test("engine 4: a chunk's reps are its good reps, and attempts that did not count may outnumber them", () => {
  const q = cleanQuality({ engine: 4, validReps: 5, invalidReps: 12, partialReps: 9 }, 5);
  assert.deepEqual([q.validReps, q.invalidReps, q.partialReps], [5, 12, 9], "nothing is clamped to the credited reps");
  const old = cleanQuality({ engine: 3, validReps: 5, invalidReps: 12, partialReps: 9 }, 5);
  assert.deepEqual([old.validReps, old.invalidReps], [5, 0], "before v4, flagged reps were part of the credited ones, so they were bounded by them");
});

test("engine 4 quality survives a chunk being credited fewer reps than it counted", () => {
  const q = cleanQuality({ engine: 4, validReps: 8, invalidReps: 14 }, 8);
  const fitted = clampQuality(q, 6);
  assert.deepEqual([fitted.validReps, fitted.invalidReps], [6, 14], "good reps are bounded by what was credited; the others are not");
  const old = clampQuality(cleanQuality({ engine: 3, validReps: 6, invalidReps: 2 }, 8), 6);
  assert.deepEqual([old.validReps, old.invalidReps], [6, 0]);
});

test("a not-counted attempt is stored with its reasons and range, sanitised", () => {
  const q = cleanQuality(
    { engine: 4, validReps: 1, invalidReps: 1, attempts: [{ outcome: "invalid", reason: "rule_broken", reached: 1, ms: 3000, conf: 0.9, reasons: ["TRUNK_LEAN", "<script>"], rom: 80 }, { outcome: "partial", reason: "short_range", reached: 0.4, ms: 2000, conf: 0.9, reasons: ["TRUNK_LEAN"] }] },
    1,
  );
  assert.deepEqual(q.attempts![0], { outcome: "invalid", reason: "rule_broken", reached: 1, ms: 3000, conf: 0.9, reasons: ["TRUNK_LEAN"], rom: 80 });
  assert.equal(q.attempts![1].reasons, undefined, "reasons are only kept for attempts that broke a rule");
});

test("good reps credit the set; the attempts that did not count credit nothing", () => {
  const chunk = { chunkId: "a", reps: 4, ...cleanQuality({ engine: 4, validReps: 4, invalidReps: 9, partialReps: 5 }, 4) };
  const r = applyChunk({ sets: [], targetSets: 1, targetReps: 8, setIndex: 0, chunk });
  assert.ok(r.ok && !r.duplicate);
  if (r.ok) {
    assert.equal(r.credited, 4);
    assert.equal(r.sets[0].completedReps, 4, "4 of 8, however many attempts it took");
    assert.equal(r.setComplete, false);
  }
});

test("rollups add up good reps and not-counted attempts separately", () => {
  const a = cleanQuality({ engine: 4, validReps: 4, invalidReps: 9, partialReps: 5 }, 4);
  const b = cleanQuality({ engine: 4, validReps: 4, invalidReps: 1, partialReps: 0 }, 4);
  const roll = rollupQuality([{ reps: 4, ...a }, { reps: 4, ...b }]);
  assert.deepEqual([roll.validReps, roll.invalidReps, roll.partialReps], [8, 10, 5]);
});

// ── The share means something different from engine v4, so it is never mixed ─────────────────────────────────────

test("the good-form share counts every attempt from engine 4, and only counted reps before", () => {
  assert.equal(formShareOf({ engineVersion: 3, validReps: 8, invalidReps: 2, partialReps: 10 }), 80, "older data: partial attempts were never part of the share");
  assert.equal(formShareOf({ engineVersion: 4, validReps: 8, invalidReps: 2, partialReps: 10 }), 40, "8 good of 20 attempts");
  assert.equal(formShareOf({ engineVersion: 4, validReps: 0, invalidReps: 0, partialReps: 0 }), undefined);
});

const NOW = new Date("2026-10-20T09:00:00Z");
const day = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
const t = (n: number, over: Partial<TrendInput> = {}): TrendInput => ({ id: `s${n}`, date: day(n), exerciseId: "seated-knee-extension", exerciseName: "Seated Knee Extension", completedReps: 10, targetReps: 10, rom: 80, judged: true, engineVersion: 3, validReps: 8, invalidReps: 2, ...over });

test("a trend never compares a v4 share with an older one", () => {
  const [mixed] = buildTrends([t(9, { engineVersion: 3, validReps: 10, invalidReps: 0 }), t(2, { engineVersion: 4, validReps: 8, invalidReps: 2, partialReps: 8 })], { now: NOW });
  assert.deepEqual(mixed.points.map((p) => p.validShare), [100, 44], "each on its own basis");
  assert.equal(mixed.validShareChange, undefined, "so there is no change to report between them");
  const [same] = buildTrends([t(9, { engineVersion: 4, validReps: 4, invalidReps: 4, partialReps: 4 }), t(2, { engineVersion: 4, validReps: 8, invalidReps: 2, partialReps: 2 })], { now: NOW });
  assert.equal(same.validShareChange, 67 - 33);
});

// ── What the report says ─────────────────────────────────────────────────────────────────────────────────────────

function v4Session(): IExerciseSession {
  return {
    exerciseId: "seated-knee-extension",
    exerciseName: "Seated Knee Extension",
    targetReps: 8,
    completedReps: 8,
    rom: 92,
    targetRom: 90,
    dateKey: "2026-10-07",
    engineVersion: 4,
    validReps: 8,
    invalidReps: 3,
    partialReps: 5,
    correctionAttempts: 4,
    correctionsSucceeded: 3,
    avgConfidence: 0.9,
    issueCounts: { TRUNK_LEAN: 3 },
    issueSeverity: { TRUNK_LEAN: "major" },
    sets: [{ index: 0, completedReps: 8, chunks: [{ chunkId: "c", reps: 8, engine: 4, validReps: 8, invalidReps: 3, partialReps: 5 }] }],
  } as unknown as IExerciseSession;
}

test("a v4 report counts good reps, then says plainly how many attempts did not count and why", () => {
  const facts = buildSessionFacts(v4Session());
  assert.equal(facts.goodOnly, true);
  assert.equal(facts.notCounted, 8);
  assert.equal(facts.validShare, 50, "8 good of 16 attempts");
  const r = deterministicReport(facts);
  assert.match(r.summary, /8 of 8 good reps/);
  assert.match(r.summary, /8 other attempts did not count: 3 broke a movement check and 5 did not go far enough/);
  assert.doesNotMatch(r.summary, /also met the movement checks|counted with a note/, "no longer says flagged reps were counted");
  assert.match(r.therapistSummary, /8 good reps; not counted: 3 broke a movement check, 5 did not reach the full range/);
  assert.ok(r.toImprove.some((x) => /3 attempts broke a movement check and did not count/.test(x)));
});

test("a report for older data keeps its meaning", () => {
  const old = { ...v4Session(), engineVersion: 3 } as IExerciseSession;
  const facts = buildSessionFacts(old);
  assert.equal(facts.goodOnly, false);
  assert.match(deterministicReport(facts).summary, /also met the movement checks/);
});
