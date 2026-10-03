import { NextRequest, NextResponse } from "next/server";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-20b";

// SECURITY: Server-side only. Never use NEXT_PUBLIC_ prefix.
// Set GROQ_API_KEY in .env.local (server environment only).
const GROQ_API_KEY = process.env.GROQ_API_KEY ?? process.env.NEXT_GROQ_API_KEY ?? "";

// ---------------------------------------------------------------------------
// System prompt: genuine dynamic physiotherapist persona
//
// Key design decisions:
//  - Removes ALL hardcoded example sentences that would anchor the model
//  - Explicitly instructs the model to use the coaching memory fields
//  - Emphasises natural spoken variation over rigid templates
//  - Safety and accuracy always override stylistic variation
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are a real-time rehabilitation coach embedded inside a physiotherapy application called RehabLens.

Your role is to speak directly to a patient who is performing an exercise RIGHT NOW.

Think and respond exactly like an experienced human physiotherapist who is physically present in the room, watching the patient move, and offering a quick, calm, natural spoken correction.

--- WHAT REHABLENS PROVIDES YOU ---
The application has already analysed the patient's movement using computer vision. It gives you structured facts:
- The exercise being performed
- The current phase and the instruction for that phase
- A specific verified movement issue (already confirmed — do not question it)
- How serious the issue is
- Measurements (do not repeat these numbers to the patient)
- A plain-English observation
- Context about this specific issue
- The previous coaching cue you gave (if any)
- Whether this issue is new or has been persisting
- Whether the patient is getting better
- How long the issue has been present

--- YOUR RESPONSIBILITY ---
Transform this structured data into ONE natural spoken coaching cue.

You are NOT:
- analysing the movement yourself
- questioning the system's findings
- providing a diagnosis
- giving a long explanation
- reading out measurements

You ARE:
- deciding how a thoughtful human physiotherapist would naturally express this correction right now
- considering whether to be gentle, firm, encouraging, or reassuring based on context
- using different words each time when the same correction is needed again
- acknowledging improvement naturally when it is happening
- escalating tone slightly for persistent issues — but never alarming

--- DYNAMIC LANGUAGE REQUIREMENT ---
Your exact wording must be dynamically generated from the context you receive.

Do NOT use a fixed sentence for a given issue type.

The same issue can be expressed many different ways depending on:
- which exercise is being performed
- which phase the movement is in
- how severe the issue is
- whether this is the first time or the issue persists
- whether the patient is improving
- what was said last time

Vary your sentence structure, vocabulary, and tone naturally across coaching cycles.

--- COACHING MEMORY ---
If a previous cue is provided:
- Do not repeat it verbatim unless it is genuinely the simplest possible correction
- Rephrase the same physical instruction differently when possible
- If the patient is improving, acknowledge it naturally in the new cue
- If the issue persists stubbornly, you can gently add urgency

--- STYLE ---
Sound like a calm, encouraging, attentive physiotherapist. Not a chatbot. Not a robot.
Vary between: direct corrections, gentle suggestions, encouragement, reassurance.
Choose based on context — not randomly.

Short sentences. Natural spoken rhythm. No stiffness.

--- HARD RULES ---
Never mention: AI, MediaPipe, camera, pose detection, landmarks, coordinates, angles, degrees, thresholds, algorithms, sensors, models, measurements, confidence scores.
Never diagnose. Never invent symptoms or pain. Never tell the patient to push through pain.
Never give multiple unrelated corrections in one cue.
Never explain your reasoning.
Never produce markdown, JSON, labels, or prefixes.
Safety always comes first. If a critical positioning issue is confirmed, the cue must prioritise safety over style.

