/**
 * lib/movement/coach/messages.ts
 *
 * Deterministic coaching text, taken from the exercise template. This is the floor the
 * whole coaching system stands on: with the language model off, offline or failing, every
 * correction still says WHAT is wrong, WHERE, and HOW to fix it, and gets less repetitive
 * the longer a problem persists.
 */
import type { ContinuousRule, MovementTemplate, RuleMessage } from "../template/schema";
import type { Severity } from "../types";

type AnyRule = {
  id: string;
  label: string;
  severity: Severity;
  invalidatesRep: boolean;
  low?: RuleMessage;
  high?: RuleMessage;
  ack?: string;
};

export interface RuleLookup {
  rule: AnyRule;
  /** Present for continuous rules. */
  continuous?: ContinuousRule;
  kind: "continuous" | "range" | "tempo" | "return" | "hold";
}

export function findRule(template: MovementTemplate, code: string): RuleLookup | null {
  const id = code.toLowerCase();
  const c = template.rules.find((r) => r.id === id);
  if (c) return { rule: c, continuous: c, kind: "continuous" };
  const rr = template.repRules;
  if (rr.range.id === id) return { rule: rr.range, kind: "range" };
  if (rr.tooFast?.id === id) return { rule: rr.tooFast, kind: "tempo" };
  if (rr.tooSlow?.id === id) return { rule: rr.tooSlow, kind: "tempo" };
  if (rr.incompleteReturn?.id === id) return { rule: rr.incompleteReturn, kind: "return" };
  if (rr.shortHold?.id === id) return { rule: rr.shortHold, kind: "hold" };
  return null;
}

export function messageFor(rule: AnyRule, direction: "low" | "high"): RuleMessage | null {
  return (direction === "low" ? rule.low ?? rule.high : rule.high ?? rule.low) ?? null;
}

/** The short instruction shown on screen for a problem ("Sit tall"), at most 24 characters. */
export function showFor(template: MovementTemplate, code: string, direction: "low" | "high"): string | null {
  const found = findRule(template, code);
  return found ? messageFor(found.rule, direction)?.show ?? null : null;
}

/** Wording for the nth time a problem is coached (0 = first). Escalates, then stays on the last tier. */
export function textFor(template: MovementTemplate, code: string, direction: "low" | "high", tier: number): string | null {
  const found = findRule(template, code);
  if (!found) return null;
  const msg = messageFor(found.rule, direction);
  if (!msg) return null;
  return msg.texts[Math.max(0, Math.min(tier, msg.texts.length - 1))];
}

export function observationFor(template: MovementTemplate, code: string, direction: "low" | "high"): string | null {
  const found = findRule(template, code);
  return found ? messageFor(found.rule, direction)?.observation ?? null : null;
}

const GENERIC_ACK = ["Good correction.", "Nice, that is better.", "That's it. Keep it there.", "Well done, that looks steady."];

export function ackFor(template: MovementTemplate, code: string, nth: number): string {
  const found = findRule(template, code);
  if (nth === 0 && found?.rule.ack) return found.rule.ack;
  return GENERIC_ACK[nth % GENERIC_ACK.length];
}

/**
 * Lower number = more important. Camera/visibility problems always outrank form, because
 * form cannot be judged until the person can be seen.
 */
export const PRIORITY = { camera: 1, major: 2, moderate: 3, range: 4, minor: 5, tempo: 6, praise: 8, setup: 7 } as const;

export function priorityOf(template: MovementTemplate, code: string): number {
  const found = findRule(template, code);
  if (!found) return PRIORITY.minor;
  if (found.kind === "continuous") return found.rule.severity === "major" ? PRIORITY.major : found.rule.severity === "moderate" ? PRIORITY.moderate : PRIORITY.minor;
  if (found.kind === "range" || found.kind === "return") return PRIORITY.range;
  return PRIORITY.tempo;
}

export function labelFor(template: MovementTemplate, code: string): string {
  return findRule(template, code)?.rule.label ?? code.toLowerCase().replace(/_/g, " ");
}
