import { ExerciseIssue, IssueCode } from "./types";
import { fetchGroqFeedback } from "../feedback/groqClient";

const GROQ_COOLDOWN_MS = 5000; // Cooldown 5s so AI calls do not spam and text remains readable

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

export class GroqFeedbackService {
  private lastIssueCode: IssueCode | null = null;
  private lastRequestMs = 0;
  private cachedFeedback = "";
  private pendingRequest: Promise<string> | null = null;

  shouldRequest(issue: ExerciseIssue, nowMs = Date.now()): boolean {
    if (this.pendingRequest !== null) return false;

    const sameIssue = issue.code === this.lastIssueCode;
    const withinCooldown = nowMs - this.lastRequestMs < GROQ_COOLDOWN_MS;

    if (sameIssue && withinCooldown) return false;

    return true;
  }

  getCachedFeedback(): string {
    return this.cachedFeedback;
  }

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

    // Call Groq API directly from the browser (no server route needed)
    const request = fetchGroqFeedback(body)
      .then((feedback) => {
        this.cachedFeedback = feedback;
        return feedback;
      })
      .catch(() => {
        this.cachedFeedback = issue.fallbackMessage;
        return issue.fallbackMessage;
      })
      .finally(() => {
        this.pendingRequest = null;
      });

    this.pendingRequest = request;
    return request;
  }

  reset() {
    this.lastIssueCode = null;
    this.lastRequestMs = 0;
    this.cachedFeedback = "";
    this.pendingRequest = null;
  }
}
