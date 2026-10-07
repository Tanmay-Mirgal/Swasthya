import test from "node:test";
import assert from "node:assert/strict";
import { acceptModelReport, allowedNumbers, buildSessionFacts, deterministicReport, reportTextIsSafe } from "../analytics/sessionReport";
import { summaryToPayload } from "../analytics/chunkPayload";
import { cleanQuality, clampQuality, correctionRateOf, formAccuracyOf, rollupQuality } from "@/lib/rehab/chunkQuality";
import { applyChunk, type SetRecord } from "@/lib/rehab/chunking";
import type { IExerciseSession } from "@/models/ExerciseSession";
import type { ChunkSummary } from "../judge/engine";

const summary = (over: Partial<ChunkSummary> = {}): ChunkSummary => ({
  // Engine v4: `counted` are the good reps; the 2 flagged and 1 short attempt are not counted.
  counted: 6,
  valid: 6,
  invalid: 2,
  partial: 1,
  rom: 78,
  romAverage: 70,
  avgConfidence: 0.93,
  lowConfidenceMs: 400,
  trackedMs: 40000,
  errors: { TRUNK_LEAN: { count: 3, severity: "major" }, TOO_FAST: { count: 1, severity: "minor" } },
  corrections: { attempted: 4, succeeded: 3 },
  uncertain: 0,
  attempts: [],
  unevaluable: [],
  thresholds: { minRange: 150, unit: "deg", holdMs: null, rangeOverridden: false },
  reps: Array.from({ length: 6 }, (_, i) => ({ n: i + 1, outcome: "valid" as const, valid: true, reasons: [], errors: [], rom: 70 + i, durationMs: 3000 + i * 100, confidence: 0.93 })),
  ...over,
});

test("chunk payload is built only from engine numbers", () => {
  const p = summaryToPayload({ ...summary(), observations: [{ code: "trunk_lean", label: "x", repsAffected: 3, ofReps: 8 }] });
  assert.equal(p.reps, 6, "the chunk's reps are its good reps");
  assert.equal(p.validReps, 6);
  assert.equal(p.invalidReps, 2);
  assert.equal(p.formScore, 67, "6 good of 9 attempts (6 good + 2 flagged + 1 short)");
  assert.deepEqual(p.issues, { TRUNK_LEAN: 3, TOO_FAST: 1 });
  assert.equal(p.engine, 4);
  assert.equal(p.repRecords!.length, 6);
  assert.deepEqual(p.observations, [{ code: "TRUNK_LEAN", repsAffected: 3, ofReps: 8 }]);
  assert.equal(summaryToPayload(summary({ counted: 0, valid: 0, invalid: 0, partial: 0, reps: [], rom: 0 })).formScore, undefined, "no score is invented when nothing was attempted");
  const onlyShort = summaryToPayload(summary({ counted: 0, valid: 0, invalid: 0, partial: 3, reps: [], rom: 0 }));
  assert.equal(onlyShort.reps, 0, "attempts that fell short credit nothing");
  assert.equal(onlyShort.formScore, 0, "and they are honestly reflected: 0 good of 3 attempts");
});

// ── Sanitising what the browser sends ─────────────────────────────────────────

test("quality data from the browser is clamped and whitelisted", () => {
  const q = cleanQuality(
    {
      engine: 2,
      validReps: 99,
      invalidReps: 99,
      partialReps: -4,
      avgConfidence: 3,
      lowConfidenceMs: "abc",
      corrections: { attempted: 2, succeeded: 9 },
      flags: { TRUNK_LEAN: { count: 3, severity: "major" }, "bad code!": { count: 1, severity: "minor" }, KNEE: { count: 1, severity: "catastrophic" } },
      repRecords: [{ n: 1, valid: true, reasons: ["TRUNK_LEAN", "drop table"], errors: [], rom: 9999, ms: 3000, conf: 0.9 }, "junk", { n: 0 }],
      observations: [{ code: "TRUNK_LEAN", repsAffected: 9, ofReps: 3 }, { code: "TOO_FAST", repsAffected: 2, ofReps: 5 }],
      evil: "<script>",
    },
    8
  );
  assert.equal(q.validReps, 8);
  assert.equal(q.invalidReps, 0, "valid + invalid can never exceed the reps credited");
  assert.equal(q.partialReps, undefined);
  assert.equal(q.avgConfidence, undefined);
  assert.equal(q.lowConfidenceMs, undefined);
  assert.deepEqual(q.corrections, { attempted: 2, succeeded: 2 });
  assert.deepEqual(Object.keys(q.flags!), ["TRUNK_LEAN"]);
  assert.equal(q.repRecords!.length, 1);
  assert.deepEqual(q.repRecords![0].reasons, ["TRUNK_LEAN"]);
  assert.equal(q.repRecords![0].rom, 0, "out-of-range numbers are dropped, not trusted");
  assert.deepEqual(q.observations, [{ code: "TOO_FAST", repsAffected: 2, ofReps: 5 }]);
  assert.ok(!("evil" in q));
  assert.deepEqual(cleanQuality(null, 5), {});
  assert.deepEqual(cleanQuality("x", 5), {});
});

