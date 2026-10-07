/**
 * lib/movement/template/cards.ts
 *
 * Renders a template as a one-page "template card" a physiotherapist can read and sign off without reading code:
 * what counts as a good rep, what does not, what only coaches, what the patient sees and hears, and why each
 * threshold is what it is. Generated from the template itself, so the card can never disagree with the engine.
 * Every threshold on a card is an engineering default until `validity.source` says "physio-reviewed".
 */
import type { ContinuousRule, MetricDef, MovementTemplate, RuleBase } from "./schema";

const unitOfMetric = (m: MetricDef | undefined): string => {
  if (!m) return "";
  switch (m.kind) {
    case "angle":
    case "fromVertical":
      return "°";
    case "verticalRatio":
      return " (ratio)";
    default:
      return " (× body scale)";
  }
};

const range = (t: MovementTemplate, v: number) => `${Math.round(v * (t.rep.displayScale ?? 1) * 100) / 100}${t.rep.unit === "pct" ? "%" : "°"}`;
const secs = (ms: number) => `${Math.round(ms / 100) / 10} s`;
const dir = (t: MovementTemplate) => (t.rep.direction === "increase" ? "rises" : "falls");

function ruleLine(t: MovementTemplate, r: ContinuousRule): string {
  const m = t.metrics[r.metric];
  const u = unitOfMetric(m);
  const band = [r.min !== undefined ? `at least ${r.min}${u}` : null, r.max !== undefined ? `at most ${r.max}${u}` : null].filter(Boolean).join(" and ");
  return `**${r.label}** (\`${r.id}\`, ${r.severity}): the ${r.metric} measure must stay ${band} while ${r.phases.join(" / ")}. Held for ${secs(r.sustainMs)} before it shows; clears after ${secs(r.recoverMs)}.`;
}

function messageRows(rule: RuleBase): string[] {
  const rows: string[] = [];
  for (const [dirName, msg] of [["below", rule.low], ["above", rule.high]] as const) {
    if (!msg) continue;
    rows.push(`| ${rule.id} (${dirName}) | ${msg.show} | ${msg.texts[0]} |`);
  }
  return rows;
}

