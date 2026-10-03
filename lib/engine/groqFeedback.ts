/**
 * groqFeedback.ts
 *
 * GroqFeedbackService manages the full feedback state machine and
 * maintains short-term coaching memory for dynamic, context-aware cues.
 *
 * State transitions:
 *   IDLE
 *   -> PERSISTING   (issue confirmed present; timer running)
 *   -> IN_FLIGHT    (async Groq request fired; pose loop never blocked)
 *   -> READY        (cue stored; UI/TTS displays it)
 *   -> COOLDOWN     (same issue suppressed)
 *   -> IDLE         (issue resolved; display holds for MIN_FEEDBACK_DISPLAY_MS)
 *
 * Key guarantees:
 *  - Groq is never called on a single noisy frame (persistence gate)
 *  - Groq is never awaited inside the 30fps pose loop (fire-and-forget)
 *  - Only one concurrent Groq request per session (in-flight guard)
 *  - Highest-priority issue wins when multiple co-occur
 *  - Fallback to deterministic message on any Groq failure
 *  - Coaching memory (previousCue, trend, isNew) passed to Groq
 *  - No API keys exposed (all calls through /api/feedback)
 */

import { ExerciseIssue, IssueCode, ExerciseFeedbackRule, ExerciseTemplate } from "./types";
import { fetchGroqFeedback } from "../feedback/groqClient";
import { FEEDBACK_CONFIG, ISSUE_PRIORITY } from "./feedbackConfig";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function selectPrimaryIssue(issues: ExerciseIssue[]): ExerciseIssue | null {
  if (issues.length === 0) return null;
  return issues.slice().sort((a, b) => {
    const pa = ISSUE_PRIORITY[a.code] ?? 99;
    const pb = ISSUE_PRIORITY[b.code] ?? 99;
    return pa - pb;
  })[0];
}

function getGroqContext(
  issueCode: IssueCode,
  feedbackRules: ExerciseFeedbackRule[]
): string | undefined {
  return feedbackRules.find((r) => r.issueCode === issueCode)?.groqContext;
}

// ---------------------------------------------------------------------------
// Short-term coaching memory -- lightweight in-memory session state
// ---------------------------------------------------------------------------
interface CoachingMemory {
  issueCode: IssueCode;
  /** The last cue spoken for this issue (for rephrasing) */
  lastCue: string;
  /** First timestamp this issue was confirmed present */
  firstSeenMs: number;
  /** Measurement value the first time we recorded this issue (for trend) */
  baselineValue: number;
  /** Number of Groq requests made for this issue in this session */
  requestCount: number;
}

// ---------------------------------------------------------------------------
// GroqFeedbackService
// ---------------------------------------------------------------------------

export class GroqFeedbackService {
  // ── Persistence tracking ──────────────────────────────────────────────────
  private issueFirstSeenMs: number | null = null;
  private persistingIssueCode: IssueCode | null = null;

  // ── Cooldown tracking ─────────────────────────────────────────────────────
  private lastFeedbackIssueCode: IssueCode | null = null;
  private lastFeedbackCompletedMs = 0;

  // ── In-flight guard ───────────────────────────────────────────────────────
  private inFlight = false;

  // ── Coaching memory ───────────────────────────────────────────────────────
  private memory: CoachingMemory | null = null;

  // ── Latest cue (Groq or fallback) ─────────────────────────────────────────
  private cachedFeedback = "";

  // ── Public API ────────────────────────────────────────────────────────────

  getCachedFeedback(): string {
    return this.cachedFeedback;
  }

