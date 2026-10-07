/**
 * lib/movement/analytics/sessionReport.ts
 *
 * Builds a performance summary of ONE exercise-day from STORED data only. Two parts, both
 * pure and testable:
 *
 *   buildSessionFacts()    the numbers, taken straight from the stored session
 *   deterministicReport()  plain sentences made from those numbers, with no model involved
 *
 * The language model (when available) only rewrites the deterministic report in friendlier
 * words; its output is accepted only if every number in it already exists in the facts and
 * it contains no diagnostic or treatment language. The report never states a cause, a
 * diagnosis or a recommendation about treatment: the therapist remains the authority.
 */
import { issueLabel } from "@/lib/rehab/issueLabels";
import { correctionRateOf, creditsGoodRepsOnly, formAccuracyOf } from "@/lib/rehab/chunkQuality";
import type { IExerciseSession } from "@/models/ExerciseSession";

export interface SetFacts {
  index: number;
  counted: number;
  valid?: number;
  invalid?: number;
  partial?: number;
  rom?: number;
  avgConfidence?: number;
  /** Share of this set's counted reps that were valid, 0-100. */
  validShare?: number;
}

export interface ErrorFact {
  code: string;
  label: string;
  reps: number;
  severity: "minor" | "moderate" | "major";
}

export interface SessionFacts {
  exercise: string;
  exerciseId: string;
  day?: string;
  /** True when the movement engine judged each rep (engine v2 data). Older sessions only have counts. */
  judged: boolean;
  /**
   * Engine v4 data: `completedReps` are GOOD reps only, and `invalid` / `partial` are attempts that did NOT count.
   * Before v4, `completedReps` also included reps that were flagged.
   */
  goodOnly: boolean;
  /** Attempts that did not count (v4): invalid + partial. */
  notCounted?: number;
  targetReps: number;
  completedReps: number;
  valid?: number;
  invalid?: number;
  partial?: number;
  validShare?: number;
  sets: SetFacts[];
  rom?: { best: number; unit: "deg" | "pct" };
  targetRom?: number;
  avgRepSeconds?: number;
  avgConfidence?: number;
  errors: ErrorFact[];
  corrections?: { attempted: number; succeeded: number; ratePercent: number };
  /** Change in valid-rep share from the first judged set to the last, when there are at least two. */
  trend?: { from: number; to: number; sets: number; change: number };
  observations: { code: string; label: string; repsAffected: number; ofReps: number }[];
  discomfort?: string;
}

export interface ReportContent {
  summary: string;
  wentWell: string[];
  toImprove: string[];
  mostCommonError: string | null;
  acrossSets: string | null;
  correctionSuccess: string | null;
  nextFocus: string;
  therapistSummary: string;
}

type SessionLike = Pick<
  IExerciseSession,
  "exerciseId" | "exerciseName" | "targetReps" | "completedReps" | "rom" | "targetRom" | "sets" | "dateKey" | "discomfort" | "validReps" | "invalidReps" | "partialReps" | "correctionAttempts" | "correctionsSucceeded" | "avgConfidence" | "issueCounts" | "issueSeverity" | "observations" | "engineVersion"
>;

const round = (n: number) => Math.round(n);

