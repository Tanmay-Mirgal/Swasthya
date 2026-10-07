/**
 * lib/movement/coach/coachState.ts
 *
 * The coaching loop as an explicit, serialisable state machine. It reacts to meaningful
 * MOVEMENT EVENTS, never to frames, and returns EFFECTS (show a cue, speak, ask the
 * language model, record a therapist observation) for the caller to run. It never does I/O
 * itself, so every behaviour is unit-testable and the whole thing works with the language
 * model absent.
 *
 * It is written graph-style, the shape the brief describes:
 *
 *   event ─► checkConfidence ─► (low? camera guidance)
 *                           └─► identifyError ─► decideCoaching ─► [cue + voice + llm prefetch]
 *   later:   corrected? ─► acknowledge          persisting? ─► adaptCoaching (escalate wording)
 *
 * The state never contains landmarks, angles or rep counts of its own invention: those arrive
 * in events from the deterministic engine. It also never diagnoses; observations for the
 * therapist say only what was measured and how often.
 */
import { COACH_CONFIG, type CoachConfig } from "./config";
import { ackFor, findRule, labelFor, messageFor, observationFor, priorityOf, PRIORITY, showFor, textFor } from "./messages";
import { decideSpeech, initialVoiceState, type SpeechCandidate, type VoiceState } from "./voicePolicy";
import { buildCueRequest } from "./llm";
import type { CoachCueRequest } from "./llmTypes";
import type { MovementTemplate } from "../template/schema";
import type { CameraAdvice, ConfidenceLevel, MovementEvent, Phase, Severity } from "../types";

export type CueTone = "info" | "correction" | "praise" | "camera" | "setup";

/** The result of the last attempt, for the screen: a good rep, or one that was NOT counted. Expires on its own. */
export interface Verdict {
  kind: "good" | "not_counted" | "partial" | "uncertain" | "corrected";
  /** Increases with every verdict, so the screen can tell two identical ones apart. */
  seq: number;
  at: number;
  /** For `partial`: it got close to the full range. */
  almost?: boolean;
  /** The one short instruction that goes with it ("Sit tall"). */
  show?: string | null;
  /** The sentence spoken (and captioned) for it: the same words the screen is built from. */
  say?: string | null;
  /** The rule this verdict is about, when it is about one. */
  code?: string;
  /** For a good rep: how clean it was. Chooses the wording only. */
  quality?: "excellent" | "good";
}

export interface Cue {
  text: string;
  tone: CueTone;
  /** The error code this cue is about, when it is a correction. */
  code?: string;
  priority: number;
  shownAt: number;
  source: "template" | "llm" | "system";
}

export interface IssueHistory {
  code: string;
  direction: "low" | "high";
  severity: Severity;
  occurrences: number;
  attempts: number;
  /** The wording tier to use the next time this is coached. */
  tier: number;
  active: boolean;
  lastCoachedAt: number;
  lastText: string;
  correctedCount: number;
  /** "set.rep" keys of the reps this problem was raised in. */
  repsAffected: string[];
  firstMeasured?: number;
  measured?: number;
  expected?: number;
  /** Language-model wording prefetched for `llmTier`. */
  llmNext?: string;
  llmTier?: number;
  llmPending: boolean;
  observed: boolean;
}

