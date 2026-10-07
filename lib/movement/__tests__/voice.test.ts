import test from "node:test";
import assert from "node:assert/strict";
import { createCoachState, reduceCoach, type CoachEffect, type CoachInput, type CoachState } from "../coach/coachState";
import { COACH_CONFIG } from "../coach/config";
import { getMovementTemplate } from "../template/registry";
import { DEFAULT_VOICE_SETTINGS, normalizeVoiceSettings, VOICE_RATE_RANGE } from "@/lib/preferences";
import type { MovementEvent } from "../types";

const knee = getMovementTemplate("seated-knee-extension")!;
const OPTS = { llmEnabled: false };

const rest = (t: number): MovementEvent => ({ type: "phase_changed", t, phase: "rest", rep: 0 });
const repEvent = (t: number, rep: number, over: Partial<Extract<MovementEvent, { type: "rep_completed" }>> = {}): MovementEvent => ({
  type: "rep_completed",
  t,
  rep,
  valid: true,
  reasons: [],
  rom: 80,
  durationMs: 4000,
  confidence: 0.95,
  ...over,
});

const spoken = (fx: CoachEffect[]) => fx.filter((e): e is Extract<CoachEffect, { kind: "speak" }> => e.kind === "speak").map((e) => e.text);

/** Plays `n` good reps, one every 8 s, each ending at rest. Returns what was spoken after each rep. */
function playSet(opts: { target: number; before?: number; roms?: number[]; valid?: (rep: number) => boolean; start?: CoachState }) {
  let s = opts.start ?? createCoachState(knee);
  const first = reduceCoach(s, { type: "set_started", t: 0, set: 1, targetReps: opts.target, repsBefore: opts.before ?? 0 }, knee, OPTS);
  s = first.state;
  const perRep: string[][] = [];
  let goodSoFar = 0;
  for (let n = 1; n <= opts.target; n++) {
    const t = 8000 * n;
    const out: string[] = [];
    const good = opts.valid ? opts.valid(n) : true;
    // Since engine v4 an attempt that did not count arrives as its own event and never raises the good-rep number.
    const attempt: MovementEvent = good ? repEvent(t, ++goodSoFar, { rom: opts.roms?.[n - 1] ?? 80 }) : { type: "rep_not_counted", t, rep: goodSoFar, reasons: ["trunk_lean"], rom: 80, durationMs: 4000, confidence: 0.95 };
    for (const i of [attempt, rest(t + 50), { type: "tick", t: t + 600 } as CoachInput]) {
      const r = reduceCoach(s, i, knee, OPTS);
      s = r.state;
      out.push(...spoken(r.effects));
    }
    perRep.push(out);
  }
  return { perRep, state: s };
}

// ── Settings ───────────────────────────────────────────────────────────────────

test("voice settings: defaults are gentle (slower than normal, full volume, captions off)", () => {
  assert.deepEqual(normalizeVoiceSettings(null), DEFAULT_VOICE_SETTINGS);
  assert.ok(DEFAULT_VOICE_SETTINGS.rate < 1);
  assert.equal(DEFAULT_VOICE_SETTINGS.captions, false);
});

test("voice settings: stored or typed values are clamped, and nonsense falls back to the default", () => {
  const s = normalizeVoiceSettings({ volume: 7, rate: 0.1, voiceURI: "x".repeat(500), captions: "yes" });
  assert.equal(s.volume, 1);
  assert.equal(s.rate, VOICE_RATE_RANGE.min);
  assert.equal(s.voiceURI, null, "an implausible voice id is dropped");
  assert.equal(s.captions, false, "only a real boolean turns captions on");
  const t = normalizeVoiceSettings({ volume: -2, rate: 9, voiceURI: "com.apple.voice.compact.en-GB.Daniel", captions: true });
  assert.deepEqual([t.volume, t.rate, t.voiceURI, t.captions], [0, VOICE_RATE_RANGE.max, "com.apple.voice.compact.en-GB.Daniel", true]);
  assert.equal(normalizeVoiceSettings({ volume: "abc" }).volume, 1);
});

// ── Milestones: calm, not every rep ────────────────────────────────────────────

test("a 10-rep set is spoken to only on a few reps, never every one", () => {
  const { perRep } = playSet({ target: 10 });
  const talked = perRep.map((l, i) => (l.length ? i + 1 : 0)).filter(Boolean);
  assert.deepEqual(talked, [1, 3, 5, 6, 8, 9], "first rep, an occasional nod, 5 done, then the last two");
  assert.ok(perRep.every((l) => l.length <= 1), "never more than one line for a rep");
  assert.equal(perRep[0][0], "Great start.");
  assert.match(perRep[4][0], /^5 done\./);
  assert.equal(perRep[7][0], "Two more to go.");
  assert.equal(perRep[8][0], "One more.");
  assert.equal(perRep[9].length, 0, "the last rep is left to the set-complete line");
});

test("milestones count the whole set, not just this chunk: 8 saved + 2 more reaches 10", () => {
  const { perRep } = playSet({ target: 7, before: 8 });
  // chunk reps 1..7 are set reps 9..15: 10 and 15 are multiples of five, 14 and 13 are the last two.
  assert.match(perRep[1][0] ?? "", /^10 done\./);
  assert.equal(perRep[5][0], "One more.", "14 of 15");
  assert.equal(perRep[6].length, 0, "15 of 15 is the set-complete moment");
});

