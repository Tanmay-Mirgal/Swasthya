import test from "node:test";
import assert from "node:assert/strict";
import { localizeSpoken, splitSentences, CATALOGUE_SIZE } from "./spoken";
import { SYSTEM_ENTRIES, TEMPLATE_ENTRIES } from "./spoken/entries";
import { createCoachState, reduceCoach, type CoachInput } from "@/lib/movement/coach/coachState";
import { getAllMovementTemplates } from "@/lib/movement/template/registry";
import { describeRef } from "@/lib/movement/landmarks";
import type { MovementTemplate } from "@/lib/movement/template/schema";
import type { MovementEvent } from "@/lib/movement/types";
import { evaluateSet, type SetFacts } from "@/lib/rehab/milestones";

const LANGS = ["hi", "mr"] as const;
const templates = [...getAllMovementTemplates()];
const OPTS = { llmEnabled: false };

const sentencesOf = (t: MovementTemplate): string[] => {
  const rules = [...t.rules, ...Object.values(t.repRules).filter(Boolean)] as { low?: { texts: string[]; show: string }; high?: { texts: string[]; show: string }; ack?: string }[];
  const out: string[] = [];
  for (const r of rules) {
    for (const m of [r.low, r.high]) if (m) out.push(...m.texts, m.show);
    if (r.ack) out.push(r.ack);
  }
  return out.flatMap(splitSentences);
};

test("every sentence in every exercise template can be spoken in Hindi and Marathi", () => {
  const missing: string[] = [];
  for (const t of templates) {
    for (const s of sentencesOf(t)) for (const lang of LANGS) if (localizeSpoken(`${s}.`, lang) === null) missing.push(`${t.id} [${lang}]: ${s}`);
  }
  assert.deepEqual(missing, [], "add these to lib/i18n/spoken/entries.ts (and have them reviewed)");
});

/** Plays one scenario through the real coach, far apart in time so cooldowns never hide a line, and returns everything it said. */
function spokenIn(t: MovementTemplate, events: MovementEvent[], opts: { set?: number } = {}): string[] {
  let s = createCoachState(t, { set: opts.set });
  const said: string[] = [];
  const feed = (i: CoachInput) => {
    const r = reduceCoach(s, i, t, OPTS);
    s = r.state;
    for (const fx of r.effects) if (fx.kind === "speak") said.push(fx.text);
  };
  feed({ type: "set_started", t: 0, set: opts.set ?? 1, targetReps: 40, repsBefore: 0 });
  let now = 10_000;
  for (const e of events) {
    feed({ ...e, t: now } as CoachInput);
    feed({ type: "phase_changed", t: now + 50, phase: "rest", rep: 0 });
    feed({ type: "tick", t: now + 700 });
    now += 40_000;
  }
  return said;
}

test("everything the coach says in a session is covered, so no line falls back to English by accident", () => {
  const spoken = new Set<string>();
  for (const t of templates) {
    const ids = [...t.rules.map((r) => r.id), ...Object.values(t.repRules).filter(Boolean).map((r) => (r as { id: string }).id)];
    const events: MovementEvent[] = [{ type: "setup_ready", t: 0 }];
    for (const code of ids) {
      for (const direction of ["low", "high"] as const) {
        events.push({ type: "movement_error", t: 0, exercise: t.id, phase: "peak", joint: "knee", error: code, severity: "major", direction, measured: 1, expected: 2, confidence: 0.9, rep: 1, oneShot: false });
        events.push({ type: "rep_not_counted", t: 0, reasons: [code], rom: 50, durationMs: 3000, confidence: 0.9, rep: 0 });
        events.push({ type: "movement_corrected", t: 0, error: code, joint: "knee", afterMs: 2000, rep: 1 });
        events.push({ type: "movement_corrected", t: 0, error: code, joint: "knee", afterMs: 2000, rep: 2 });
      }
    }
    events.push({ type: "partial_rep", t: 0, reached: 0.8, almost: true }, { type: "partial_rep", t: 0, reached: 0.3 }, { type: "uncertain_rep", t: 0, reached: 0.5, reason: "dropout" });
    for (let n = 1; n <= 40; n++) events.push({ type: "rep_completed", t: 0, rep: n, valid: true, reasons: [], rom: 80, durationMs: 4000, confidence: 0.95 });
    for (let n = 0; n < 8; n++) events.push({ type: "rep_not_counted", t: 0, reasons: [], rom: 50, durationMs: 3000, confidence: 0.9, rep: 0 }); // long run: the gentle limits
    for (const line of spokenIn(t, events)) spoken.add(line);
    for (const set of [1, 2, 3]) {
      let s = createCoachState(t, { set });
      for (const fx of reduceCoach(s, { type: "set_complete", t: 1000 }, t, OPTS).effects) if (fx.kind === "speak") spoken.add(fx.text);
      s = createCoachState(t);
    }
  }
  for (const line of ["Today’s routine is complete. Well done.", "Exercise complete. Well done.", "Three", "Two", "One", "Begin."]) spoken.add(line);
  assert.ok(spoken.size > 80, `the scenarios should exercise many lines (${spoken.size})`);
  const missing = [...spoken].filter((line) => LANGS.some((l) => localizeSpoken(line, l) === null));
  assert.deepEqual(missing, []);
});

test("the cue shown while nothing needs correcting (set-up instruction and each phase's cue) is covered for every exercise", () => {
  const missing: string[] = [];
  for (const t of templates) {
    for (const line of [t.setup.instruction, ...Object.values(t.phaseCues)]) for (const lang of LANGS) if (localizeSpoken(line, lang) === null) missing.push(`${t.id} [${lang}]: ${line}`);
  }
  assert.deepEqual(missing, []);
});