export interface CoachState {
  exerciseId: string;
  exerciseName: string;
  currentSet: number;
  currentRep: number;
  currentPhase: Phase;
  confidence: ConfidenceLevel;
  /** Codes of problems active right now. */
  currentErrors: string[];
  /** Codes active at the previous event. */
  previousErrors: string[];
  lastFeedback: { text: string; at: number; code?: string } | null;
  correctionAttempts: number;
  correctionStatus: "none" | "pending" | "corrected" | "persisting";
  movementMetrics: { lastRom: number; lastRepMs: number };
  sessionMetrics: { counted: number; valid: number; invalid: number; partial: number; corrections: { attempted: number; succeeded: number } };
  issues: Record<string, IssueHistory>;
  camera: CameraAdvice | null;
  cue: Cue | null;
  voice: VoiceState;
  pending: { candidate: SpeechCandidate; until: number } | null;
  llm: { usedThisSet: number; lastAt: number };
  paused: boolean;
  praiseCount: number;
  /** Reps of this set already saved before this chunk, and the reps this chunk is meant to count. For rep milestones. */
  repsBefore: number;
  chunkTarget: number;
  /** Range of each counted rep in this chunk, in order. For the pacing observation. */
  setRoms: number[];
  paceNoted: boolean;
  /** Attempts finished in this chunk (good or not), for stable per-attempt keys. */
  attemptNo: number;
  verdict: Verdict | null;
  verdictSeq: number;
  /** Attempts in a row that did not count; reset by a good rep. Uncertain ones (the camera's fault) change nothing. */
  streak: number;
  notCountedInChunk: number;
  validInChunk: number;
  /** After several attempts that did not count: show the guide / offer to finish for today. Reset each chunk. */
  suggestDemo: boolean;
  offerFinish: boolean;
  /** What became of each attempt in this chunk, in order (the last 24). For the attempt strip on screen. */
  attemptMarks: AttemptMark[];
}

export type AttemptMark = "good" | "not_counted" | "partial" | "uncertain";

export type CoachInput =
  | MovementEvent
  | { type: "tick"; t: number }
  | { type: "llm_result"; t: number; code: string; tier: number; text: string | null }
  | { type: "set_started"; t: number; set: number; targetReps?: number; repsBefore?: number }
  | { type: "set_complete"; t: number }
  | { type: "paused"; t: number; paused: boolean };

export interface Observation {
  code: string;
  label: string;
  repsAffected: number;
  ofReps: number;
}

export type CoachEffect =
  | { kind: "cue"; cue: Cue }
  | { kind: "clear_cue" }
  | { kind: "speak"; text: string; interrupt: boolean; key: string }
  | { kind: "stop_speech" }
  | { kind: "llm"; code: string; tier: number; request: CoachCueRequest }
  | { kind: "observe"; observation: Observation };

export interface CoachResult {
  state: CoachState;
  effects: CoachEffect[];
}

export interface CoachOptions {
  llmEnabled: boolean;
  config?: CoachConfig;
}

/** The coaching graph, for documentation and tests: node → nodes it can lead to. */
export const COACH_GRAPH: Record<string, string[]> = {
  checkConfidence: ["cameraGuidance", "identifyError"],
  cameraGuidance: ["awaitEvent"],
  identifyError: ["decideCoaching"],
  decideCoaching: ["voiceAndUi", "awaitEvent"],
  voiceAndUi: ["awaitEvent"],
  awaitEvent: ["acknowledge", "adaptCoaching", "checkConfidence"],
  acknowledge: ["awaitEvent"],
  adaptCoaching: ["decideCoaching", "awaitEvent"],
};

export function createCoachState(template: MovementTemplate, ctx: { set?: number } = {}): CoachState {
  return {
    exerciseId: template.id,
    exerciseName: template.name,
    currentSet: ctx.set ?? 1,
    currentRep: 0,
    currentPhase: "setup",
    confidence: "LOW",
    currentErrors: [],
    previousErrors: [],
    lastFeedback: null,
    correctionAttempts: 0,
    correctionStatus: "none",
    movementMetrics: { lastRom: 0, lastRepMs: 0 },
    sessionMetrics: { counted: 0, valid: 0, invalid: 0, partial: 0, corrections: { attempted: 0, succeeded: 0 } },
    issues: {},
    camera: null,
    cue: null,
    voice: initialVoiceState(),
    pending: null,
    llm: { usedThisSet: 0, lastAt: -Infinity },
    paused: false,
    praiseCount: 0,
    repsBefore: 0,
    chunkTarget: 0,
    setRoms: [],
    paceNoted: false,
    attemptNo: 0,
    verdict: null,
    verdictSeq: 0,
    streak: 0,
    notCountedInChunk: 0,
    validInChunk: 0,
    suggestDemo: false,
    offerFinish: false,
    attemptMarks: [],
  };
}

