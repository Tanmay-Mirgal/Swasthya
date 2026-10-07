import test from "node:test";
import assert from "node:assert/strict";
import { localizeMovementUi } from "./coachUi";
import { localizeShown } from "./spoken";
import { initialUi, type MovementUi } from "@/lib/movement/ui/movementUi";
import { getAllMovementTemplates, getMovementTemplate } from "@/lib/movement/template/registry";

const template = getMovementTemplate("seated-knee-extension")!;
const base = (patch: Partial<MovementUi> = {}): MovementUi => ({ ...initialUi(template, 8), ...patch });

test("English is returned as the very same object: nothing is copied while the default language is in use", () => {
  const ui = base({ cue: "Sit tall." });
  assert.equal(localizeMovementUi(ui, "en"), ui);
});

test("the cue, the verdict and the camera advice are shown in the chosen language, the same words the voice uses", () => {
  const ui = base({
    cue: "Sit tall.",
    verdict: { kind: "not_counted", seq: 3, at: 0, show: "Sit tall", say: "Not counted. Sit tall." },
    advice: { code: "too_close", message: "Move back a little." },
  });
  const hi = localizeMovementUi(ui, "hi");
  assert.equal(hi.cue, "सीधे बैठिए।");
  assert.equal(hi.verdict?.say, "गिना नहीं गया। सीधे बैठिए।");
  assert.equal(hi.verdict?.show, "सीधे बैठिए।");
  assert.equal(hi.advice?.message, "थोड़ा पीछे हटिए।");
  const mr = localizeMovementUi(ui, "mr");
  assert.equal(mr.cue, "ताठ बसा.");
  assert.equal(mr.verdict?.say, "मोजले गेले नाही. ताठ बसा.");
  // what it shows is exactly what would be spoken
  assert.equal(hi.verdict?.say, localizeShown(ui.verdict!.say!, "hi"));
});

test("nothing but wording changes: counts, phase, joints and codes are untouched", () => {
  const ui = base({ counted: 4, valid: 3, invalid: 1, phase: "peak", cueCode: "trunk_lean", advice: { code: "cut_off", message: "Keep your full body inside the frame.", joint: "knee" } });
  const hi = localizeMovementUi(ui, "hi");
  assert.equal(hi.counted, 4);
  assert.equal(hi.valid, 3);
  assert.equal(hi.phase, "peak");
  assert.equal(hi.cueCode, "trunk_lean");
  assert.equal(hi.advice?.code, "cut_off");
  assert.equal(hi.advice?.joint, "knee");
  assert.deepEqual(hi.joints, ui.joints);
});

test("a line with no reviewed translation stays whole in English, and no verdict or advice stays absent", () => {
  const hi = localizeMovementUi(base({ cue: "Wiggle your ears.", verdict: null, advice: null }), "hi");
  assert.equal(hi.cue, "Wiggle your ears.");
  assert.equal(hi.verdict, null);
  assert.equal(hi.advice, null);
});

test("the default cue of every exercise, in every phase, is shown in Hindi and Marathi", () => {
  const bad: string[] = [];
  for (const t of getAllMovementTemplates()) {
    for (const cue of [t.setup.instruction, ...Object.values(t.phaseCues)]) {
      for (const lang of ["hi", "mr"] as const) {
        const shown = localizeMovementUi({ ...initialUi(t, 8), cue }, lang).cue;
        if (!/[ऀ-ॿ]/.test(shown) || /[A-Za-z]/.test(shown)) bad.push(`${t.id} [${lang}]: ${cue}`);
      }
    }
  }
  assert.deepEqual(bad, []);
});