  /**
   * Drive this every camera frame with the current issue list.
   * Returns the current cue string (may be empty before first Groq response).
   * NEVER awaits Groq -- all async work is fire-and-forget.
   */
  onFrame(
    issues: ExerciseIssue[],
    exerciseId: string,
    exerciseName: string,
    stepTitle: string,
    stepInstruction: string,
    template: ExerciseTemplate,
    nowMs: number = Date.now()
  ): string {
    const primary = selectPrimaryIssue(issues);

    if (!primary) {
      // Issue resolved -- reset persistence; keep cached cue until display timeout clears it
      this.issueFirstSeenMs = null;
      this.persistingIssueCode = null;
      return this.cachedFeedback;
    }

    const code = primary.code;

    // ── 1. Persistence gate ───────────────────────────────────────────────────
    if (code !== this.persistingIssueCode) {
      // New issue type detected -- start persistence timer
      this.issueFirstSeenMs = nowMs;
      this.persistingIssueCode = code;
      return this.cachedFeedback;
    }

    const persistedMs = this.issueFirstSeenMs !== null ? nowMs - this.issueFirstSeenMs : 0;
    if (persistedMs < FEEDBACK_CONFIG.MIN_ISSUE_PERSISTENCE_MS) {
      return this.cachedFeedback;
    }

    // ── 2. In-flight guard ────────────────────────────────────────────────────
    if (this.inFlight) {
      return this.cachedFeedback;
    }

    // ── 3. Cooldown gate ──────────────────────────────────────────────────────
    const isSameIssue = code === this.lastFeedbackIssueCode;
    const cooldownMs = isSameIssue
      ? FEEDBACK_CONFIG.SAME_ISSUE_COOLDOWN_MS
      : FEEDBACK_CONFIG.NEW_ISSUE_COOLDOWN_MS;
    const elapsed = nowMs - this.lastFeedbackCompletedMs;

    if (elapsed < cooldownMs) {
      return this.cachedFeedback;
    }

    // ── 4. Build coaching memory ──────────────────────────────────────────────
    const isNewIssue = !isSameIssue || this.memory?.issueCode !== code;

    let isImproving = false;
    if (this.memory && this.memory.issueCode === code) {
      // "Improving" means the current measurement is moving toward the expected value
      const baseline = this.memory.baselineValue;
      const current = primary.currentValue;
      const expected = primary.expectedValue;
      // improvement = distance to expected is shrinking
      isImproving = Math.abs(current - expected) < Math.abs(baseline - expected);
    }

    if (isNewIssue) {
      this.memory = {
        issueCode: code,
        lastCue: "",
        firstSeenMs: nowMs,
        baselineValue: primary.currentValue,
        requestCount: 0,
      };
    }

    const previousCue = this.memory?.lastCue || undefined;

    // ── 5. Fire async Groq request ────────────────────────────────────────────
    this.inFlight = true;
    const groqContext = getGroqContext(code, template.feedbackRules);
    const fallback = primary.fallbackMessage;

    const requestPayload = {
      exerciseId,
      exerciseName,
      stepTitle,
      stepInstruction,
      issueCode: code,
      severity: primary.severity,
      currentValue: primary.currentValue,
      expectedValue: primary.expectedValue,
      fallbackMessage: fallback,
      groqContext,
      previousCue,
      isNewIssue,
      isImproving,
      persistedMs,
    };

    console.debug(
      `[GroqFeedback] Request: ${code} sev=${primary.severity} ` +
      `new=${isNewIssue} improv=${isImproving} ` +
      `persisted=${Math.round(persistedMs / 1000)}s` +
      (previousCue ? ` prevCue="${previousCue.slice(0, 30)}"` : "")
    );

    fetchGroqFeedback(requestPayload)
      .then((cue) => {
        this.cachedFeedback = cue;
        this.lastFeedbackIssueCode = code;
        this.lastFeedbackCompletedMs = Date.now();
        if (this.memory && this.memory.issueCode === code) {
          this.memory.lastCue = cue;
          this.memory.requestCount++;
        }
        console.debug(`[GroqFeedback] Cue ready: "${cue}"`);
      })
      .catch(() => {
        this.cachedFeedback = fallback;
        this.lastFeedbackIssueCode = code;
        this.lastFeedbackCompletedMs = Date.now();
      })
      .finally(() => {
        this.inFlight = false;
      });

    // Return currently cached cue while Groq is in flight
    return this.cachedFeedback;
  }

  /** Reset all state. Call when exercise session changes or ends. */
  reset() {
    this.issueFirstSeenMs = null;
    this.persistingIssueCode = null;
    this.lastFeedbackIssueCode = null;
    this.lastFeedbackCompletedMs = 0;
    this.inFlight = false;
    this.cachedFeedback = "";
    this.memory = null;
    console.debug("[GroqFeedback] Reset");
  }

  // ── Legacy shims (used by useExerciseEngine if still calling these) ────────

  shouldRequest(issue: ExerciseIssue, nowMs = Date.now()): boolean {
    if (this.inFlight) return false;
    const isSame = issue.code === this.lastFeedbackIssueCode;
    const cooldown = isSame
      ? FEEDBACK_CONFIG.SAME_ISSUE_COOLDOWN_MS
      : FEEDBACK_CONFIG.NEW_ISSUE_COOLDOWN_MS;
    return nowMs - this.lastFeedbackCompletedMs >= cooldown;
  }

  async requestFeedback(
    issue: ExerciseIssue,
    exerciseId: string,
    exerciseName: string,
    stepTitle: string,
    stepInstruction: string,
    nowMs = Date.now()
  ): Promise<string> {
    this.inFlight = true;
    const fallback = issue.fallbackMessage;
    try {
      const cue = await fetchGroqFeedback({
        exerciseId,
        exerciseName,
        stepTitle,
        stepInstruction,
        issueCode: issue.code,
        severity: issue.severity,
        currentValue: issue.currentValue,
        expectedValue: issue.expectedValue,
        fallbackMessage: fallback,
        isNewIssue: true,
        isImproving: false,
        persistedMs: 0,
      });
      this.cachedFeedback = cue;
      this.lastFeedbackIssueCode = issue.code;
      this.lastFeedbackCompletedMs = nowMs;
      return cue;
    } catch {
      this.cachedFeedback = fallback;
      this.lastFeedbackIssueCode = issue.code;
      this.lastFeedbackCompletedMs = nowMs;
      return fallback;
    } finally {
      this.inFlight = false;
    }
  }
}
