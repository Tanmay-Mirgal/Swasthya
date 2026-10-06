import "server-only";
/**
 * lib/movement/analytics/serverReport.ts
 *
 * Asks the language model to rewrite the deterministic session report in friendlier words.
 * Server-only. Anything wrong (no key, timeout, malformed JSON, a number or phrase that is
 * not allowed) returns null and the deterministic report stands. The model can never add a
 * measurement: `acceptModelReport` rejects any number that is not already in the facts.
 */
import { acceptModelReport, REPORT_SYSTEM_PROMPT, reportUserMessage, type ReportContent, type SessionFacts } from "./sessionReport";
import type { ChatFetcher } from "../coach/serverCue";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-20b";

export interface ModelReport {
  content: ReportContent;
  model: string;
}

function extractJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const a = text.indexOf("{");
    const b = text.lastIndexOf("}");
    if (a >= 0 && b > a) {
      try {
        return JSON.parse(text.slice(a, b + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function generateModelReport(facts: SessionFacts, draft: ReportContent, opts: { fetcher?: ChatFetcher; env?: NodeJS.ProcessEnv; timeoutMs?: number } = {}): Promise<ModelReport | null> {
  const env = opts.env ?? process.env;
  const key = env.GROQ_API_KEY ?? env.NEXT_GROQ_API_KEY;
  if (env.COACH_LLM_ENABLED === "0" || !key) return null;
  const fetcher: ChatFetcher = opts.fetcher ?? ((u, init) => fetch(u, init));
  const model = env.GROQ_MODEL || DEFAULT_MODEL;
  try {
    const res = await fetcher(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: REPORT_SYSTEM_PROMPT },
          { role: "user", content: reportUserMessage(facts, draft) },
        ],
        temperature: 0.3,
        max_tokens: 1200,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 12_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string") return null;
    const accepted = acceptModelReport(extractJson(text), facts);
    return accepted ? { content: accepted, model } : null;
  } catch {
    return null;
  }
}