const PRAISE = ["Nice rep. Keep that form.", "Good control on that one.", "Smooth and steady. Keep going."];

interface Ctx {
  s: CoachState;
  fx: CoachEffect[];
  template: MovementTemplate;
  cfg: CoachConfig;
  llmEnabled: boolean;
  now: number;
}

// ── Reducer ────────────────────────────────────────────────────────────────────

export function reduceCoach(prev: CoachState, input: CoachInput, template: MovementTemplate, opts: CoachOptions): CoachResult {
  const s: CoachState = { ...prev, issues: { ...prev.issues }, sessionMetrics: { ...prev.sessionMetrics, corrections: { ...prev.sessionMetrics.corrections } } };
  const c: Ctx = { s, fx: [], template, cfg: opts.config ?? COACH_CONFIG, llmEnabled: opts.llmEnabled, now: input.t };

  switch (input.type) {
    case "camera_issue":
      nodeCameraGuidance(c, input.advice);
      break;
    case "camera_ok":
      s.camera = null;
      if (s.cue?.tone === "camera") clearCue(c);
      break;
    case "setup_ready":
      nodeSetupReady(c);
      break;
    case "phase_changed":
      s.currentPhase = input.phase;
      flushPending(c);
      break;
    case "movement_error":
      nodeIdentifyError(c, input);
      break;
    case "movement_corrected":
      nodeAcknowledge(c, input.error);
      break;
    case "rep_completed":
      nodeRepOutcome(c, input);
      break;
    case "rep_not_counted":
      nodeNotCounted(c, "invalid", undefined, input.reasons);
      break;
    case "partial_rep":
      nodeNotCounted(c, "partial", input.almost);
      break;
    case "uncertain_rep":
      nodeUncertain(c);
      break;
    case "tick":
      nodeTick(c);
      break;
    case "llm_result":
      nodeLlmResult(c, input);
      break;
    case "set_started":
      s.currentSet = input.set;
      s.currentRep = 0;
      s.repsBefore = input.repsBefore ?? 0;
      s.chunkTarget = input.targetReps ?? 0;
      s.setRoms = [];
      s.paceNoted = false;
      s.attemptNo = 0;
      s.verdict = null;
      s.streak = 0;
      s.notCountedInChunk = 0;
      s.validInChunk = 0;
      s.suggestDemo = false;
      s.offerFinish = false;
      s.attemptMarks = [];
      s.llm = { usedThisSet: 0, lastAt: s.llm.lastAt };
      s.pending = null;
      for (const k of Object.keys(s.issues)) s.issues[k] = { ...s.issues[k], active: false };
      s.currentErrors = [];
      break;
    case "set_complete":
      nodeSetComplete(c);
      break;
    case "paused":
      s.paused = input.paused;
      if (input.paused) {
        s.pending = null;
        c.fx.push({ kind: "stop_speech" });
      }
      break;
  }

  s.currentErrors = Object.values(s.issues).filter((i) => i.active).map((i) => i.code);
  return { state: s, effects: c.fx };
}

// ── Nodes ──────────────────────────────────────────────────────────────────────

function nodeCameraGuidance(c: Ctx, advice: CameraAdvice) {
  const { s } = c;
  s.camera = advice;
  s.confidence = "LOW";
  showCue(c, { text: advice.message, tone: "camera", priority: PRIORITY.camera, source: "system" });
  speakOrDefer(c, { key: `camera:${advice.code}${advice.joint ? ":" + advice.joint : ""}`, text: advice.message, kind: "camera", priority: PRIORITY.camera, phase: s.currentPhase });
}

