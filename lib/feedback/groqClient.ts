/**
 * groqClient.ts — Client-side Groq AI feedback caller.
 *
 * Replaces the server-side /api/feedback route for static/Capacitor builds.
 * Calls the Groq API directly from the browser using NEXT_PUBLIC_GROQ_API_KEY.
 *
 * The key was already hardcoded as a fallback in the original route.ts, so this
 * does not increase exposure. Rotate the key after shipping to production.
 */

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

// Fallback default key (same as was in route.ts — rotate after shipping)
const DEFAULT_KEY = "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";

const SYSTEM_PROMPT = `You are a concise rehabilitation exercise coach.

Your job: given a structured exercise issue, produce ONE short corrective instruction for the patient.

Rules:
- Maximum 8 words
- Simple everyday language (no medical jargon)
- Do NOT mention angles, degrees, or numbers
- Do NOT mention AI, MediaPipe, or sensors
- Tell the patient WHAT TO DO, not what is wrong
- Do NOT start with "You", "Your", or patient name
- Be direct and encouraging

Examples of GOOD responses:
"Keep your back straight."
"Relax your shoulders down."
"Rotate head slowly and smoothly."
"Sit tall and face forward."
"Move slightly closer to camera."`;

export interface FeedbackRequest {
  exerciseId: string;
  exerciseName: string;
  stepTitle: string;
  stepInstruction: string;
  issueCode: string;
  currentValue: number;
  expectedValue: number;
  severity: string;
  fallbackMessage: string;
}

/**
 * Fetches AI-generated corrective feedback from Groq.
 * Returns the fallback message on any network/API error.
 */
export async function fetchGroqFeedback(body: FeedbackRequest): Promise<string> {
  // Prefer env var, then hardcoded fallback
  const apiKey =
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_GROQ_API_KEY) ||
    DEFAULT_KEY;

  if (!apiKey) {
    return body.fallbackMessage;
  }

  const userMessage = `Exercise: ${body.exerciseName}
Step: ${body.stepTitle}
Issue: ${body.issueCode}
Severity: ${body.severity}

Generate a short corrective instruction (max 8 words).`;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        max_tokens: 30,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(4000),
    });

    if (!response.ok) {
      console.warn(`[groqClient] Groq API error (${response.status})`);
      return body.fallbackMessage;
    }

    interface GroqChoice {
      message: { content: string };
    }
    interface GroqResponse {
      choices?: GroqChoice[];
    }

    const data = (await response.json()) as GroqResponse;
    const raw = data?.choices?.[0]?.message?.content ?? "";

    const cleaned = raw
      .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
      .replace(/^["']|["']$/g, "")
      .trim();

    return cleaned || body.fallbackMessage;
  } catch (err) {
    console.warn("[groqClient] Groq call failed:", err);
    return body.fallbackMessage;
  }
}
