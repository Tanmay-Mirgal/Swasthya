import test from "node:test";
import assert from "node:assert/strict";
import { MovementEngine } from "../judge/engine";
import { getMovementTemplate } from "../template/registry";
import { eventsOf, lerp, repCurve, run, sideFrame } from "../testing/synth";
import { kneeExtensionSession, LEAD_MS } from "../testing/scenarios";
import { PoseLandmark as L } from "../landmarks";
import { JOINT_ERROR, JOINT_UNCERTAIN } from "../types";
import { summaryToPayload } from "../analytics/chunkPayload";
import { cleanQuality, rollupQuality } from "@/lib/rehab/chunkQuality";
import { ENGINE_VERSION } from "../version";

const knee = () => getMovementTemplate("seated-knee-extension")!;

test("only good reps are credited; a rule-breaking rep is recorded as an attempt, with its reasons", () => {
  const eng = new MovementEngine(knee(), { targetReps: 10 });
  // Rep 1 is clean; rep 2 leans the trunk for most of the movement.
  run(eng, kneeExtensionSession({ lean: (t) => (t > LEAD_MS + 4000 + 600 ? 28 : 0) }), LEAD_MS + 2 * 4000 + 500);
  const s = eng.getSummary();
  assert.equal(s.counted, 1, "the leaning rep is not credited");
  assert.equal(s.counted, s.valid, "since engine v4 counted and valid are the same number");
  assert.deepEqual(s.reps.map((r) => r.outcome), ["valid"], "the credited list holds good reps only");
  const bad = s.attempts.find((a) => a.outcome === "invalid");
  assert.ok(bad, "the leaning rep is kept as an attempt");
  assert.equal(bad!.reason, "rule_broken");
  assert.ok(bad!.reasons!.includes("TRUNK_LEAN"));
});

test("a partial attempt is kept as an attempt record and still not counted", () => {
  const eng = new MovementEngine(knee(), { targetReps: 10 });
  run(eng, kneeExtensionSession({ peak: 0.48 }), LEAD_MS + 2 * 4000 + 500);
  const s = eng.getSummary();
  assert.equal(s.counted, 0);
  assert.equal(s.partial, 2);
  const partials = s.attempts.filter((a) => a.outcome === "partial");
  assert.equal(partials.length, 2);
  assert.ok(partials.every((a) => a.reason === "short_range" && a.reached > 0 && a.reached < 1));
});

test("losing the person mid-rep is an uncertain rep: recorded, never counted, never a mistake", () => {
  const eng = new MovementEngine(knee(), { targetReps: 10 });
  const base = kneeExtensionSession();
  // The person vanishes for 3 s in the middle of the first rep (longer than the 2 s dropout limit).
  const gone = (t: number) => t > LEAD_MS + 1300 && t < LEAD_MS + 4300;
  const r = run(eng, (t) => (gone(t) ? { image: null, aspect: 16 / 9 } : base(t)), LEAD_MS + 4500);
  const s = eng.getSummary();
  assert.equal(s.uncertain, 1);
  assert.equal(s.counted, 0, "an unseen rep is not credited");
  assert.equal(s.invalid, 0);
  assert.equal(eventsOf(r.events, "movement_error").length, 0, "no correction is given for something that could not be seen");
  const ev = eventsOf(r.events, "uncertain_rep");
  assert.equal(ev.length, 1);
  assert.equal(ev[0].reason, "dropout");
  const a = s.attempts.find((x) => x.outcome === "uncertain");
  assert.ok(a && a.reason === "dropout" && a.reached > 0);
});

test("a rep that was seen the whole way is never marked uncertain", () => {
  const eng = new MovementEngine(knee(), { targetReps: 10 });
  const r = run(eng, kneeExtensionSession(), LEAD_MS + 3 * 4000 + 500);
  assert.equal(eng.getSummary().uncertain, 0);
  assert.equal(eventsOf(r.events, "uncertain_rep").length, 0);
});

/** The knee template with its trunk rule measuring against the ear (not a required joint), so a hidden ear leaves that rule unmeasurable. */
function kneeWithUncheckableTrunk(mandatory: boolean) {
  const t = structuredClone(knee());
  t.metrics.trunk = { kind: "fromVertical", a: { joint: "shoulder" }, b: { joint: "ear" } };
  t.setup.conditions = [];
  t.rules[0].invalidatesRep = mandatory;
  return t;
}
const earHidden = { vis: () => ({ [L.LEFT_EAR]: 0.1, [L.RIGHT_EAR]: 0.1 }) };

