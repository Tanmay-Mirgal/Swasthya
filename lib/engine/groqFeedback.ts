import { ExerciseIssue, IssueCode } from "./types";

const GROQ_COOLDOWN_MS = 3000; // Don't re-request same issue within 3s
const API_ENDPOINT = "/api/feedback";

interface GroqRequest {
  exerciseId: string;
  exerciseName: string;
  stepTitle: string;
  stepInstruction: string;
  issueCode: IssueCode;
  currentValue: number;
  expectedValue: number;
  severity: string;
  fallbackMessage: string;
}

/**
 * GroqFeedbackService — debounced, non-blocking Groq feedback client.
 *
 * Design:
 *  - Tracks last issued code + timestamp
 *  - Returns null if the same issue was sent within GROQ_COOLDOWN_MS
 *  - Returns cached feedback for the same issue during cooldown
 *  - Calls /api/feedback (server-side proxy) to keep key secure
 *  - Never blocks the camera loop (all async)
 */
export class GroqFeedbackService {
  private lastIssueCode: IssueCode | null = null;
  private lastRequestMs = 0;
  private cachedFeedback = "";
  private pendingRequest: Promise<string> | null = null;

  /** Should we make a new Groq request for this issue? */
  shouldRequest(issue: ExerciseIssue, nowMs = Date.now()): boolean {
    if (this.pendingRequest !== null) return false; // already in-flight

    const sameIssue = issue.code === this.lastIssueCode;
    const withinCooldown = nowMs - this.lastRequestMs < GROQ_COOLDOWN_MS;

    if (sameIssue && withinCooldown) return false;

    return true;
  }

  /** Returns the last cached feedback synchronously (used while cooldown is active) */
  getCachedFeedback(): string {
    return this.cachedFeedback;
  }

  /**
   * Fires an async Groq request and returns a Promise<string> with the feedback.
   * Call this only when shouldRequest() returns true.
   */
  async requestFeedback(
    issue: ExerciseIssue,
    exerciseId: string,
    exerciseName: string,
    stepTitle: string,
    stepInstruction: string,
    nowMs = Date.now()
  ): Promise<string> {
    this.lastIssueCode = issue.code;
    this.lastRequestMs = nowMs;

    const body: GroqRequest = {
      exerciseId,
      exerciseName,
      stepTitle,
      stepInstruction,
      issueCode: issue.code,
      currentValue: issue.currentValue,
      expectedValue: issue.expectedValue,
      severity: issue.severity,
      fallbackMessage: issue.fallbackMessage,
    };

    const request = fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const data = (await res.json()) as { feedback?: string };
        const feedback = data.feedback ?? issue.fallbackMessage;
        this.cachedFeedback = feedback;
        return feedback;
      })
      .catch(() => {
        // Groq failed → return fallback silently
        this.cachedFeedback = issue.fallbackMessage;
        return issue.fallbackMessage;
      })
      .finally(() => {
        this.pendingRequest = null;
      });

    this.pendingRequest = request;
    return request;
  }

  /** Reset when exercise session restarts */
  reset() {
    this.lastIssueCode = null;
    this.lastRequestMs = 0;
    this.cachedFeedback = "";
    this.pendingRequest = null;
  }
}
