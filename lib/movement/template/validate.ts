/**
 * lib/movement/template/validate.ts
 *
 * Structural checks for a MovementTemplate. Run in tests for every registered template so
 * a badly authored template (unordered thresholds, a rule pointing at a missing metric, a
 * message with no escalation) fails loudly instead of misjudging a patient.
 */
import type { MovementTemplate, RuleMessage } from "./schema";
import type { LandmarkRef } from "../landmarks";

const refsOf = (m: MovementTemplate["metrics"][string]): LandmarkRef[] => {
  switch (m.kind) {
    case "angle":
      return [m.a, m.b, m.c];
    case "fromVertical":
    case "distance":
      return [m.a, m.b];
    case "offsetX":
      return [m.point, m.ref1, m.ref2];
    case "offsetY":
      return [m.point, m.from];
    case "lineOffsetInward":
      return [m.point, m.end1, m.end2];
    case "verticalRatio":
      return [m.a, m.b, m.c, m.d];
  }
};

const KNOWN_JOINTS = new Set(["nose", "ear", "shoulder", "elbow", "wrist", "hip", "knee", "ankle", "heel", "foot"]);

export function validateTemplate(t: MovementTemplate): string[] {
  const problems: string[] = [];
  const bad = (msg: string) => problems.push(`${t.id}: ${msg}`);

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t.id)) bad("id must be kebab-case");
  if (t.instructions.length < 2) bad("needs at least two instructions");
  if (t.defaultReps < 1 || t.defaultReps > 50) bad("defaultReps out of range");
  if (t.camera.minBodyFraction >= t.camera.maxBodyFraction) bad("camera body fraction range is empty");
  if (t.landmarks.required.length < 2) bad("needs at least two required landmarks");

  for (const [name, m] of Object.entries(t.metrics)) {
    for (const r of refsOf(m)) if (!KNOWN_JOINTS.has(r.joint)) bad(`metric ${name} uses unknown joint ${r.joint}`);
  }

  const r = t.rep;
  if (!t.metrics[r.metric]) bad(`rep.metric ${r.metric} is not a metric`);
  const s = r.direction === "increase" ? 1 : -1;
  const ordered = [s * r.restThreshold, s * r.leaveThreshold, s * r.countThreshold, s * r.peakThreshold];
  for (let i = 1; i < ordered.length; i++) if (!(ordered[i] > ordered[i - 1])) bad("rep thresholds must be ordered rest < leave < count < peak in the direction of movement");
  if (r.returnDrop <= 0) bad("rep.returnDrop must be positive");
  if (r.minRepMs <= 0 || r.debounceMs < 0 || r.abandonMs <= r.minRepMs) bad("rep timing values are inconsistent");
  if (r.maxRepMs !== undefined && r.maxRepMs <= r.minRepMs) bad("maxRepMs must exceed minRepMs");

  for (const c of t.setup.conditions ?? []) if (!t.metrics[c.metric]) bad(`setup condition uses unknown metric ${c.metric}`);

  const ids = new Set<string>();
  const checkMsg = (where: string, msg: RuleMessage | undefined) => {
    if (!msg) return;
    if (msg.texts.length < 3) bad(`${where}: needs at least 3 escalating texts`);
    if (new Set(msg.texts).size !== msg.texts.length) bad(`${where}: escalating texts must differ`);
    for (const x of msg.texts) {
      if (x.trim().length < 12 || x.split(/\s+/).length > 22) bad(`${where}: text should be a short sentence: "${x}"`);
      if (/\b(wrong|incorrect|bad posture|try again)\b/i.test(x)) bad(`${where}: vague wording "${x}"`);
    }
    if (!msg.observation.trim()) bad(`${where}: missing observation`);
  };
  const checkBase = (where: string, rule: { id: string; landmarks: LandmarkRef[]; low?: RuleMessage; high?: RuleMessage }) => {
    if (ids.has(rule.id)) bad(`${where}: duplicate rule id ${rule.id}`);
    ids.add(rule.id);
    if (!rule.landmarks.length) bad(`${where}: must name the joints to colour`);
    if (!rule.low && !rule.high) bad(`${where}: needs a low or high message`);
    checkMsg(`${where}.low`, rule.low);
    checkMsg(`${where}.high`, rule.high);
  };

  for (const rule of t.rules) {
    checkBase(`rule ${rule.id}`, rule);
    if (!t.metrics[rule.metric]) bad(`rule ${rule.id}: unknown metric ${rule.metric}`);
    if (rule.min === undefined && rule.max === undefined) bad(`rule ${rule.id}: needs min or max`);
    if (rule.min !== undefined && rule.max !== undefined && rule.min >= rule.max) bad(`rule ${rule.id}: min must be below max`);
    if (rule.min !== undefined && !rule.low) bad(`rule ${rule.id}: has min but no low message`);
    if (rule.max !== undefined && !rule.high) bad(`rule ${rule.id}: has max but no high message`);
    if (rule.sustainMs < 150) bad(`rule ${rule.id}: sustainMs under 150 would react to single frames`);
    if (rule.release < 0 || rule.recoverMs < 100) bad(`rule ${rule.id}: release / recoverMs invalid`);
    if (!rule.phases.length || rule.phases.includes("setup")) bad(`rule ${rule.id}: phases must be non-empty and exclude setup`);
  }
  for (const [k, rule] of Object.entries(t.repRules)) if (rule) checkBase(`repRule ${k}`, rule);
  if (!t.repRules.range.low) bad("repRules.range needs a low message");
  if (r.minRepMs > 0 && !t.repRules.tooFast) bad("repRules.tooFast is required when minRepMs is set");
  if (r.minPeakHoldMs && !t.repRules.shortHold) bad("repRules.shortHold is required when minPeakHoldMs is set");

  if (!t.statusJoints.length) bad("statusJoints is empty");
  for (const l of Object.values(t.phaseCues)) if (l.trim().length < 8) bad("phase cue too short");
  return problems;
}