export function buildSessionFacts(s: SessionLike, opts: { romUnit?: "deg" | "pct" } = {}): SessionFacts {
  const judged = (s.engineVersion ?? 0) >= 2 && s.validReps !== undefined && s.invalidReps !== undefined;
  const goodOnly = judged && creditsGoodRepsOnly(s.engineVersion);
  // Engine v4 counts every attempt in the share (good, flagged and short); before that only counted reps were judged.
  const share = (valid?: number, invalid?: number, partial?: number) => formAccuracyOf(valid, invalid, goodOnly ? (partial ?? 0) : 0);
  const sets: SetFacts[] = (s.sets ?? []).map((set) => {
    const chunks = set.chunks ?? [];
    const sum = (f: (c: (typeof chunks)[number]) => number | undefined) => {
      let any = false;
      let t = 0;
      for (const c of chunks) {
        const v = f(c);
        if (v !== undefined) {
          any = true;
          t += v;
        }
      }
      return any ? t : undefined;
    };
    const valid = sum((c) => c.validReps);
    const invalid = sum((c) => c.invalidReps);
    const partialSum = sum((c) => c.partialReps);
    const roms = chunks.map((c) => c.rom).filter((n): n is number => typeof n === "number" && n > 0);
    const confs = chunks.filter((c) => c.avgConfidence !== undefined && c.reps > 0);
    const reps = confs.reduce((a, c) => a + c.reps, 0);
    return {
      index: set.index,
      counted: set.completedReps,
      valid,
      invalid,
      partial: partialSum,
      rom: roms.length ? Math.max(...roms) : undefined,
      avgConfidence: reps ? Math.round((confs.reduce((a, c) => a + (c.avgConfidence as number) * c.reps, 0) / reps) * 100) / 100 : undefined,
      validShare: share(valid, invalid, partialSum),
    };
  });

  const errors: ErrorFact[] = Object.entries(s.issueCounts ?? {})
    .map(([code, reps]) => ({ code, label: issueLabel(code), reps: Number(reps), severity: ((s.issueSeverity ?? {})[code] ?? "minor") as ErrorFact["severity"] }))
    .filter((e) => e.reps > 0)
    .sort((a, b) => b.reps - a.reps);

  const repMs = (s.sets ?? []).flatMap((set) => (set.chunks ?? []).flatMap((c) => (c.repRecords ?? []).map((r) => r.ms))).filter((n) => n > 0);

  const judgedSets = sets.filter((x) => x.validShare !== undefined && (x.counted ?? 0) > 0);
  let trend: SessionFacts["trend"];
  if (judged && judgedSets.length >= 2) {
    const from = judgedSets[0].validShare as number;
    const to = judgedSets[judgedSets.length - 1].validShare as number;
    trend = { from, to, sets: judgedSets.length, change: to - from };
  }

  const attempted = s.correctionAttempts;
  const succeeded = s.correctionsSucceeded;
  const rate = correctionRateOf(attempted, succeeded);

  return {
    exercise: s.exerciseName,
    exerciseId: s.exerciseId,
    day: s.dateKey,
    judged,
    goodOnly,
    notCounted: goodOnly ? (s.invalidReps ?? 0) + (s.partialReps ?? 0) : undefined,
    targetReps: s.targetReps,
    completedReps: s.completedReps,
    valid: judged ? s.validReps : undefined,
    invalid: judged ? s.invalidReps : undefined,
    partial: judged ? s.partialReps : undefined,
    validShare: judged ? share(s.validReps, s.invalidReps, s.partialReps) : undefined,
    sets,
    rom: s.rom && s.rom > 0 ? { best: round(s.rom), unit: opts.romUnit ?? "deg" } : undefined,
    targetRom: s.targetRom,
    avgRepSeconds: repMs.length ? Math.round((repMs.reduce((a, b) => a + b, 0) / repMs.length / 100)) / 10 : undefined,
    avgConfidence: s.avgConfidence,
    errors: judged ? errors : [],
    corrections: judged && attempted !== undefined && succeeded !== undefined && rate !== undefined ? { attempted, succeeded, ratePercent: rate } : undefined,
    trend,
    observations: judged ? (s.observations ?? []).map((o) => ({ ...o, label: issueLabel(o.code) })) : [],
    discomfort: s.discomfort,
  };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const unitOf = (u: "deg" | "pct") => (u === "pct" ? "%" : "°");

/** Every sentence is assembled from numbers in `facts`; nothing here is inferred. */
export function deterministicReport(f: SessionFacts): ReportContent {
  const done = f.completedReps >= f.targetReps && f.targetReps > 0;
  const base = `${f.completedReps} of ${f.targetReps} ${f.goodOnly ? "good reps" : "reps"} of ${f.exercise} ${f.completedReps === 1 ? "was" : "were"} counted.`;
  // Engine v4: every counted rep is a good one, so what is worth saying is how many attempts did NOT count, and why.
  const notCountedLine = f.goodOnly && f.notCounted ? ` ${plural(f.notCounted, "other attempt")} did not count: ${f.invalid ?? 0} broke a movement check and ${f.partial ?? 0} did not go far enough.` : "";
  const summary = f.goodOnly
    ? `${base}${notCountedLine}`
    : f.judged
      ? `${base} ${f.valid} of ${f.completedReps} also met the movement checks${f.partial ? `, and ${plural(f.partial, "attempt")} did not go far enough to count` : ""}.`
      : `${base} Movement checks were not recorded for this session.`;
  const shareNoun = f.goodOnly ? "attempts that counted as good reps" : "reps meeting the checks";
  const attemptsTotal = (f.valid ?? 0) + (f.invalid ?? 0) + (f.partial ?? 0);

  const wentWell: string[] = [];
  if (done) wentWell.push(`All ${f.targetReps} prescribed reps were completed.`);
  else if (f.completedReps > 0) wentWell.push(`${plural(f.completedReps, "rep")} ${f.completedReps === 1 ? "was" : "were"} completed and saved.`);
  if (f.goodOnly && f.validShare !== undefined && f.validShare >= 75 && attemptsTotal > 0) wentWell.push(`${f.valid} of ${attemptsTotal} attempts counted as good reps.`);
  else if (f.judged && !f.goodOnly && f.validShare !== undefined && f.validShare >= 75 && f.completedReps > 0) wentWell.push(`${f.valid} of ${f.completedReps} reps met the movement checks.`);
  if (f.corrections && f.corrections.attempted > 0 && f.corrections.ratePercent >= 50) wentWell.push(`After a suggestion, the movement was adjusted ${f.corrections.succeeded} of ${f.corrections.attempted} times.`);
  if (f.trend && f.trend.change > 0) wentWell.push(`The share of ${shareNoun} rose from ${f.trend.from}% to ${f.trend.to}% across the sets.`);
  if (f.judged && f.avgConfidence !== undefined && f.avgConfidence >= 0.85) wentWell.push("The camera could see you clearly throughout.");
  if (f.rom && f.targetRom && f.rom.unit === "deg" && f.rom.best >= f.targetRom) wentWell.push(`The best range of motion, ${f.rom.best}${unitOf(f.rom.unit)}, reached the target of ${f.targetRom}${unitOf(f.rom.unit)}.`);

  const toImprove: string[] = [];
  for (const e of f.errors.slice(0, 3)) toImprove.push(`${e.label} came up in ${plural(e.reps, "rep")}.`);
  if (f.goodOnly && f.invalid) toImprove.push(`${plural(f.invalid, "attempt")} broke a movement check and did not count.`);
  if (f.judged && f.partial) toImprove.push(`${plural(f.partial, "attempt")} did not go far enough to count.`);
  if (f.judged && f.avgConfidence !== undefined && f.avgConfidence < 0.6) toImprove.push("The camera had trouble seeing you for part of the session. A clearer view will let the checks work properly.");
  if (f.rom && f.targetRom && f.rom.unit === "deg" && f.rom.best < f.targetRom) toImprove.push(`The best range of motion was ${f.rom.best}${unitOf(f.rom.unit)}, below the target of ${f.targetRom}${unitOf(f.rom.unit)}.`);
  if (!f.judged) toImprove.push("Form was not measured for this session, so there is nothing to compare.");

  const top = f.errors[0];
  const mostCommonError = top ? `${top.label}, in ${plural(top.reps, "rep")}.` : f.judged ? "No form flags came up in this session." : null;
  const acrossSets = f.trend
    ? f.trend.change === 0
      ? `The share of ${shareNoun} stayed at ${f.trend.to}% across ${f.trend.sets} sets.`
      : `The share of ${shareNoun} went from ${f.trend.from}% in the first set to ${f.trend.to}% in the last of ${f.trend.sets} sets.`
    : null;
  const correctionSuccess = f.corrections && f.corrections.attempted > 0 ? `${f.corrections.succeeded} of ${f.corrections.attempted} suggestions were followed by a fix (${f.corrections.ratePercent}%).` : f.judged ? "No corrections were needed." : null;
  const nextFocus = top ? `Focus on: ${top.label.toLowerCase()}. Keep the pace slow and steady.` : f.judged ? "Keep the same slow, steady pace and form." : "Keep the camera view clear so form can be checked next time.";

  const persistent = f.observations.length ? ` Repeated across reps: ${f.observations.map((o) => `${o.label.toLowerCase()} (${o.repsAffected} of ${o.ofReps})`).join("; ")}.` : "";
  const therapistSummary = f.judged
    ? `${base} ${f.goodOnly ? `${f.valid} good reps; not counted: ${f.invalid ?? 0} broke a movement check, ${f.partial ?? 0} did not reach the full range.` : `${f.valid} met the checks, ${f.invalid} were counted with a note, ${f.partial ?? 0} partial.`}${top ? ` Most frequent flag: ${top.label.toLowerCase()} in ${plural(top.reps, "rep")}.` : " No flags."}${f.corrections && f.corrections.attempted ? ` Suggestions followed by a fix: ${f.corrections.succeeded} of ${f.corrections.attempted}.` : ""}${f.avgConfidence !== undefined ? ` Mean tracking clarity ${Math.round(f.avgConfidence * 100)}%.` : ""}${persistent}${f.discomfort && f.discomfort !== "none" ? ` Patient reported ${f.discomfort} discomfort.` : ""}`
    : `${base} No per-rep movement data was recorded.${f.discomfort && f.discomfort !== "none" ? ` Patient reported ${f.discomfort} discomfort.` : ""}`;

  return { summary, wentWell, toImprove, mostCommonError, acrossSets, correctionSuccess, nextFocus, therapistSummary };
}

// ── Validation of model-written reports ───────────────────────────────────────

const FORBIDDEN_REPORT: RegExp[] = [
  /\b(diagnos\w*|injur\w*|tear|torn|arthritis|condition|disease|syndrome|surgery|medication|medicine|painkiller|dose|dosage|treat\w*|therap(y|ies) plan|you should (stop|rest|see)|stop exercising)\b/i,
  /\b(because|caused by|due to|indicates|suggests that|likely|probably)\b/i,
  /```|[<>{}]/,
  /https?:/i,
];

/** Numbers that appear anywhere in the facts: the only numbers a model-written report may contain. */
export function allowedNumbers(f: SessionFacts): Set<string> {
  const out = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === "number" && Number.isFinite(v)) {
      out.add(String(v));
      out.add(String(Math.round(v)));
      if (Math.abs(v) <= 1) out.add(String(Math.round(v * 100)));
      out.add(String(Math.abs(Math.round(v))));
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(f);
  out.add("0");
  out.add("1");
  return out;
}

export function reportTextIsSafe(text: string, allowed: Set<string>): boolean {
  if (typeof text !== "string" || !text.trim() || text.length > 500) return false;
  for (const re of FORBIDDEN_REPORT) if (re.test(text)) return false;
  for (const n of text.match(/\d+(?:\.\d+)?/g) ?? []) if (!allowed.has(n) && !allowed.has(String(Math.round(Number(n))))) return false;
  return true;
}

/**
 * Accepts a model-written report only if EVERY string passes: no new numbers, no diagnostic or
 * causal language, sensible size. Otherwise returns null and the deterministic report is used.
 */
export function acceptModelReport(raw: unknown, facts: SessionFacts): ReportContent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const allowed = allowedNumbers(facts);
  const str = (v: unknown) => (typeof v === "string" && reportTextIsSafe(v, allowed) ? v.trim() : null);
  const list = (v: unknown, max: number) => (Array.isArray(v) && v.length <= max && v.every((x) => str(x) !== null) ? (v as string[]).map((x) => x.trim()) : null);
  const optional = (v: unknown) => (v === null || v === undefined || v === "" ? null : str(v));

  const summary = str(r.summary);
  const wentWell = list(r.wentWell, 5);
  const toImprove = list(r.toImprove, 5);
  const nextFocus = str(r.nextFocus);
  const therapistSummary = str(r.therapistSummary);
  if (!summary || !wentWell || !toImprove || !nextFocus || !therapistSummary) return null;
  const mostCommonError = optional(r.mostCommonError);
  const acrossSets = optional(r.acrossSets);
  const correctionSuccess = optional(r.correctionSuccess);
  if ((r.mostCommonError && !mostCommonError) || (r.acrossSets && !acrossSets) || (r.correctionSuccess && !correctionSuccess)) return null;
  return { summary, wentWell, toImprove, mostCommonError, acrossSets, correctionSuccess, nextFocus, therapistSummary };
}

export const REPORT_SYSTEM_PROMPT = `You rewrite a physiotherapy exercise session summary in clear, kind, plain language.

You are given a JSON object of FACTS and a DRAFT report built from them. Improve the wording of the draft only.

Rules:
- Use only facts present in the input. Do not add, change or estimate any number. Do not add any number that is not in the facts.
- Never diagnose, never name a condition or injury, never state or guess a cause (no "because", "due to", "likely"), never mention medication or treatment, never tell the patient to stop, rest or see someone.
- Describe what was measured and how often. Be encouraging and specific. Keep each sentence short.
- "Therapist summary" is factual and neutral, for a physiotherapist to read.
- Return ONLY a JSON object with exactly these keys: summary (string), wentWell (array of strings, at most 4), toImprove (array of strings, at most 4), mostCommonError (string or null), acrossSets (string or null), correctionSuccess (string or null), nextFocus (string), therapistSummary (string).`;

export function reportUserMessage(facts: SessionFacts, draft: ReportContent): string {
  return `FACTS:\n${JSON.stringify(facts)}\n\nDRAFT:\n${JSON.stringify(draft)}`;
}