test("the first-rep line comes only after a good rep, and only once", () => {
  const { perRep } = playSet({ target: 6, valid: (n) => n !== 1 });
  assert.ok(!perRep[0].includes("Great start."), "a first attempt that did not count is not praised");
  assert.ok(perRep[0].some((t) => /counted/i.test(t)), "it is said, plainly, that it was not counted");
  assert.equal(perRep[1][0], "Great start.", "the first GOOD rep is");
  assert.ok(!perRep.slice(2).flat().includes("Great start."));
});

test("no encouragement is spoken while a problem is active", () => {
  let s = createCoachState(knee);
  s = reduceCoach(s, { type: "set_started", t: 0, set: 1, targetReps: 10, repsBefore: 0 }, knee, OPTS).state;
  const err: MovementEvent = { type: "movement_error", t: 1000, exercise: knee.id, phase: "peak", joint: "shoulder", error: "trunk_lean", severity: "major", direction: "high", measured: 30, expected: 18, confidence: 0.95, rep: 1, oneShot: false };
  s = reduceCoach(s, err, knee, OPTS).state;
  const out = [repEvent(9000, 5), rest(9050), { type: "tick", t: 9600 } as CoachInput].flatMap((i) => {
    const r = reduceCoach(s, i, knee, OPTS);
    s = r.state;
    return spoken(r.effects);
  });
  assert.ok(!out.some((t) => /done|more|start|nice/i.test(t)), `spoke: ${out.join(" | ")}`);
});

test("nothing is spoken while the person is mid-movement; it waits for the rest", () => {
  let s = createCoachState(knee);
  s = reduceCoach(s, { type: "set_started", t: 0, set: 1, targetReps: 10, repsBefore: 0 }, knee, OPTS).state;
  s = reduceCoach(s, { type: "phase_changed", t: 7000, phase: "back", rep: 4 }, knee, OPTS).state;
  const during = reduceCoach(s, repEvent(8000, 5), knee, OPTS);
  assert.equal(spoken(during.effects).length, 0, "5 done is held while still moving");
  const after = reduceCoach(during.state, rest(8100), knee, OPTS);
  assert.match(spoken(after.effects)[0] ?? "", /^5 done\./, "and said when the movement settles");
});

// ── Pacing ─────────────────────────────────────────────────────────────────────

test("when the last reps are clearly smaller, it says so objectively, once, and never says tired", () => {
  const { perRep } = playSet({ target: 8, roms: [80, 82, 78, 76, 70, 66, 52, 50] });
  const all = perRep.flat();
  const notes = all.filter((t) => /smaller/.test(t));
  assert.deepEqual(notes, ["Your last few movements have been smaller. Take a short rest if you need one."]);
  assert.doesNotMatch(all.join(" "), /tired|fatigue|weak|hurt|pain|exhaust/i);
});

test("steady range produces no pacing note, and a drop needs enough reps to compare", () => {
  const steady = playSet({ target: 10, roms: [80, 79, 81, 80, 78, 80, 79, 80, 81, 80] }).perRep.flat();
  assert.ok(!steady.some((t) => /smaller/.test(t)));
  const few = playSet({ target: 5, roms: [80, 80, 80, 40, 40] }).perRep.flat();
  assert.ok(!few.some((t) => /smaller/.test(t)), "fewer than the minimum reps: no comparison");
  assert.ok(COACH_CONFIG.paceMinReps >= 6);
});

test("the pacing note is a cue on screen as well, so it works with the voice off", () => {
  let s = createCoachState(knee);
  s = reduceCoach(s, { type: "set_started", t: 0, set: 1, targetReps: 8, repsBefore: 0 }, knee, OPTS).state;
  let cue = "";
  [80, 80, 80, 70, 50, 48].forEach((rom, i) => {
    const t = 8000 * (i + 1);
    for (const e of [repEvent(t, i + 1, { rom }), rest(t + 50)]) {
      const r = reduceCoach(s, e, knee, OPTS);
      s = r.state;
      for (const fx of r.effects) if (fx.kind === "cue" && /smaller/.test(fx.cue.text)) cue = fx.cue.text;
    }
  });
  assert.match(cue, /smaller/);
});

// ── Set complete ───────────────────────────────────────────────────────────────

test("set complete is said differently for each set, and always offers rest without pressure", () => {
  const lines = [1, 2, 3].map((set) => {
    const s = createCoachState(knee, { set });
    return spoken(reduceCoach(s, { type: "set_complete", t: 1000 }, knee, OPTS).effects)[0];
  });
  assert.equal(new Set(lines).size, 3);
  for (const l of lines) assert.match(l, /complete|well done/i);
  assert.doesNotMatch(lines.join(" "), /hurry|quick|fast|faster/i);
});

test("a tick long after a cue appeared clears it without throwing (resuming after a pause)", () => {
  let s = createCoachState(knee);
  s = reduceCoach(s, { type: "set_started", t: 0, set: 1, targetReps: 10, repsBefore: 0 }, knee, OPTS).state;
  s = reduceCoach(s, repEvent(1000, 1), knee, OPTS).state;
  assert.ok(s.cue, "a cue is showing");
  const later = reduceCoach(s, { type: "tick", t: 600_000 }, knee, OPTS);
  assert.equal(later.state.cue, null);
  assert.ok(later.effects.some((e) => e.kind === "clear_cue"));
  // The same for the "ready, begin when you are ready" cue.
  const ready = reduceCoach(createCoachState(knee), { type: "setup_ready", t: 0 }, knee, OPTS).state;
  assert.doesNotThrow(() => reduceCoach(ready, { type: "tick", t: 600_000 }, knee, OPTS));
});