test("quality is re-fitted when a chunk is credited fewer reps than it counted", () => {
  const q = clampQuality({ validReps: 6, invalidReps: 2, repRecords: Array.from({ length: 8 }, (_, i) => ({ n: i + 1, valid: true, reasons: [], errors: [], rom: 1, ms: 1, conf: 1 })) }, 5);
  assert.equal(q.validReps, 5);
  assert.equal(q.invalidReps, 0);
  assert.equal(q.repRecords!.length, 5);
});

test("8 + 7 = 15: chunks with mixed valid and invalid reps still fill the prescribed set exactly once", () => {
  const first = cleanQuality({ engine: 2, validReps: 6, invalidReps: 2 }, 8);
  const second = cleanQuality({ engine: 2, validReps: 7, invalidReps: 0 }, 7);
  let sets: SetRecord[] = [];
  const a = applyChunk({ sets, targetSets: 3, targetReps: 15, setIndex: 0, chunk: { chunkId: "a", reps: 8, ...first } });
  assert.ok(a.ok);
  sets = (a as { sets: SetRecord[] }).sets;
  const b = applyChunk({ sets, targetSets: 3, targetReps: 15, setIndex: 0, chunk: { chunkId: "b", reps: 7, ...second } });
  assert.ok(b.ok && b.setComplete);
  sets = (b as { sets: SetRecord[] }).sets;
  assert.equal(sets[0].completedReps, 15, "the prescription is still 15");
  const roll = rollupQuality(sets.flatMap((s) => s.chunks));
  assert.equal(roll.validReps, 13);
  assert.equal(roll.invalidReps, 2);
  // A retry of the same chunk adds nothing.
  const dup = applyChunk({ sets, targetSets: 3, targetReps: 15, setIndex: 0, chunk: { chunkId: "b", reps: 7, ...second } });
  assert.ok(dup.ok && dup.duplicate);
  // More reps than the set has left are never credited.
  const over = applyChunk({ sets: [], targetSets: 1, targetReps: 5, setIndex: 0, chunk: { chunkId: "c", reps: 5, validReps: 5, invalidReps: 0 } });
  assert.ok(over.ok);
});

test("rollups combine chunks without double counting, and weight confidence by reps", () => {
  const r = rollupQuality([
    { reps: 8, engine: 2, validReps: 6, invalidReps: 2, avgConfidence: 0.9, corrections: { attempted: 2, succeeded: 1 }, flags: { TRUNK_LEAN: { count: 2, severity: "major" } } },
    { reps: 2, engine: 2, validReps: 2, invalidReps: 0, avgConfidence: 0.6, corrections: { attempted: 1, succeeded: 1 }, flags: { TRUNK_LEAN: { count: 1, severity: "minor" } } },
  ]);
  assert.equal(r.validReps, 8);
  assert.equal(r.invalidReps, 2);
  assert.equal(r.avgConfidence, 0.84);
  assert.deepEqual(r.errors, { TRUNK_LEAN: { count: 3, severity: "major" } });
  assert.equal(r.correctionAttempts, 3);
  assert.equal(rollupQuality([{ reps: 5 }]).validReps, undefined, "legacy chunks produce no invented quality");
  assert.equal(formAccuracyOf(8, 2), 80);
  assert.equal(formAccuracyOf(undefined, 2), undefined);
  assert.equal(correctionRateOf(0, 0), undefined);
  assert.equal(correctionRateOf(4, 3), 75);
});

// ── Report ─────────────────────────────────────────────────────────────────────

function session(over: Partial<IExerciseSession> = {}): IExerciseSession {
  const mk = (index: number, reps: number, valid: number, invalid: number, conf = 0.93) => ({
    index,
    completedReps: reps,
    chunks: [{ chunkId: `c${index}`, reps, engine: 2, validReps: valid, invalidReps: invalid, partialReps: 0, rom: 70 + index, avgConfidence: conf, repRecords: [{ n: 1, valid: true, reasons: [], errors: [], rom: 70, ms: 3200, conf: 0.9 }] }],
  });
  return {
    exerciseId: "seated-knee-extension",
    exerciseName: "Seated Knee Extension",
    targetReps: 45,
    completedReps: 45,
    rom: 82,
    targetRom: 90,
    dateKey: "2026-10-07",
    engineVersion: 2,
    validReps: 37,
    invalidReps: 8,
    partialReps: 3,
    correctionAttempts: 6,
    correctionsSucceeded: 4,
    avgConfidence: 0.92,
    issueCounts: { TRUNK_LEAN: 6, TOO_FAST: 2 },
    issueSeverity: { TRUNK_LEAN: "major", TOO_FAST: "minor" },
    observations: [{ code: "TRUNK_LEAN", repsAffected: 6, ofReps: 45 }],
    sets: [mk(0, 15, 10, 5), mk(1, 15, 13, 2), mk(2, 15, 14, 1)],
    ...over,
  } as unknown as IExerciseSession;
}

