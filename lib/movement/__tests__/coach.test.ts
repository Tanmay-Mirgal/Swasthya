import test from "node:test";
import assert from "node:assert/strict";
import { COACH_CONFIG } from "../coach/config";
import { cleanCue, sanitiseQuoted } from "../coach/cueValidation";
import { decideSpeech, initialVoiceState, type SpeechCandidate } from "../coach/voicePolicy";
import { COACH_GRAPH, createCoachState, defaultCue, reduceCoach, type CoachEffect, type CoachInput, type CoachState } from "../coach/coachState";
import { buildCueRequest, requestCoachCue, type Fetcher } from "../coach/llm";
import { ackFor, textFor } from "../coach/messages";
import { getAllMovementTemplates, getMovementTemplate } from "../template/registry";
import type { MovementEvent } from "../types";

const knee = getMovementTemplate("seated-knee-extension")!;

// ── Voice policy ───────────────────────────────────────────────────────────────

const cand = (over: Partial<SpeechCandidate> = {}): SpeechCandidate => ({ key: "err:trunk_lean", text: "Sit tall.", kind: "error", priority: 2, phase: "peak", ...over });

test("voice: the first cue is spoken", () => {
  const d = decideSpeech(initialVoiceState(), cand(), 1000);
  assert.equal(d.speak, true);
});

test("voice: the same problem is silent until its cooldown passes, then spoken again", () => {
  let v = initialVoiceState();
  const first = decideSpeech(v, cand(), 0);
  v = first.next;
  assert.equal(decideSpeech(v, cand({ text: "Keep your back upright." }), 5000).speak, false);
  assert.equal(decideSpeech(v, cand({ text: "Keep your back upright." }), 5000).reason, "cooldown");
  assert.equal(decideSpeech(v, cand({ text: "Keep your back upright." }), COACH_CONFIG.voiceRepeatCooldownMs + 1).speak, true);
});

test("voice: identical text is never repeated inside the duplicate window", () => {
  const v = decideSpeech(initialVoiceState(), cand({ key: "a" }), 0).next;
  const d = decideSpeech(v, cand({ key: "b" }), 20_000);
  assert.equal(d.speak, false);
  assert.equal(d.reason, "duplicate");
});

test("voice: a minimum gap separates different cues; a clearly more important one may interrupt", () => {
  const v = decideSpeech(initialVoiceState(), cand({ key: "x", priority: 5, text: "Slow down." }), 0).next;
  const low = decideSpeech(v, cand({ key: "y", priority: 5, text: "Straighten more." }), 1500);
  assert.equal(low.speak, false);
  assert.equal(low.defer, true);
  const urgent = decideSpeech(v, cand({ key: "z", priority: 2, text: "Sit tall." }), 1500);
  assert.equal(urgent.speak, true);
  assert.equal(urgent.interrupt, true);
  assert.equal(decideSpeech(v, cand({ key: "y", priority: 5, text: "Straighten more." }), 3000).speak, true);
});

test("voice: non-urgent corrections wait for a quiet moment, urgent ones do not", () => {
  const minor = decideSpeech(initialVoiceState(), cand({ priority: 5, phase: "out" }), 0);
  assert.equal(minor.speak, false);
  assert.equal(minor.defer, true);
  assert.equal(minor.reason, "movement");
  assert.equal(decideSpeech(initialVoiceState(), cand({ priority: 2, phase: "out" }), 0).speak, true);
  assert.equal(decideSpeech(initialVoiceState(), cand({ priority: 5, phase: "peak" }), 0).speak, true);
});

test("voice: camera guidance repeats rarely, acknowledgements come quickly", () => {
  let v = decideSpeech(initialVoiceState(), cand({ key: "camera:too_close", kind: "camera", priority: 1, text: "Move slightly backward." }), 0).next;
  assert.equal(decideSpeech(v, cand({ key: "camera:too_close", kind: "camera", priority: 1, text: "Move back a little." }), 5000).speak, false);
  assert.equal(decideSpeech(v, cand({ key: "camera:too_close", kind: "camera", priority: 1, text: "Move back a little." }), COACH_CONFIG.voiceCameraCooldownMs + 1).speak, true);
  v = decideSpeech(initialVoiceState(), cand({ text: "Sit tall." }), 0).next;
  assert.equal(decideSpeech(v, cand({ key: "ack:trunk_lean", kind: "ack", priority: 8, text: "Good correction." }), 1300).speak, true);
});

