import test from "node:test";
import assert from "node:assert/strict";
import { getAllMovementTemplates, getMovementTemplate } from "../template/registry";
import { validateTemplate } from "../template/validate";

test("every registered template is structurally valid", () => {
  for (const t of getAllMovementTemplates()) assert.deepEqual(validateTemplate(t), [], t.id);
});

test("template ids are unique and resolvable", () => {
  const ids = getAllMovementTemplates().map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.equal(getMovementTemplate(id)?.id, id);
  assert.equal(getMovementTemplate("nope"), null);
});

test("validator rejects a badly authored template", () => {
  const good = getAllMovementTemplates()[0];
  const broken = structuredClone(good);
  broken.rep.peakThreshold = broken.rep.restThreshold - 5;
  broken.rules[0].metric = "missing";
  broken.rules[0].high!.texts = ["Wrong posture.", "Wrong posture.", "Wrong posture."] as never;
  const problems = validateTemplate(broken).join("\n");
  assert.match(problems, /thresholds must be ordered/);
  assert.match(problems, /unknown metric missing/);
  assert.match(problems, /escalating texts must differ/);
  assert.match(problems, /vague wording/);
});

test("every correction names what, where and how: it mentions a body part", () => {
  const parts = /\b(knee|leg|foot|heel|back|chest|elbow|arm|wrist|hand|shoulder|head|neck|hip|ribs|nose|body|torso|toes|ankle|weight)s?\b/i;
  for (const t of getAllMovementTemplates()) {
    const msgs = [...t.rules, ...Object.values(t.repRules)].flatMap((r) => (r ? [r.low, r.high] : [])).filter(Boolean);
    for (const m of msgs) for (const text of m!.texts) assert.match(text, parts, `${t.id}: "${text}" names no body part`);
  }
});