test("facts come straight from stored numbers, with per-set trend and sorted errors", () => {
  const f = buildSessionFacts(session());
  assert.equal(f.judged, true);
  assert.equal(f.valid, 37);
  assert.equal(f.validShare, 82);
  assert.deepEqual(f.sets.map((s) => s.validShare), [67, 87, 93]);
  assert.deepEqual(f.trend, { from: 67, to: 93, sets: 3, change: 26 });
  assert.equal(f.errors[0].code, "TRUNK_LEAN");
  assert.equal(f.errors[0].label, "Leaning the trunk");
  assert.deepEqual(f.corrections, { attempted: 6, succeeded: 4, ratePercent: 67 });
  assert.equal(f.avgRepSeconds, 3.2);
  assert.equal(f.rom?.best, 82);
});

test("the deterministic report states only what was measured", () => {
  const r = deterministicReport(buildSessionFacts(session()));
  assert.match(r.summary, /45 of 45 reps/);
  assert.match(r.summary, /37 of 45/);
  assert.ok(r.wentWell.some((x) => /rose from 67% to 93%/.test(x)));
  assert.ok(r.toImprove.some((x) => /Leaning the trunk came up in 6 reps/.test(x)));
  assert.match(r.mostCommonError ?? "", /Leaning the trunk/);
  assert.match(r.correctionSuccess ?? "", /4 of 6/);
  assert.match(r.nextFocus, /leaning the trunk/);
  assert.match(r.therapistSummary, /Repeated across reps/);
  const all = JSON.stringify(r);
  assert.doesNotMatch(all, /diagnos|injur|because|caused|medicat|you should/i, "no diagnosis, cause or treatment advice");
});

test("a session with no per-rep judgment says so instead of inventing quality", () => {
  const legacy = session({ engineVersion: undefined, validReps: undefined, invalidReps: undefined, issueCounts: { TOO_FAST: 4 } });
  const f = buildSessionFacts(legacy);
  assert.equal(f.judged, false);
  assert.deepEqual(f.errors, []);
  const r = deterministicReport(f);
  assert.match(r.summary, /Movement checks were not recorded/);
  assert.equal(r.mostCommonError, null);
  assert.match(r.therapistSummary, /No per-rep movement data/);
});

test("a rough session names the problems and a focus, without blame or causes", () => {
  const f = buildSessionFacts(session({ completedReps: 30, validReps: 12, invalidReps: 18, partialReps: 9, avgConfidence: 0.5, correctionsSucceeded: 1 }));
  const r = deterministicReport(f);
  assert.ok(r.toImprove.some((x) => /9 attempts did not go far enough/.test(x)));
  assert.ok(r.toImprove.some((x) => /trouble seeing/.test(x)));
  assert.equal(r.wentWell.some((x) => /All 45/.test(x)), false);
});

test("model-written reports are accepted only if every number and phrase checks out", () => {
  const f = buildSessionFacts(session());
  const det = deterministicReport(f);
  const good = { ...det, summary: "You finished all 45 reps, and 37 of them met the movement checks. Nice work." };
  assert.ok(acceptModelReport(good, f));

  const bad: Array<[string, Record<string, unknown>]> = [
    ["invented number", { ...good, summary: "You finished all 45 reps and 41 met the checks." }],
    ["diagnosis", { ...good, nextFocus: "This looks like an injury so rest." }],
    ["cause", { ...good, toImprove: ["You lean because your core is weak."] }],
    ["medication", { ...good, therapistSummary: "Consider medication for the discomfort." }],
    ["missing field", { ...good, nextFocus: undefined }],
    ["wrong type", { ...good, wentWell: "all good" }],
    ["too many bullets", { ...good, wentWell: Array(9).fill("Good.") }],
    ["html", { ...good, summary: "<b>45</b> reps" }],
  ];
  for (const [name, b] of bad) assert.equal(acceptModelReport(b, f), null, name);
  assert.equal(acceptModelReport(null, f), null);
  assert.ok(allowedNumbers(f).has("93"));
  assert.equal(reportTextIsSafe("Set 2 had 13 valid reps.", allowedNumbers(f)), true);
  assert.equal(reportTextIsSafe("Set 2 had 99 valid reps.", allowedNumbers(f)), false);
});