export function renderTemplateCard(t: MovementTemplate): string {
  const v = t.validity;
  const mandatory = t.rules.filter((r) => r.invalidatesRep);
  const advisory = t.rules.filter((r) => !r.invalidatesRep);
  const reviewed = v.source === "physio-reviewed";
  const hold = t.rep.minPeakHoldMs;
  const L: string[] = [];

  L.push(`# ${t.name}`);
  L.push("");
  L.push(`> ${reviewed ? `Reviewed by ${v.reviewedBy} on ${v.reviewedAt}.` : "**Awaiting physiotherapist review.** Every number below is an engineering default, tuned on synthetic geometry and not on real footage. It is not clinical advice."}`);
  L.push("");
  L.push(`Template \`${t.id}\` v${t.version} · ${t.bodyPart} · ${t.category} · ${t.difficulty}`);
  L.push("");
  L.push(t.description);
  L.push("");

  L.push("## Camera and start position");
  L.push(`- **View:** ${t.camera.view}. ${t.camera.hint}`);
  L.push(`- **Joints that must be visible:** ${t.landmarks.required.map((r) => r.joint).join(", ")}${t.landmarks.optional.length ? ` (also used if visible: ${t.landmarks.optional.map((r) => r.joint).join(", ")})` : ""}.`);
  L.push(`- **Start position:** ${t.setup.instruction} Held for ${secs(t.setup.holdMs)} before any rep is judged.`);
  L.push(`- *Why:* ${v.rationale.setup}`);
  L.push("");

  L.push("## A rep is GOOD (and only then counted) when ALL of these are true");
  L.push(`1. **It reaches the minimum range:** the ${t.rep.metric} ${dir(t)} to ${range(t, t.rep.peakThreshold)} (starting from about ${range(t, t.rep.restThreshold)}). *Why:* ${v.rationale.minRange}`);
  L.push(`2. **It returns to the start zone** (${range(t, t.rep.restThreshold)}) before it ends. *Why:* ${v.rationale.return}`);
  L.push(`3. **Hold:** ${hold ? `it holds at the top for at least ${secs(hold * (v.holdTolerance ?? 0.8))} (${secs(hold)} with ${Math.round((1 - (v.holdTolerance ?? 0.8)) * 100)}% tolerance)` : "the template requires none"}; any hold the therapist prescribes is also required. *Why:* ${v.rationale.hold}`);
  L.push(`4. **It is not flicked through:** the whole cycle takes at least ${secs(v.tempoFloorMs)}. *Why:* ${v.rationale.tempoFloor}`);
  if (mandatory.length) {
    L.push(`5. **None of these mandatory rules is broken:**`);
    for (const r of mandatory) L.push(`   - ${ruleLine(t, r)} *Why:* ${v.rationale[r.id]}`);
  } else L.push("5. No mandatory movement rules apply to this exercise.");
  L.push(`6. **It was seen well enough to judge:** no more than ${secs(v.lowToleranceMs ?? 1000)} of the cycle can be unseen, and every mandatory rule above must be measurable. *Why:* ${v.rationale.visibility}`);
  L.push("");

  L.push("## What does NOT count");
  L.push(`- **Short** (not counted, "a little farther"): the movement leaves the start clearly but stops below ${range(t, t.rep.peakThreshold)}. The band from ${range(t, t.rep.countThreshold)} to ${range(t, t.rep.peakThreshold)} is the "almost there" band. *Why:* ${v.rationale.almostBand}`);
  L.push(`- **Broke a rule** (not counted, the rule is named): any mandatory rule above, a missed hold, or a cycle faster than ${secs(v.tempoFloorMs)}.`);
  L.push(`- **Not seen** (not counted, never called wrong): the camera could not see enough to judge. The patient is asked to adjust the camera, not the movement.`);
  L.push("");

  L.push("## Coaching only (never stops a rep counting)");
  L.push(`- **Pace:** a cycle faster than ${secs(t.rep.minRepMs)} is coached ("slow down"); one slower than ${t.rep.maxRepMs ? secs(t.rep.maxRepMs) : "—"} is not penalised.`);
  L.push(`- **Return:** if the return stalls for ${secs(t.rep.returnStallMs)}, the patient is reminded to finish returning.`);
  for (const r of advisory) L.push(`- ${ruleLine(t, r)} *Why:* ${v.rationale[r.id]}`);
  L.push("");

  L.push("## What the patient sees and hears");
  L.push("| Situation | Shown on screen (≤ 24 characters) | Spoken / captioned (first wording) |");
  L.push("|---|---|---|");
  for (const r of [...Object.values(t.repRules), ...t.rules]) if (r) L.push(...messageRows(r));
  L.push("");

  L.push("## All thresholds (for review)");
  L.push("| Item | Value | Source |");
  L.push("|---|---|---|");
  L.push(`| Minimum range | ${range(t, t.rep.peakThreshold)} | ${v.source} |`);
  L.push(`| "Almost" band starts | ${range(t, t.rep.countThreshold)} | ${v.source} |`);
  L.push(`| Start zone | ${range(t, t.rep.restThreshold)} | ${v.source} |`);
  L.push(`| Leaves the start zone | ${range(t, t.rep.leaveThreshold)} | ${v.source} |`);
  L.push(`| Tempo floor (mandatory) | ${secs(v.tempoFloorMs)} | ${v.source} |`);
  L.push(`| Pace coaching starts below | ${secs(t.rep.minRepMs)} | ${v.source} |`);
  L.push(`| Hold | ${hold ? secs(hold) : "none"} | ${v.source} |`);
  for (const r of t.rules) L.push(`| ${r.label} | ${r.min !== undefined ? `≥ ${r.min}` : ""}${r.max !== undefined ? `≤ ${r.max}` : ""} (${r.invalidatesRep ? "mandatory" : "coaching"}) | ${v.source} |`);
  L.push("");
  L.push("A therapist may accept a lower range for one patient, between the \"almost\" band and the minimum range above. The value actually used is stored with every session.");
  L.push("");
  L.push("## Review");
  L.push("- [ ] Minimum range is right for this exercise");
  L.push("- [ ] Mandatory rules are the ones that should stop a rep counting");
  L.push("- [ ] Tempo floor and hold are appropriate");
  L.push("- [ ] Wording is clear and kind");
  L.push("");
  L.push("Reviewer: ______________________   Date: ____________");
  L.push("");
  return L.join("\n");
}