function nodeSetupReady(c: Ctx) {
  const text = "Good starting position. Begin when you are ready.";
  c.s.confidence = "HIGH";
  if (c.s.cue?.tone === "camera") clearCue(c);
  showCue(c, { text, tone: "setup", priority: PRIORITY.setup, source: "system" });
  speakOrDefer(c, { key: "setup", text, kind: "setup", priority: PRIORITY.setup, phase: c.s.currentPhase });
}

function nodeIdentifyError(c: Ctx, e: Extract<MovementEvent, { type: "movement_error" }>) {
  const { s } = c;
  s.confidence = "HIGH";
  const key = e.error;
  const prev = s.issues[key];
  // One key per ATTEMPT (not per good rep), so several tries at the same rep count as several.
  const repKey = `${s.currentSet}.${s.repsBefore}.${s.attemptNo}`;
  const issue: IssueHistory = prev
    ? { ...prev, direction: e.direction, severity: e.severity, active: true, occurrences: prev.occurrences + 1, repsAffected: prev.repsAffected.includes(repKey) ? prev.repsAffected : [...prev.repsAffected, repKey], measured: e.measured, expected: e.expected }
    : {
        code: key,
        direction: e.direction,
        severity: e.severity,
        occurrences: 1,
        attempts: 0,
        tier: 0,
        active: true,
        lastCoachedAt: -Infinity,
        lastText: "",
        correctedCount: 0,
        repsAffected: [repKey],
        firstMeasured: e.measured,
        measured: e.measured,
        expected: e.expected,
        llmPending: false,
        observed: false,
      };
  s.issues[key] = issue;
  s.sessionMetrics.corrections.attempted++;
  s.correctionStatus = "pending";
  nodeDecideCoaching(c, issue);
}

/** Chooses the wording tier, shows and speaks it, and prefetches the next tier from the language model. */
function nodeDecideCoaching(c: Ctx, issue: IssueHistory) {
  const { s, template, now } = c;
  const priority = priorityOf(template, issue.code);
  if (!mayReplaceCue(c, priority, issue.code)) return; // a more important cue is up; this is coached later by tick

  const useLlm = issue.llmNext && issue.llmTier === issue.tier;
  const text = useLlm ? (issue.llmNext as string) : textFor(template, issue.code, issue.direction, issue.tier);
  if (!text) return;

  const next: IssueHistory = { ...issue, attempts: issue.attempts + 1, tier: issue.tier + 1, lastCoachedAt: now, lastText: text, llmNext: useLlm ? undefined : issue.llmNext };
  s.issues[issue.code] = next;
  s.correctionAttempts++;
  showCue(c, { text, tone: "correction", code: issue.code, priority, source: useLlm ? "llm" : "template" });
  speakOrDefer(c, { key: `err:${issue.code}`, text, kind: "error", priority, phase: s.currentPhase });
  prefetchLlm(c, next);
}

function prefetchLlm(c: Ctx, issue: IssueHistory) {
  const { s, cfg, now } = c;
  if (!c.llmEnabled || issue.llmPending || (issue.llmNext && issue.llmTier === issue.tier)) return;
  if (s.llm.usedThisSet >= cfg.llmMaxPerSet || now - s.llm.lastAt < cfg.llmMinGapMs) return;
  if (s.confidence === "LOW") return;
  const request = buildCueRequest(s, c.template, issue, s.confidence === "MEDIUM" ? "MEDIUM" : "HIGH");
  s.issues[issue.code] = { ...issue, llmPending: true };
  s.llm = { usedThisSet: s.llm.usedThisSet + 1, lastAt: now };
  c.fx.push({ kind: "llm", code: issue.code, tier: issue.tier, request });
}

function nodeLlmResult(c: Ctx, r: Extract<CoachInput, { type: "llm_result" }>) {
  const issue = c.s.issues[r.code];
  if (!issue) return;
  c.s.issues[r.code] = { ...issue, llmPending: false, llmNext: r.text ?? undefined, llmTier: r.text ? r.tier : undefined };
}

