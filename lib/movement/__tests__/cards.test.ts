import test from "node:test";
import assert from "node:assert/strict";
import { getAllMovementTemplates } from "../template/registry";
import { renderTemplateCard } from "../template/cards";

test("every template has a review card that states what counts, what does not, and what is only coaching", () => {
  for (const t of getAllMovementTemplates()) {
    const card = renderTemplateCard(t);
    assert.match(card, new RegExp(`^# ${t.name}`), t.id);
    for (const h of ["A rep is GOOD", "What does NOT count", "Coaching only", "What the patient sees and hears", "All thresholds (for review)", "Awaiting physiotherapist review"]) assert.ok(card.includes(h), `${t.id}: missing "${h}"`);
    assert.ok(card.includes(`${t.rep.unit === "pct" ? "%" : "°"}`), t.id);
    for (const r of t.rules.filter((x) => x.invalidatesRep)) assert.ok(card.includes(r.id), `${t.id}: mandatory rule ${r.id} is on the card`);
  }
});

test("a card shows the numbers the engine actually uses", () => {
  const knee = getAllMovementTemplates().find((t) => t.id === "seated-knee-extension")!;
  const card = renderTemplateCard(knee);
  assert.ok(card.includes("reaches the minimum range:** the knee rises to 150°"));
  assert.ok(card.includes("at least 0.8 s"), "the tempo floor");
  const heel = renderTemplateCard(getAllMovementTemplates().find((t) => t.id === "heel-raise")!);
  assert.ok(heel.includes("15%"), "a ratio exercise is shown in percent");
  assert.ok(heel.includes("at least 0.4 s"), "a 500 ms hold with 20% tolerance");
});

test("a card for a reviewed template names the reviewer and drops the warning", () => {
  const t = structuredClone(getAllMovementTemplates()[0]);
  t.validity.source = "physio-reviewed";
  t.validity.reviewedBy = "A. Rao, MPT";
  t.validity.reviewedAt = "2026-11-02";
  const card = renderTemplateCard(t);
  assert.ok(card.includes("Reviewed by A. Rao, MPT on 2026-11-02"));
  assert.ok(!card.includes("Awaiting physiotherapist review"));
});

test("every shown instruction fits across a room", () => {
  for (const t of getAllMovementTemplates()) {
    for (const r of [...Object.values(t.repRules), ...t.rules]) {
      for (const m of r ? [r.low, r.high] : []) if (m) {
        assert.ok(m.show.length <= 24, `${t.id}/${r!.id}: "${m.show}" is ${m.show.length} characters`);
        assert.ok(m.show.split(/\s+/).length <= 5, `${t.id}/${r!.id}: "${m.show}" has too many words`);
      }
    }
  }
});