// ── Cue validation ─────────────────────────────────────────────────────────────

test("cleanCue accepts a short plain cue and tidies it", () => {
  assert.equal(cleanCue('"Keep your knee over your foot"'), "Keep your knee over your foot.");
  assert.equal(cleanCue("Coach: Lower your hips a little further."), "Lower your hips a little further.");
});

test("cleanCue rejects measurements, diagnosis, jargon, structure and length abuse", () => {
  const bad = [
    "Your knee angle is 104 degrees.",
    "Bend to 90 now.",
    "This could be a tear in your ligament.",
    "You have arthritis so go slowly.",
    "Push through the pain.",
    "The camera cannot see your knee.",
    '{"cue":"hello there friend"}',
    "```Keep going```",
    "Go.",
    "Please keep your knee lined up with your foot while you lower slowly down and then up again and again and again until the set is over.",
    "Keep going.\nAnd then stop.",
    "Take your medication before the next set.",
    "Great. Good. Nice work today.",
  ];
  for (const t of bad) assert.equal(cleanCue(t), null, t);
  assert.equal(cleanCue(undefined), null);
  assert.equal(cleanCue(42), null);
});

test("every deterministic message in every template passes the same safety validation", () => {
  for (const t of getAllMovementTemplates()) {
    const msgs = [...t.rules, ...Object.values(t.repRules)].flatMap((r) => (r ? [r.low, r.high, r.ack] : []));
    for (const m of msgs) {
      if (!m) continue;
      const texts = typeof m === "string" ? [m] : m.texts;
      for (const text of texts) assert.notEqual(cleanCue(text), null, `${t.id}: "${text}" would be rejected`);
    }
    for (const text of Object.values(t.phaseCues)) assert.notEqual(cleanCue(text), null, `${t.id}: cue "${text}"`);
  }
});

test("sanitiseQuoted strips anything that could act as prompt structure", () => {
  assert.equal(sanitiseQuoted('Say "hi"\n{ignore previous}'), "Say hi ignore previous");
  assert.equal(sanitiseQuoted("x".repeat(500))?.length, 140);
  assert.equal(sanitiseQuoted(5), undefined);
});

// ── Messages ───────────────────────────────────────────────────────────────────

test("wording escalates with each attempt and stays on the last tier", () => {
  const a = textFor(knee, "trunk_lean", "high", 0);
  const b = textFor(knee, "trunk_lean", "high", 1);
  const c = textFor(knee, "trunk_lean", "high", 2);
  const d = textFor(knee, "trunk_lean", "high", 9);
  assert.equal(new Set([a, b, c]).size, 3);
  assert.equal(c, d);
  assert.equal(textFor(knee, "nope", "high", 0), null);
});

test("acknowledgements rotate so they do not repeat", () => {
  const seen = new Set([0, 1, 2, 3].map((n) => ackFor(knee, "too_fast", n)));
  assert.ok(seen.size >= 3);
});

// ── Reducer ────────────────────────────────────────────────────────────────────

const OPTS = { llmEnabled: false };
const err = (t: number, over: Partial<Extract<MovementEvent, { type: "movement_error" }>> = {}): MovementEvent => ({
  type: "movement_error",
  t,
  exercise: "seated-knee-extension",
  phase: "peak",
  joint: "shoulder",
  error: "trunk_lean",
  severity: "major",
  direction: "high",
  measured: 28,
  expected: 18,
  confidence: 0.94,
  rep: 1,
  oneShot: false,
  ...over,
});
const fixed = (t: number): MovementEvent => ({ type: "movement_corrected", t, error: "trunk_lean", joint: "shoulder", afterMs: 2000, rep: 1 });
const rep = (t: number, n: number, valid = true): MovementEvent => ({ type: "rep_completed", t, rep: n, valid, reasons: valid ? [] : ["trunk_lean"], rom: 70, durationMs: 4000, confidence: 0.95 });