function nodeAcknowledge(c: Ctx, code: string) {
  const { s, template, now } = c;
  const issue = s.issues[code];
  if (!issue) return;
  s.issues[code] = { ...issue, active: false, correctedCount: issue.correctedCount + 1 };
  s.sessionMetrics.corrections.succeeded++;
  s.correctionStatus = Object.values(s.issues).some((i) => i.active && i.code !== code) ? s.correctionStatus : "corrected";
  // Only acknowledge a problem the patient was actually told about.
  if (issue.attempts === 0) return;
  const text = ackFor(template, code, issue.correctedCount);
  if (s.cue && s.cue.tone === "correction" && s.cue.code !== code && isIssueActive(s, s.cue.code)) return; // another correction is still on screen
  setVerdict(c, "corrected", { code, say: text });
  s.cue = { text, tone: "praise", code, priority: PRIORITY.praise, shownAt: now, source: "template" };
  s.lastFeedback = { text, at: now, code };
  c.fx.push({ kind: "cue", cue: s.cue });
  speakOrDefer(c, { key: `ack:${code}`, text, kind: "ack", priority: PRIORITY.praise, phase: s.currentPhase });
}

function nodeRepOutcome(c: Ctx, e: Extract<MovementEvent, { type: "rep_completed" }>) {
  const { s, cfg } = c;
  // A good rep (engine v4: only good reps arrive here). It resets the run of attempts that did not count.
  s.currentRep = e.rep;
  s.sessionMetrics.counted++;
  s.sessionMetrics.valid++;
  s.attemptNo++;
  s.validInChunk++;
  s.streak = 0;
  mark(c, "good");
  s.movementMetrics = { lastRom: e.rom, lastRepMs: e.durationMs };
  // The acknowledgement of a fix arrives in the same frame as the good rep that proves it: keep showing the fix.
  if (!(s.verdict?.kind === "corrected" && s.verdict.at === c.now)) setVerdict(c, "good", e.quality ? { quality: e.quality } : {});
  checkObservations(c);

  s.setRoms = [...s.setRoms, e.rom];
  const anyActive = Object.values(s.issues).some((i) => i.active);
  if (anyActive) return;

  // At most one positive line per rep. Order: a pacing note, a milestone, "nearly there", the first good rep, then the occasional general nod.
  const pace = paceNote(s, cfg);
  if (pace) {
    s.paceNoted = true;
    positive(c, "pacing", "pacing", pace, "info");
    return;
  }
  const n = s.repsBefore + e.rep;
  const setTotal = s.repsBefore + s.chunkTarget;
  const remaining = setTotal - n;
  if (s.chunkTarget > 0 && remaining > 0) {
    if (n % cfg.milestoneEvery === 0) return positive(c, `milestone:${n}`, "milestone", `${n} done. ${MILESTONE_TAIL[(n / cfg.milestoneEvery - 1) % MILESTONE_TAIL.length]}`, "praise");
    if (remaining === 1) return positive(c, `nearly:${n}`, "milestone", "One more.", "praise");
    if (remaining === 2 && setTotal >= 6) return positive(c, `nearly:${n}`, "milestone", "Two more to go.", "praise");
  }
  if (e.valid && s.sessionMetrics.valid === 1) return positive(c, "first_rep", "milestone", "Great start.", "praise");
  if (e.valid && e.rep % 3 === 0) {
    const text = PRAISE[s.praiseCount % PRAISE.length];
    s.praiseCount++;
    positive(c, "praise", "praise", text, "praise");
  }
}

/** Shows and (when the voice policy allows) speaks one positive line. Never replaces a correction that is on screen. */
function positive(c: Ctx, key: string, kind: "praise" | "milestone" | "pacing", text: string, tone: "praise" | "info") {
  const { s, cfg } = c;
  if (!s.cue || c.now - s.cue.shownAt >= cfg.minCueDisplayMs) {
    s.cue = { text, tone, priority: PRIORITY.praise, shownAt: c.now, source: "system" };
    s.lastFeedback = { text, at: c.now };
    c.fx.push({ kind: "cue", cue: s.cue });
  }
  speakOrDefer(c, { key, text, kind, priority: PRIORITY.praise, phase: s.currentPhase });
}

