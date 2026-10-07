import test from "node:test";
import assert from "node:assert/strict";
import { allPatientStrings, ADVICE_SHORT, deriveStageVerdict, type StageInput } from "../verdict/stageVerdict";
import { createCoachState, reduceCoach, type CoachEffect } from "../coach/coachState";
import { getAllMovementTemplates, getMovementTemplate } from "../template/registry";
import { LEAD_MS, MIXED_PLAN, repPlanSession, replayUntil } from "../testing/scenarios";
import { COACH_CONFIG } from "../coach/config";
import type { MovementEvent } from "../types";

const base: StageInput = { tracking: true, confidence: "HIGH", advice: null, phase: "rest", paused: false, verdict: null };
const knee = getMovementTemplate("seated-knee-extension")!;

// Words a patient must never be shown or told (they are for therapists and developers).
const BANNED = /\b(invalid|error|incorrect|wrong|failed?|low confidence|landmarks?|angle|threshold|combo|lost|tracking|pose|estimation)\b/i;

test("the stage says one thing, in the order that matters: can't see, paused, not counted, couldn't judge, fixed, good, going", () => {
  const v = (kind: NonNullable<StageInput["verdict"]>["kind"], extra = {}) => ({ kind, seq: 1, ...extra });
  assert.equal(deriveStageVerdict({ ...base, verdict: v("good") }).kind, "good");
  assert.equal(deriveStageVerdict({ ...base, verdict: v("not_counted", { show: "Sit tall" }) }).kind, "not_counted");
  assert.equal(deriveStageVerdict({ ...base, verdict: v("partial") }).kind, "not_counted", "a short attempt is also 'not counted'");
  assert.equal(deriveStageVerdict({ ...base, verdict: v("uncertain") }).kind, "uncertain");
  assert.equal(deriveStageVerdict({ ...base, verdict: v("corrected") }).kind, "corrected");
  assert.equal(deriveStageVerdict({ ...base }).kind, "tracking");
  assert.equal(deriveStageVerdict({ ...base, phase: "setup" }).kind, "ready");
  assert.equal(deriveStageVerdict({ ...base, paused: true, verdict: v("good") }).kind, "paused", "paused wins over a result");
  assert.equal(deriveStageVerdict({ ...base, confidence: "LOW", verdict: v("not_counted") }).kind, "cant_see", "if the camera cannot see, nothing is called wrong");
  assert.equal(deriveStageVerdict({ ...base, advice: { code: "too_close", message: "Move slightly backward." }, verdict: v("good") }).kind, "cant_see");
  assert.equal(deriveStageVerdict({ ...base, tracking: false }).kind, "cant_see");
});

test("every state has a mark, a word and a tone, so none depends on colour, and 'can't see' is never red", () => {
  const states = [
    deriveStageVerdict({ ...base, verdict: { kind: "good", seq: 1 } }),
    deriveStageVerdict({ ...base, verdict: { kind: "not_counted", seq: 2, show: "Sit tall" } }),
    deriveStageVerdict({ ...base, verdict: { kind: "uncertain", seq: 3 } }),
    deriveStageVerdict({ ...base, confidence: "LOW" }),
    deriveStageVerdict({ ...base, paused: true }),
  ];
  assert.deepEqual(states.map((s) => [s.glyph, s.tone]), [["check", "good"], ["cross", "bad"], ["question", "unsure"], ["question", "unsure"], ["pause", "neutral"]]);
  assert.ok(states.every((s) => s.word.length > 0 && s.word.length <= 24));
  assert.equal(new Set(states.map((s) => s.word)).size, states.length, "no two states read alike");
  assert.ok(!states.filter((s) => s.tone === "unsure").some((s) => s.glyph === "cross"), "a camera problem never wears the cross");
});

test("what a patient is shown fits across a room and never uses technical words", () => {
  for (const s of allPatientStrings()) {
    assert.ok(s.length <= 24, `"${s}" is ${s.length} characters`);
    assert.doesNotMatch(s, BANNED, s);
  }
  for (const code of Object.keys(ADVICE_SHORT)) assert.ok(ADVICE_SHORT[code as keyof typeof ADVICE_SHORT].length <= 24);
  for (const t of getAllMovementTemplates()) {
    for (const r of [...Object.values(t.repRules), ...t.rules]) for (const m of r ? [r.low, r.high] : []) if (m) {
      assert.doesNotMatch(m.show, BANNED, `${t.id}: ${m.show}`);
      for (const text of m.texts) assert.doesNotMatch(text, BANNED, `${t.id}: ${text}`);
    }
  }
});

