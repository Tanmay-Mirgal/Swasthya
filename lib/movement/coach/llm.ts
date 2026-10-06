/**
 * lib/movement/coach/llm.ts
 *
 * Builds the structured request for the language model and talks to the server route. The
 * request carries identifiers and rounded numbers only. Every failure path resolves to
 * `null`, which the coaching loop treats as "use the deterministic wording".
 */
import { COACH_CONFIG } from "./config";
import { cleanCue, sanitiseQuoted } from "./cueValidation";
import { findRule } from "./messages";
import type { CoachState, IssueHistory } from "./coachState";
import type { CoachCueRequest, CoachCueResponse } from "./llmTypes";
import type { MovementTemplate } from "../template/schema";

/** Measurement unit for a rule's numbers, only when it is one a patient could understand. */
function unitFor(template: MovementTemplate, code: string): "deg" | "pct" | "s" | undefined {
  const found = findRule(template, code);
  if (!found) return undefined;
  if (found.kind === "tempo" || found.kind === "hold") return "s";
  if (found.kind === "range") return template.rep.unit;
  const metric = found.continuous ? template.metrics[found.continuous.metric] : undefined;
  if (!metric) return undefined;
  return metric.kind === "angle" || metric.kind === "fromVertical" ? "deg" : undefined;
}

const round = (n: number | undefined) => (n !== undefined && Number.isFinite(n) ? Math.round(n * 10) / 10 : undefined);

export function buildCueRequest(s: CoachState, template: MovementTemplate, issue: IssueHistory, confidence: "HIGH" | "MEDIUM"): CoachCueRequest {
  const unit = unitFor(template, issue.code);
  let improving: boolean | null = null;
  if (issue.firstMeasured !== undefined && issue.measured !== undefined && issue.expected !== undefined && issue.occurrences > 1) {
    improving = Math.abs(issue.measured - issue.expected) < Math.abs(issue.firstMeasured - issue.expected) - 1e-6;
  }
  return {
    exerciseId: template.id,
    phase: s.currentPhase,
    rep: s.currentRep + 1,
    set: s.currentSet,
    confidence,
    error: {
      code: issue.code,
      direction: issue.direction,
      severity: issue.severity,
      ...(unit ? { measured: round(issue.measured), expected: round(issue.expected), unit } : {}),
    },
    attempts: issue.attempts,
    improving,
    previousCue: sanitiseQuoted(issue.lastText),
    tier: issue.tier,
  };
}

export type Fetcher = (input: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

/**
 * Asks the server for a coaching cue. Never throws. Returns null on any problem: no
 * network, timeout, server error, refusal, or a cue that fails validation.
 */
export async function requestCoachCue(request: CoachCueRequest, opts: { fetcher?: Fetcher; token?: string; timeoutMs?: number } = {}): Promise<string | null> {
  const fetcher: Fetcher = opts.fetcher ?? ((i, init) => fetch(i, init));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? COACH_CONFIG.llmTimeoutMs);
  try {
    const res = await fetcher("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<CoachCueResponse>;
    if (data.fallback || !data.cue) return null;
    return cleanCue(data.cue);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