/**
 * Says, objectively, that the last few movements were smaller than the first few. Never names a cause: it does not
 * say tired, weak or hurt, because the camera cannot know. Once per set, only from measured range.
 */
function paceNote(s: CoachState, cfg: CoachConfig): string | null {
  if (s.paceNoted || s.setRoms.length < cfg.paceMinReps) return null;
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const first = mean(s.setRoms.slice(0, cfg.paceWindow));
  const last = mean(s.setRoms.slice(-cfg.paceWindow));
  if (!(first > 0) || last > first * (1 - cfg.paceDropShare)) return null;
  return "Your last few movements have been smaller. Take a short rest if you need one.";
}

const MILESTONE_TAIL = ["Nice and steady.", "You’re doing well.", "Keep that pace."];
const SET_COMPLETE = ["Set complete. Take your time.", "That set is complete. Rest when you need to.", "Set complete. Well done."];

/** Persistent problems become a therapist observation: what was measured, how often. No cause. */
function checkObservations(c: Ctx) {
  const { s, cfg } = c;
  // Out of ALL attempts, good or not: a problem that came up in most tries is worth the therapist's attention.
  const total = s.sessionMetrics.counted + s.sessionMetrics.invalid + s.sessionMetrics.partial;
  for (const issue of Object.values(s.issues)) {
    if (issue.observed) continue;
    const n = issue.repsAffected.length;
    if (n >= cfg.observationMinReps && n / Math.max(total, 1) >= cfg.observationMinShare) {
      s.issues[issue.code] = { ...issue, observed: true };
      c.fx.push({ kind: "observe", observation: { code: issue.code, label: labelFor(c.template, issue.code), repsAffected: n, ofReps: total } });
    }
  }
}

function mark(c: Ctx, m: AttemptMark) {
  c.s.attemptMarks = [...c.s.attemptMarks, m].slice(-24);
}

function setVerdict(c: Ctx, kind: Verdict["kind"], extra: Partial<Verdict> = {}) {
  const { s } = c;
  s.verdictSeq++;
  s.verdict = { kind, seq: s.verdictSeq, at: c.now, ...extra };
}

const NOT_COUNTED_LEAD = ["Not counted.", "That one wasn’t counted."];

/**
 * An attempt that did not count: it broke a mandatory rule (`invalid`) or fell short of the full range (`partial`).
 * It is said once, plainly and without blame, together with the ONE thing to change ("Not counted. Sit tall."), and the
 * same words are shown, spoken and captioned. It never moves the good-rep count, and the run of them feeds the gentle
 * limits below so nobody is left trying forever.
 */
function nodeNotCounted(c: Ctx, kind: "invalid" | "partial", almost?: boolean, reasons: string[] = []) {
  const { s, template } = c;
  if (kind === "invalid") s.sessionMetrics.invalid++;
  else s.sessionMetrics.partial++;
  s.attemptNo++;
  s.notCountedInChunk++;
  s.streak++;
  mark(c, kind === "partial" ? "partial" : "not_counted");

  // The one thing to change: the most important of what was flagged, else the range rule for an attempt that fell short.
  const codes = kind === "partial" ? [template.repRules.range.id] : reasons.length ? reasons : [];
  const code = [...codes].sort((a, b) => priorityOf(template, a) - priorityOf(template, b))[0];
  const found = code ? findRule(template, code) : null;
  const dir: "low" | "high" = (code && s.issues[code]?.direction) || (kind === "partial" ? "low" : "high");
  const show = (code && showFor(template, code, dir)) || (kind === "partial" ? (almost ? "A little farther" : "Go a bit further") : "Try that one again");
  const lead = kind === "partial" ? "Not counted." : NOT_COUNTED_LEAD[(s.verdictSeq + 1) % NOT_COUNTED_LEAD.length];
  const say = `${lead} ${show}.`;
  setVerdict(c, kind === "partial" ? "partial" : "not_counted", { ...(almost !== undefined ? { almost } : {}), show, say, ...(code ? { code } : {}) });
  checkObservations(c);

  // This one message replaces the correction that was waiting to be spoken for the same fault, so the patient hears it once.
  if (code && found) {
    if (s.pending?.candidate.key === `err:${code}`) s.pending = null;
    const issue = s.issues[code];
    if (issue) s.issues[code] = { ...issue, attempts: issue.attempts + 1, lastCoachedAt: c.now, tier: issue.tier + 1 };
  }
  speakOrDefer(c, { key: `verdict:${s.verdictSeq}`, text: say, kind: "verdict", priority: PRIORITY.major, phase: s.currentPhase });
  nodeTrapSafety(c);
}