test("what is spoken is exactly what the screen is built from: not counted says the one thing to change", () => {
  let s = reduceCoach(createCoachState(knee), { type: "set_started", t: 0, set: 1, targetReps: 8, repsBefore: 0 }, knee, { llmEnabled: false }).state;
  const flagged: MovementEvent = { type: "rep_not_counted", t: 5000, rep: 0, reasons: ["trunk_lean"], rom: 80, durationMs: 4000, confidence: 0.95 };
  const r = reduceCoach(s, flagged, knee, { llmEnabled: false });
  s = r.state;
  const spoken = r.effects.filter((e): e is Extract<CoachEffect, { kind: "speak" }> => e.kind === "speak").map((e) => e.text);
  assert.equal(s.verdict?.show, "Sit tall");
  assert.equal(spoken.length, 1, "said once");
  assert.equal(spoken[0], s.verdict?.say);
  assert.match(spoken[0], /^(Not counted\.|That one wasn’t counted\.) Sit tall\.$/);
  const stage = deriveStageVerdict({ ...base, verdict: s.verdict });
  assert.equal(stage.word, "NOT COUNTED");
  assert.equal(stage.instruction, "Sit tall");
  assert.equal(stage.say, spoken[0], "the captions show the very words that were spoken");
});

test("a rep the camera could not judge is said gently, and is never counted against the patient", () => {
  const r = reduceCoach(createCoachState(knee), { type: "uncertain_rep", t: 4000, reached: 0.6, reason: "dropout" }, knee, { llmEnabled: false });
  assert.equal(r.state.verdict?.kind, "uncertain");
  assert.equal(r.state.verdict?.say, "I couldn’t see that one clearly. Let’s try it again.");
  assert.equal(r.state.streak, 0);
  assert.doesNotMatch(r.state.verdict!.say!, BANNED);
});

test("the result clears on its own, each kind after the time it needs", () => {
  let s = createCoachState(knee);
  s = reduceCoach(s, { type: "set_started", t: 0, set: 1, targetReps: 8, repsBefore: 0 }, knee, { llmEnabled: false }).state;
  s = reduceCoach(s, { type: "rep_completed", t: 1000, rep: 1, valid: true, reasons: [], rom: 80, durationMs: 3000, confidence: 0.9 }, knee, { llmEnabled: false }).state;
  assert.equal(s.verdict?.kind, "good");
  const early = reduceCoach(s, { type: "tick", t: 1000 + COACH_CONFIG.verdictGoodMs - 100 }, knee, { llmEnabled: false }).state;
  assert.ok(early.verdict);
  assert.equal(reduceCoach(s, { type: "tick", t: 1000 + COACH_CONFIG.verdictGoodMs + 100 }, knee, { llmEnabled: false }).state.verdict, null);
});

// ── Through the real engine and coach ─────────────────────────────────────────────────────────────

test("good, good, flagged: the stage reads NOT COUNTED with the one fix, and the count stays at 2 of 8", () => {
  const rep = replayUntil("seated-knee-extension", repPlanSession(MIXED_PLAN), LEAD_MS + 12_400, 8);
  assert.equal(rep.ui.counted, 2);
  assert.equal(rep.ui.stage.kind, "not_counted");
  assert.equal(rep.ui.stage.word, "NOT COUNTED");
  assert.equal(rep.ui.stage.instruction, "Sit tall");
  assert.equal(rep.ui.stage.glyph, "cross");
});

test("then the next good rep reads NICE CORRECTION: the loop closes with the proof", () => {
  const rep = replayUntil("seated-knee-extension", repPlanSession(MIXED_PLAN), LEAD_MS + 16_900, 8);
  assert.equal(rep.ui.counted, 3);
  assert.equal(rep.ui.stage.kind, "corrected");
  assert.equal(rep.ui.stage.word, "NICE CORRECTION");
});
