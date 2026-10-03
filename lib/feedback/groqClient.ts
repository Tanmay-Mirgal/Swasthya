/**
 * groqClient.ts -- Client-side bridge to the server-side /api/feedback route.
 *
 * SECURITY: All Groq API calls go through the server route.
 * The API key lives in process.env.GROQ_API_KEY (server-side only).
 * No API key is ever exposed to the browser.
 */

import { FEEDBACK_CONFIG } from "../engine/feedbackConfig";

/**
 * Full coaching context sent to the server for dynamic Groq generation.
 * The more context provided, the more natural and contextually appropriate
 * the generated coaching cue will be.
 */
export interface FeedbackRequest {
  // ── Exercise context ──────────────────────────────────────────────────────
  exerciseId: string;
  exerciseName: string;
  stepTitle: string;
  stepInstruction: string;

  // ── Detected issue ────────────────────────────────────────────────────────
  issueCode: string;
  severity: string;
  currentValue: number;
  expectedValue: number;
  /** Human-readable description of what the rule engine observed */
  fallbackMessage: string;
  /** Template-level additional context about this specific issue */
  groqContext?: string;

  // ── Coaching memory (for intelligent non-repetitive responses) ────────────
  /**
   * The last coaching cue spoken to the patient.
   * Groq uses this to avoid verbatim repetition while staying on-message.
   */
  previousCue?: string;
  /**
   * true = this is the first time this specific issue has been confirmed.
   * false = the issue has persisted across multiple coaching cycles.
   */
  isNewIssue: boolean;
  /**
   * true = current measurement is moving toward the expected value.
   * The coach can acknowledge the improvement naturally.
   */
  isImproving: boolean;
  /**
   * How many milliseconds this issue has been confirmed present.
   * Lets the coach escalate tone for very persistent issues.
   */
  persistedMs: number;
}

interface FeedbackApiResponse {
  feedback: string | null;
  fallback: boolean;
}

/**
 * Light client-side sanity check on Groq response before using it.
 * Full validation runs on the server — this is a secondary guard.
 */
function isAcceptableCue(text: string): boolean {
  if (!text || text.trim().length === 0) return false;
  if (text.startsWith("{") || text.startsWith("[")) return false;

  const forbidden = [
    /\b(angle|degree|sensor|mediapipe|camera|landmark|coordinate|threshold|algorithm|confidence)\b/i,
    /\b(i see|it appears|you need to|please note)\b/i,
  ];
  for (const pattern of forbidden) {
    if (pattern.test(text)) return false;
  }

  const words = text.split(/\s+/).filter(Boolean);
  // Accept 2..20 words -- server validates tighter bounds; client is lenient
  if (words.length < 2 || words.length > 20) return false;
  return true;
}

/**
 * Fetches a dynamically generated coaching cue via the secure /api/feedback route.
 * Never throws -- exercise session always continues even if Groq fails.
 */
export async function fetchGroqFeedback(body: FeedbackRequest): Promise<string> {
  try {
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(FEEDBACK_CONFIG.GROQ_TIMEOUT_MS + 1000),
    });

    if (!response.ok) {
      console.warn(`[groqClient] /api/feedback returned ${response.status}`);
      return body.fallbackMessage;
    }

    const data = (await response.json()) as FeedbackApiResponse;

    if (data.fallback || !data.feedback) {
      return body.fallbackMessage;
    }

    if (!isAcceptableCue(data.feedback)) {
      console.warn(`[groqClient] Client check rejected: "${data.feedback}"`);
      return body.fallbackMessage;
    }

    return data.feedback;
  } catch (err) {
    console.warn("[groqClient] fetch failed:", err);
    return body.fallbackMessage;
  }
}