/** A cycle the camera could not judge: not counted, never called wrong, never held against the patient. */
function nodeUncertain(c: Ctx) {
  const say = "I couldn’t see that one clearly. Let’s try it again.";
  mark(c, "uncertain");
  setVerdict(c, "uncertain", { show: "Let’s try it again", say });
  speakOrDefer(c, { key: "uncertain", text: say, kind: "verdict", priority: PRIORITY.range, phase: c.s.currentPhase });
}

/**
 * Because only good reps credit the set, someone who physically cannot do the movement yet must not be left trying
 * without end, and must never be blamed. After a few attempts in a row that did not count: point to the guide. After
 * more: suggest a rest and offer to finish for today (which keeps the good reps and tells the therapist, plainly).
 */
function nodeTrapSafety(c: Ctx) {
  const { s, cfg } = c;
  if (!s.suggestDemo && s.streak >= cfg.trapSimplifyStreak) {
    s.suggestDemo = true;
    speakOrDefer(c, { key: "suggest_demo", text: "Take your time. The guide can show you how this one goes.", kind: "pacing", priority: PRIORITY.range, phase: s.currentPhase });
  }
  const struggling = s.streak >= cfg.trapRestStreak || (s.notCountedInChunk >= cfg.trapMinNotCounted && s.notCountedInChunk >= cfg.trapNotCountedRatio * Math.max(1, s.validInChunk));
  if (!s.offerFinish && struggling) {
    s.offerFinish = true;
    const text = "Let’s take a short rest. You can finish here for today if you’d like.";
    showCue(c, { text, tone: "info", priority: PRIORITY.praise, source: "system" }, true);
    speakOrDefer(c, { key: "offer_finish", text, kind: "pacing", priority: PRIORITY.major, phase: s.currentPhase });
  }
}

function nodeSetComplete(c: Ctx) {
  const text = SET_COMPLETE[Math.max(0, c.s.currentSet - 1) % SET_COMPLETE.length];
  c.s.pending = null;
  showCue(c, { text, tone: "praise", priority: PRIORITY.praise, source: "system" }, true);
  speakOrDefer(c, { key: "set_complete", text, kind: "ack", priority: PRIORITY.praise, phase: "rest" });
}

/** How long each result stays up: long enough to read and act on, never longer than useful. */
function verdictTtl(kind: Verdict["kind"], cfg: CoachConfig): number {
  return kind === "good" ? cfg.verdictGoodMs : kind === "corrected" ? 2000 : kind === "uncertain" ? 3000 : cfg.verdictNotCountedMs;
}