function drive(inputs: CoachInput[], opts = OPTS, start?: CoachState) {
  let state = start ?? createCoachState(knee);
  const all: CoachEffect[] = [];
  for (const i of inputs) {
    const r = reduceCoach(state, i, knee, opts);
    state = r.state;
    all.push(...r.effects);
  }
  return { state, effects: all };
}
const spoken = (fx: CoachEffect[]) => fx.filter((e): e is Extract<CoachEffect, { kind: "speak" }> => e.kind === "speak").map((e) => e.text);
const cues = (fx: CoachEffect[]) => fx.filter((e): e is Extract<CoachEffect, { kind: "cue" }> => e.kind === "cue").map((e) => e.cue);

test("coach graph has no dangling nodes", () => {
  for (const [node, edges] of Object.entries(COACH_GRAPH)) for (const e of edges) assert.ok(e in COACH_GRAPH || e === "awaitEvent", `${node} -> ${e}`);
});

test("a confirmed error produces one cue, spoken once: what, where and how", () => {
  const { effects, state } = drive([{ type: "phase_changed", t: 900, phase: "peak", rep: 0 }, err(1000)]);
  assert.equal(cues(effects).length, 1);
  assert.equal(cues(effects)[0].tone, "correction");
  assert.match(cues(effects)[0].text, /back/i);
  assert.equal(spoken(effects).length, 1);
  assert.deepEqual(state.currentErrors, ["trunk_lean"]);
  assert.equal(state.correctionStatus, "pending");
});

test("the same error persisting is silent frame after frame, then escalates after the cooldown", () => {
  const inputs: CoachInput[] = [{ type: "phase_changed", t: 900, phase: "peak", rep: 0 }, err(1000)];
  for (let t = 1500; t <= 11_500; t += 500) inputs.push({ type: "tick", t });
  const quiet = drive(inputs);
  assert.equal(spoken(quiet.effects).length, 1, "silence while the cooldown runs");

  const more: CoachInput[] = [...inputs];
  for (let t = 12_000; t <= 60_000; t += 500) more.push({ type: "tick", t });
  const long = drive(more);
  const said = spoken(long.effects);
  assert.ok(said.length >= 3, `escalated: ${said.length}`);
  assert.equal(new Set(said.slice(0, 3)).size, 3, "three different wordings, not the same sentence repeated");
  assert.ok(said.length <= 6, "still sparse: no machine-gun repetition");
  assert.equal(long.state.correctionStatus, "persisting");
});

test("correcting the movement is acknowledged once, and only if the patient was coached", () => {
  const coached = drive([{ type: "phase_changed", t: 900, phase: "peak", rep: 0 }, err(1000), fixed(5000)]);
  const ack = cues(coached.effects).at(-1)!;
  assert.equal(ack.tone, "praise");
  assert.match(spoken(coached.effects).at(-1)!, /correction|better|steady|keep/i);
  assert.deepEqual(coached.state.currentErrors, []);
  assert.equal(coached.state.sessionMetrics.corrections.succeeded, 1);

  // A problem the patient never heard about is not praised.
  const silent = drive([fixed(5000)], OPTS, { ...createCoachState(knee), issues: { trunk_lean: { code: "trunk_lean", direction: "high", severity: "major", occurrences: 1, attempts: 0, tier: 0, active: true, lastCoachedAt: -Infinity, lastText: "", correctedCount: 0, repsAffected: [], llmPending: false, observed: false } } });
  assert.equal(silent.effects.filter((e) => e.kind === "speak" || e.kind === "cue").length, 0);
});

test("a camera problem outranks a form problem and blocks it from replacing the cue", () => {
  const { effects, state } = drive([
    { type: "camera_issue", t: 1000, advice: { code: "too_close", message: "Move slightly backward." } },
    err(1500),
  ]);
  assert.equal(state.cue?.tone, "camera");
  assert.deepEqual(spoken(effects), ["Move slightly backward."]);
  assert.equal(defaultCue(knee, state), "Move slightly backward.");
});