test("camera advice that names a joint or a stretch of body is covered for every exercise", () => {
  const missing: string[] = [];
  for (const t of templates) {
    const names = new Set<string>();
    for (const ref of t.landmarks.required) for (const side of ["left", "right"] as const) names.add(describeRef(ref, side));
    const lines = [
      ...[...names].flatMap((n) => [`Your ${n} is at the edge of the frame. Move back a little.`, `I can't clearly see your ${n}. Check nothing is blocking it.`]),
      `I can't see you clearly. Improve the lighting and keep your whole ${t.camera.segmentWord} in view.`,
      "Keep your full body inside the frame.",
      "I can't see you. Step into the frame.",
    ];
    for (const line of lines) for (const lang of LANGS) if (localizeSpoken(line, lang) === null) missing.push(`${t.id} [${lang}]: ${line}`);
  }
  assert.deepEqual(missing, []);
});

test("a verdict is spoken as it is written: each sentence translated, in order, with the language's own full stop", () => {
  assert.equal(localizeSpoken("Not counted. Sit tall.", "hi"), "गिना नहीं गया। सीधे बैठिए।");
  assert.equal(localizeSpoken("Not counted. Sit tall.", "mr"), "मोजले गेले नाही. ताठ बसा.");
  assert.equal(localizeSpoken("That one wasn’t counted. A little farther.", "hi"), "वह वाला नहीं गिना गया। थोड़ा और आगे।", "typographic apostrophes are understood");
});

test("numbers and slots: milestones, body parts, and agreement in gender", () => {
  assert.equal(localizeSpoken("5 done. Nice and steady.", "hi"), "5 पूरे। बढ़िया और स्थिर।");
  assert.equal(localizeSpoken("Your left knee is at the edge of the frame. Move back a little.", "hi"), "आपका बायाँ घुटना फ्रेम के किनारे पर है। थोड़ा पीछे हटिए।");
  assert.equal(localizeSpoken("I can't clearly see your right elbow. Check nothing is blocking it.", "hi"), "आपकी दाईं कोहनी साफ़ दिखाई नहीं दे रही। देखिए कि बीच में कोई रुकावट तो नहीं है।", "a feminine noun takes feminine forms");
  assert.equal(localizeSpoken("I can't clearly see your left knee. Check nothing is blocking it.", "mr"), "तुमचा डावा गुडघा नीट दिसत नाही. मध्ये काही अडथळा नाही ना ते पाहा.");
  assert.equal(localizeSpoken("You fixed 2 things as you went.", "mr"), "करताना तुम्ही 2 गोष्टी सुधारल्या.");
});

test("a line with any untranslated sentence is left whole (null), never half-translated", () => {
  assert.equal(localizeSpoken("Sit tall. Wiggle your ears.", "hi"), null);
  assert.equal(localizeSpoken("Your toe is at the edge of the frame.", "hi"), null);
  assert.equal(localizeSpoken("", "hi"), null);
});

test("English is returned untouched", () => {
  assert.equal(localizeSpoken("Not counted. Sit tall.", "en"), "Not counted. Sit tall.");
});

test("translations are written in the target script, are never empty, and carry no stray English", () => {
  const bad: string[] = [];
  for (const [en, hi, mr] of [...SYSTEM_ENTRIES, ...TEMPLATE_ENTRIES]) {
    for (const [lang, text] of [["hi", hi], ["mr", mr]] as const) {
      if (!text.trim()) bad.push(`${lang} empty: ${en}`);
      else if (/[A-Za-z]/.test(text)) bad.push(`${lang} has Latin letters: ${en}`);
      else if (!/[ऀ-ॿ]/.test(text)) bad.push(`${lang} not Devanagari: ${en}`);
      else if (/[.!?।]$/.test(text.trim())) bad.push(`${lang} ends with punctuation (the speaker adds it): ${en}`);
    }
    if (/[.!?]$/.test(en)) bad.push(`English key ends with punctuation: ${en}`);
  }
  assert.deepEqual(bad, []);
});

test("no sentence is defined twice with different meanings", () => {
  const seen = new Map<string, string>();
  const clash: string[] = [];
  for (const [en, hi] of [...SYSTEM_ENTRIES, ...TEMPLATE_ENTRIES]) {
    const prior = seen.get(en);
    if (prior !== undefined && prior !== hi) clash.push(en);
    seen.set(en, hi);
  }
  assert.deepEqual(clash, []);
  assert.equal(CATALOGUE_SIZE.hi, CATALOGUE_SIZE.mr);
});

test("every milestone line the app can announce is covered, in both languages", () => {
  const all: SetFacts = { setNumber: 2, totalSets: 3, exerciseComplete: false, judged: true, goodOnly: true, good: 12, invalid: 0, partial: 0, rom: 99, romUnit: "deg", targetRom: 90, personalBest: { rom: 70, unit: "deg" }, correctionsSucceeded: 1 };
  const lines = new Set<string>();
  for (const f of [all, { ...all, goodOnly: false }, { ...all, correctionsSucceeded: 2 }, { ...all, correctionsSucceeded: 7 }, { ...all, setNumber: 3, exerciseComplete: true, routineComplete: true }]) {
    for (const m of evaluateSet(f).milestones) lines.add(m.spoken);
  }
  assert.ok(lines.size >= 8, `expected every kind of milestone to be exercised (${[...lines].join(" | ")})`);
  const missing = [...lines].filter((l) => LANGS.some((lang) => localizeSpoken(l, lang) === null));
  assert.deepEqual(missing, []);
});