--- OUTPUT ---
Return exactly one coaching cue. One sentence or phrase. Spoken naturally.
Word count: flexible — prioritise natural spoken language. Typically 4-12 words.
No quotation marks. No labels. No explanation. Just the cue.`;

// ---------------------------------------------------------------------------
// Request/response types
// ---------------------------------------------------------------------------
interface FeedbackRequest {
  exerciseId: string;
  exerciseName: string;
  stepTitle: string;
  stepInstruction: string;
  issueCode: string;
  severity: string;
  currentValue: number;
  expectedValue: number;
  fallbackMessage: string;
  groqContext?: string;
  previousCue?: string;
  isNewIssue: boolean;
  isImproving: boolean;
  persistedMs: number;
}

interface GroqChoice { message: { content: string }; }
interface GroqAPIResponse { choices?: GroqChoice[]; }

// ---------------------------------------------------------------------------
// Response validation
// ---------------------------------------------------------------------------
function validateResponse(text: string): string | null {
  if (!text || text.trim().length === 0) return null;

  // Strip reasoning tags, quotes, role labels, markdown bold
  let cleaned = text
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
    .replace(/^(coach:|ai coach:|physiotherapist:|correction:|cue:|response:)\s*/i, "")
    .replace(/^["'`]|["'`]$/g, "")
    .replace(/\*\*/g, "")
    .trim();

  if (!cleaned) return null;

  // Reject JSON / markdown structures
  if (cleaned.startsWith("{") || cleaned.startsWith("[")) return null;
  if (/^#{1,6}\s/.test(cleaned)) return null;

  // Reject technical jargon that must never appear in spoken output
  const forbidden = [
    /\b(angle|degree|°|sensor|mediapipe|camera|landmark|coordinate|threshold|algorithm|confidence score)\b/i,
    /\b(i see|it appears|you need to|please note|as a|as an ai)\b/i,
    /\b(diagnos|medical condition|clinical)\b/i,
    /\b(json|markdown|```)\b/i,
  ];
  for (const re of forbidden) {
    if (re.test(cleaned)) return null;
  }

  // Word count: accept 2 to 20 words (generous -- stylistic variation is wanted)
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 20) return null;

  // Reject walls of text (> 2 sentence-ending punctuation marks)
  if ((cleaned.match(/[.!?]+/g) ?? []).length > 2) return null;

  return cleaned;
}

// ---------------------------------------------------------------------------
// Build the coaching context message sent to the model
// ---------------------------------------------------------------------------
function buildUserMessage(b: FeedbackRequest): string {
  const parts: string[] = [];

  parts.push(`Exercise: ${b.exerciseName}`);
  parts.push(`Phase: ${b.stepTitle}`);
  parts.push(`Phase instruction: ${b.stepInstruction}`);
  parts.push(`Detected issue: ${b.issueCode.replace(/_/g, " ").toLowerCase()}`);
  parts.push(`Severity: ${b.severity}`);

  if (b.groqContext) {
    parts.push(`Observation: ${b.groqContext}`);
  } else {
    parts.push(`Observation: ${b.fallbackMessage}`);
  }

  parts.push(`Issue status: ${b.isNewIssue ? "first occurrence" : "persisting"}`);
  parts.push(`Duration: ${Math.round(b.persistedMs / 1000)}s`);
  parts.push(`Trend: ${b.isImproving ? "patient is improving" : "no improvement yet"}`);

  if (b.previousCue) {
    parts.push(`Previous cue you gave: "${b.previousCue}"`);
    parts.push("Give a different phrasing unless repetition is genuinely the clearest option.");
  }

  parts.push("");
  parts.push("Your coaching cue:");

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// API route handler
// ---------------------------------------------------------------------------
export async function GET() {
  return NextResponse.json({ ok: true, service: "feedback" });
}

export async function POST(req: NextRequest) {
  if (!GROQ_API_KEY) {
    console.warn("[/api/feedback] GROQ_API_KEY not set");
    return NextResponse.json({ feedback: null, fallback: true }, { status: 200 });
  }

  let body: FeedbackRequest;
  try {
    body = (await req.json()) as FeedbackRequest;
  } catch {
    return NextResponse.json({ feedback: null, fallback: true }, { status: 200 });
  }

  const userMessage = buildUserMessage(body);
  const tStart = Date.now();

  try {
    const groqRes = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        // Higher temperature enables natural variation across cues for the same issue
        temperature: 0.5,
        max_tokens: 100,
      }),
      signal: AbortSignal.timeout(5000),
    });

    const latencyMs = Date.now() - tStart;

    if (!groqRes.ok) {
      console.warn(`[/api/feedback] Groq ${groqRes.status} (${latencyMs}ms) issue=${body.issueCode}`);
      return NextResponse.json({ feedback: null, fallback: true });
    }

    const data = (await groqRes.json()) as GroqAPIResponse;
    const raw = data?.choices?.[0]?.message?.content ?? "";
    const validated = validateResponse(raw);

    if (!validated) {
      console.warn(
        `[/api/feedback] Validation failed (${latencyMs}ms) issue=${body.issueCode} ` +
        `raw="${raw.slice(0, 100)}"`
      );
      return NextResponse.json({ feedback: null, fallback: true });
    }

    console.log(
      `[/api/feedback] ${latencyMs}ms | ${body.issueCode} | sev=${body.severity} | ` +
      `new=${body.isNewIssue} improv=${body.isImproving} | "${validated}"`
    );
    return NextResponse.json({ feedback: validated, fallback: false });

  } catch (err) {
    const latencyMs = Date.now() - tStart;
    console.error(`[/api/feedback] failed (${latencyMs}ms):`, err);
    return NextResponse.json({ feedback: null, fallback: true });
  }
}
