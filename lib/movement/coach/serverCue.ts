import "server-only";
/**
 * lib/movement/coach/serverCue.ts
 *
 * Calls the language model (Groq) for one coaching cue. Server-only: the API key never
 * reaches the browser. Returns null for ANY problem (not configured, timeout, HTTP error,
 * a reply that fails validation), and the caller falls back to the deterministic wording.
 */
import { cleanCue } from "./cueValidation";
import { buildCuePrompt, type ParsedCueRequest } from "./cueRequest";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-20b";

export type ChatFetcher = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export function llmConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.COACH_LLM_ENABLED !== "0" && Boolean(env.GROQ_API_KEY ?? env.NEXT_GROQ_API_KEY);
}

export async function generateCue(parsed: ParsedCueRequest, opts: { fetcher?: ChatFetcher; env?: NodeJS.ProcessEnv; timeoutMs?: number } = {}): Promise<string | null> {
  const env = opts.env ?? process.env;
  const key = env.GROQ_API_KEY ?? env.NEXT_GROQ_API_KEY;
  if (env.COACH_LLM_ENABLED === "0" || !key) return null;
  const fetcher: ChatFetcher = opts.fetcher ?? ((u, init) => fetch(u, init));
  const { system, user } = buildCuePrompt(parsed);
  try {
    const res = await fetcher(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.GROQ_MODEL || DEFAULT_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.5,
        max_tokens: 80,
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 4500),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return cleanCue(data?.choices?.[0]?.message?.content);
  } catch {
    return null;
  }
}