/** Called a couple of times a second, never per frame: expiry, retries, and adaptive escalation. */
function nodeTick(c: Ctx) {
  const { s, cfg, now } = c;
  if (s.paused) return;

  if (s.verdict && now - s.verdict.at >= verdictTtl(s.verdict.kind, cfg)) s.verdict = null;

  if (s.cue) {
    const age = now - s.cue.shownAt;
    const ttl = s.cue.tone === "praise" ? cfg.ackDisplayMs : cfg.minCueDisplayMs;
    const stillAbout = s.cue.code ? isIssueActive(s, s.cue.code) : s.cue.tone === "camera" && s.camera !== null;
    // One or the other: clearing the cue above leaves nothing to inspect (a long gap between ticks, such as
    // resuming after a pause, used to read `tone` of a cue that had just been cleared and throw).
    if (age >= ttl && !stillAbout && s.cue.tone !== "setup") clearCue(c);
    else if (age >= ttl * 2 && s.cue.tone === "setup") clearCue(c);
  }

  flushPending(c);

  if (s.confidence === "LOW" || s.camera) return;
  const active = Object.values(s.issues).filter((i) => i.active).sort((a, b) => priorityOf(c.template, a.code) - priorityOf(c.template, b.code) || b.lastCoachedAt - a.lastCoachedAt);
  const top = active[0];
  if (!top) return;
  const sinceCoached = now - top.lastCoachedAt;
  if (top.attempts === 0 && (!s.cue || !isIssueActive(s, s.cue.code))) nodeDecideCoaching(c, top);
  else if (top.attempts > 0 && sinceCoached >= cfg.voiceRepeatCooldownMs) {
    if (top.attempts >= 2) s.correctionStatus = "persisting";
    nodeDecideCoaching(c, top); // adaptCoaching: the tier advanced when it was last coached
  }
}

// ── Cue and voice plumbing ─────────────────────────────────────────────────────

const isIssueActive = (s: CoachState, code?: string) => (code ? Boolean(s.issues[code]?.active) : false);

function mayReplaceCue(c: Ctx, priority: number, code?: string): boolean {
  const { s, cfg, now } = c;
  const cur = s.cue;
  if (!cur) return true;
  if (cur.code && cur.code === code) return true;
  if (cur.tone === "camera") return false;
  if (priority < cur.priority) return true;
  const age = now - cur.shownAt;
  if (age >= cfg.minCueDisplayMs && !isIssueActive(s, cur.code)) return true;
  return cur.tone === "praise" || cur.tone === "setup" || cur.tone === "info";
}

function showCue(c: Ctx, partial: Omit<Cue, "shownAt">, force = false) {
  const { s, now } = c;
  if (!force && s.cue && s.cue.text === partial.text && s.cue.tone === partial.tone) return;
  s.cue = { ...partial, shownAt: now };
  s.lastFeedback = { text: partial.text, at: now, code: partial.code };
  c.fx.push({ kind: "cue", cue: s.cue });
}

function clearCue(c: Ctx) {
  if (!c.s.cue) return;
  c.s.cue = null;
  c.fx.push({ kind: "clear_cue" });
}

function speakOrDefer(c: Ctx, cand: SpeechCandidate) {
  const { s, now, cfg } = c;
  if (s.paused) return;
  const d = decideSpeech(s.voice, cand, now, cfg);
  if (d.speak) {
    s.voice = d.next;
    s.pending = s.pending?.candidate.key === cand.key ? null : s.pending;
    c.fx.push({ kind: "speak", text: cand.text, interrupt: d.interrupt, key: cand.key });
  } else if (d.defer) {
    s.pending = { candidate: cand, until: now + cfg.voicePendingTtlMs };
  }
}

function flushPending(c: Ctx) {
  const { s, now } = c;
  const p = s.pending;
  if (!p) return;
  if (now > p.until) {
    s.pending = null;
    return;
  }
  // The thing it was about must still be true.
  const key = p.candidate.key;
  if (key.startsWith("err:") && !isIssueActive(s, key.slice(4))) {
    s.pending = null;
    return;
  }
  s.pending = null;
  speakOrDefer(c, { ...p.candidate, phase: s.currentPhase });
}

/** Re-exported for the UI: the default line to show when there is no active cue. */
export function defaultCue(template: MovementTemplate, s: CoachState): string {
  if (s.camera) return s.camera.message;
  if (s.currentPhase === "setup") return template.setup.instruction;
  return template.phaseCues[s.currentPhase];
}

export { observationFor };