test("camera guidance clears when the camera recovers", () => {
  const { state, effects } = drive([{ type: "camera_issue", t: 1000, advice: { code: "cut_off", message: "Keep your full body inside the frame." } }, { type: "camera_ok", t: 3000 }]);
  assert.equal(state.cue, null);
  assert.ok(effects.some((e) => e.kind === "clear_cue"));
});

test("only the most important problem is coached at a time; the minor one waits", () => {
  const minor = err(1100, { error: "too_fast", severity: "minor", direction: "low", joint: "knee", oneShot: true, phase: "rest" });
  const r1 = drive([{ type: "phase_changed", t: 900, phase: "peak", rep: 0 }, err(1000), minor]);
  assert.equal(cues(r1.effects).length, 1, "minor problem did not replace the major cue");
  assert.equal(r1.state.cue?.code, "trunk_lean");
  // Once the major problem is fixed and its acknowledgement has had its moment, the minor one is coached.
  const inputs: CoachInput[] = [fixed(2000)];
  for (let t = 2500; t <= 12_000; t += 500) inputs.push({ type: "tick", t });
  const r2 = drive(inputs, OPTS, r1.state);
  assert.ok(cues(r2.effects).some((c) => c.code === "too_fast"), "minor correction was coached after the major one cleared");
});

test("persistent errors across reps become a therapist observation, once, with no cause", () => {
  const inputs: CoachInput[] = [{ type: "phase_changed", t: 100, phase: "peak", rep: 0 }];
  for (let n = 1; n <= 4; n++) {
    inputs.push(err(1000 * n, { rep: n }), fixed(1000 * n + 500), rep(1000 * n + 700, n, false));
  }
  const { effects } = drive(inputs);
  const obs = effects.filter((e): e is Extract<CoachEffect, { kind: "observe" }> => e.kind === "observe");
  assert.equal(obs.length, 1);
  assert.equal(obs[0].observation.code, "trunk_lean");
  assert.ok(obs[0].observation.repsAffected >= 3);
  assert.doesNotMatch(JSON.stringify(obs), /cause|because|diagnos/i);
});

test("praise is occasional: a good rep three speaks, others stay quiet, and never while a problem is active", () => {
  const inputs: CoachInput[] = [];
  for (let n = 1; n <= 6; n++) inputs.push(rep(8000 * n, n));
  const { effects } = drive(inputs);
  assert.equal(spoken(effects).length, 2);

  const blocked = drive([err(1000), rep(2000, 3)]);
  assert.ok(!spoken(blocked.effects).some((t) => /nice rep|control|smooth/i.test(t)));
});

test("no model calls when the model is disabled; a prefetch request when enabled", () => {
  const off = drive([err(1000)]);
  assert.equal(off.effects.filter((e) => e.kind === "llm").length, 0);
  const on = drive([err(1000)], { llmEnabled: true });
  const calls = on.effects.filter((e): e is Extract<CoachEffect, { kind: "llm" }> => e.kind === "llm");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].tier, 1, "prefetches wording for the NEXT tier");
  assert.equal(calls[0].request.error.code, "trunk_lean");
});

test("model wording prefetched for the next tier is used on escalation; failure falls back silently", () => {
  const base: CoachInput[] = [{ type: "phase_changed", t: 900, phase: "peak", rep: 0 }, err(1000), { type: "llm_result", t: 1800, code: "trunk_lean", tier: 1, text: "Lift your chest and let your back lengthen." }];
  const ticks: CoachInput[] = [];
  for (let t = 13_500; t <= 14_500; t += 500) ticks.push({ type: "tick", t });
  const ok = drive([...base, ...ticks], { llmEnabled: true });
  assert.ok(spoken(ok.effects).includes("Lift your chest and let your back lengthen."));

  const failed = drive([base[0], base[1], { type: "llm_result", t: 1800, code: "trunk_lean", tier: 1, text: null }, ...ticks], { llmEnabled: true });
  assert.ok(spoken(failed.effects).includes(textFor(knee, "trunk_lean", "high", 1)!));
});