test("a MANDATORY rule that cannot be checked makes the rep uncertain: not good, not wrong, and the person is not blamed", () => {
  const eng = new MovementEngine(kneeWithUncheckableTrunk(true), { targetReps: 10 });
  const r = run(eng, kneeExtensionSession(earHidden), LEAD_MS + 4000 + 500, { trace: true });
  assert.ok(eventsOf(r.events, "rule_unevaluable").some((e) => e.rule === "trunk_lean"), "the trunk check is reported as not running");
  const s = eng.getSummary();
  assert.equal(s.counted, 0, "a rep cannot be called good while a mandatory rule is unchecked");
  assert.equal(s.uncertain, 1);
  assert.equal(eventsOf(r.events, "uncertain_rep")[0].reason, "rule_unevaluable");
  assert.equal(eventsOf(r.events, "movement_error").length, 0, "an unchecked rule is not an error");
  assert.ok(r.trace.some((f) => f.joints[L.LEFT_SHOULDER] === JOINT_UNCERTAIN), "its joints are yellow while it is unchecked, not a reassuring green");
  assert.ok(r.trace.every((f) => f.joints[L.LEFT_SHOULDER] !== JOINT_ERROR));
});

test("an ADVISORY rule that cannot be checked is reported but does not stop a good rep counting", () => {
  const eng = new MovementEngine(kneeWithUncheckableTrunk(false), { targetReps: 10 });
  const r = run(eng, kneeExtensionSession(earHidden), LEAD_MS + 4000 + 500);
  assert.ok(eventsOf(r.events, "rule_unevaluable").length >= 1);
  assert.equal(eng.getSummary().counted, 1);
  assert.equal(eng.getSummary().uncertain, 0);
});

test("a rule that can be measured is never reported as unmeasurable", () => {
  const eng = new MovementEngine(knee(), { targetReps: 10 });
  const r = run(eng, kneeExtensionSession(), LEAD_MS + 4500);
  assert.equal(eventsOf(r.events, "rule_unevaluable").length, 0);
  assert.deepEqual(eng.getSummary().unevaluable, []);
});

test("reset clears attempts, uncertain reps and unmeasurable rules", () => {
  const eng = new MovementEngine(knee(), { targetReps: 10 });
  run(eng, kneeExtensionSession({ peak: 0.48 }), LEAD_MS + 4500);
  assert.ok(eng.getSummary().attempts.length > 0);
  eng.reset(10);
  const s = eng.getSummary();
  assert.deepEqual([s.attempts.length, s.uncertain, s.unevaluable.length, s.counted], [0, 0, 0, 0]);
});

test("the 8 + 7 split still credits a 15-rep set, and outcomes add up (13 valid, 1 invalid, 2 partial)", () => {
  // Shape of the brief's example, as stored chunk data: counts are what credit the prescription.
  const first = cleanQuality({ engine: ENGINE_VERSION, validReps: 8, invalidReps: 0, partialReps: 0 }, 8);
  const second = cleanQuality({ engine: ENGINE_VERSION, validReps: 5, invalidReps: 1, partialReps: 2, uncertainReps: 1 }, 6);
  const roll = rollupQuality([{ reps: 8, ...first }, { reps: 6, ...second }]);
  assert.equal(roll.validReps, 13);
  assert.equal(roll.invalidReps, 1);
  assert.equal(roll.partialReps, 2);
  assert.equal(roll.uncertainReps, 1);
  assert.equal(8 + 6, 14, "counted reps (valid + invalid) credit the set; partial and uncertain never do");
});

test("the stored payload carries attempts, uncertain reps and unmeasurable rules, bounded and sanitised", () => {
  const eng = new MovementEngine(knee(), { targetReps: 10 });
  run(eng, kneeExtensionSession({ peak: 0.48 }), LEAD_MS + 2 * 4000 + 500);
  const payload = summaryToPayload(eng.getSummary());
  assert.equal(payload.engine, ENGINE_VERSION);
  assert.equal(payload.uncertainReps, 0);
  assert.equal(payload.attempts!.length, 2);
  const clean = cleanQuality(JSON.parse(JSON.stringify(payload)), payload.reps);
  assert.deepEqual(clean.attempts, payload.attempts);

  const hostile = cleanQuality(
    {
      engine: 3,
      uncertainReps: 5,
      unevaluable: ["TRUNK_LEAN", "<script>", 7],
      attempts: [
        { outcome: "uncertain", reason: "dropout", reached: 9, ms: 1000, conf: 2 },
        { outcome: "valid", reason: "dropout", reached: 0.5, ms: 1, conf: 1 },
        { outcome: "partial", reason: "not_a_reason", reached: 0.5, ms: 1, conf: 1 },
        "nope",
      ],
      repRecords: [{ n: 1, valid: false, outcome: "valid" }, { n: 2, valid: true, outcome: "valid" }],
    },
    5,
  );
  assert.equal(hostile.uncertainReps, 5);
  assert.deepEqual(hostile.unevaluable, ["TRUNK_LEAN"]);
  assert.deepEqual(hostile.attempts, [{ outcome: "uncertain", reason: "dropout", reached: 0, ms: 1000, conf: 0 }], "unknown outcomes/reasons and non-objects are dropped; out-of-range numbers fall back to 0");
  assert.equal(hostile.repRecords![0].outcome, undefined, "an outcome that contradicts validity is not stored");
  assert.equal(hostile.repRecords![1].outcome, "valid");
});