test("model budget: a request is not made while one is pending or inside the minimum gap", () => {
  const minor = (t: number, e: string) => err(t, { error: e, severity: "minor", direction: "low", oneShot: true });
  const { effects } = drive([err(1000), minor(1500, "too_fast"), minor(2000, "insufficient_extension")], { llmEnabled: true });
  assert.ok(effects.filter((e) => e.kind === "llm").length <= 1);
});

test("pausing stops speech and clears anything waiting", () => {
  const { effects, state } = drive([{ type: "paused", t: 1000, paused: true }]);
  assert.ok(effects.some((e) => e.kind === "stop_speech"));
  assert.equal(state.paused, true);
  const ticked = drive([err(2000), { type: "tick", t: 2500 }], OPTS, state);
  assert.equal(spoken(ticked.effects).length, 0, "nothing is spoken while paused");
});

test("a new set keeps what was learned but clears what is active", () => {
  const a = drive([err(1000)]);
  const b = drive([{ type: "set_started", t: 9000, set: 2 }], OPTS, a.state);
  assert.deepEqual(b.state.currentErrors, []);
  assert.equal(b.state.issues["trunk_lean"].attempts, 1);
  assert.equal(b.state.currentSet, 2);
});

// ── Model request and client ──────────────────────────────────────────────────

test("model request holds identifiers and rounded numbers only, never landmarks or frames", () => {
  const s = drive([err(1000, { measured: 27.84321, expected: 18 })]).state;
  const req = buildCueRequest(s, knee, s.issues["trunk_lean"], "HIGH");
  assert.deepEqual(Object.keys(req).sort(), ["attempts", "confidence", "error", "exerciseId", "improving", "phase", "previousCue", "rep", "set", "tier"].sort());
  assert.equal(req.error.measured, 27.8);
  assert.equal(req.error.unit, "deg");
  assert.doesNotMatch(JSON.stringify(req), /landmark|image|video|frame|user|name|email/i);
});

test("improving is derived from stored measurements, not guessed", () => {
  const base = drive([err(1000, { measured: 30 }), fixed(2000), err(9000, { measured: 22, rep: 2 })]).state;
  assert.equal(buildCueRequest(base, knee, base.issues["trunk_lean"], "HIGH").improving, true);
  const worse = drive([err(1000, { measured: 22 }), fixed(2000), err(9000, { measured: 30, rep: 2 })]).state;
  assert.equal(buildCueRequest(worse, knee, worse.issues["trunk_lean"], "HIGH").improving, false);
});

const req = buildCueRequest(drive([err(1000)]).state, knee, drive([err(1000)]).state.issues["trunk_lean"], "HIGH");
const fakeFetch = (impl: (init: Parameters<Fetcher>[1]) => Promise<{ ok: boolean; json: () => Promise<unknown> }>): Fetcher => (_u, init) => impl(init);

test("client returns a validated cue, and null for every failure", async () => {
  const ok = await requestCoachCue(req, { fetcher: fakeFetch(async () => ({ ok: true, json: async () => ({ cue: "Lift your chest a little taller.", fallback: false }) })) });
  assert.equal(ok, "Lift your chest a little taller.");
  const cases: Array<() => Promise<{ ok: boolean; json: () => Promise<unknown> }>> = [
    async () => ({ ok: false, json: async () => ({}) }),
    async () => ({ ok: true, json: async () => ({ cue: null, fallback: true }) }),
    async () => ({ ok: true, json: async () => ({ cue: "Bend to 90 degrees.", fallback: false }) }),
    async () => ({ ok: true, json: async () => { throw new Error("bad json"); } }),
    async () => { throw new Error("offline"); },
  ];
  for (const c of cases) assert.equal(await requestCoachCue(req, { fetcher: fakeFetch(c) }), null);
});

test("client gives up after the timeout instead of hanging the coach", async () => {
  const started = Date.now();
  const out = await requestCoachCue(req, {
    timeoutMs: 60,
    fetcher: fakeFetch((init) => new Promise((_res, rej) => init.signal.addEventListener("abort", () => rej(new Error("aborted"))))),
  });
  assert.equal(out, null);
  assert.ok(Date.now() - started < 500);
});
