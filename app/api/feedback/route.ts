import { NextRequest, NextResponse } from "next/server";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant"; // Fast, free tier

const SYSTEM_PROMPT = `You are a concise rehabilitation exercise coach.

Your job: given a structured exercise issue, produce ONE short corrective instruction for the patient.

Rules:
- Maximum 10 words
- Simple everyday language (no medical jargon)
- Do NOT mention angles, degrees, or numbers
- Do NOT mention AI, MediaPipe, or sensors
- Tell the patient WHAT TO DO, not what is wrong
- Do NOT start with "You", "Your", or the patient's name
- Be direct and encouraging

Examples of GOOD responses:
"Extend your leg a little further."
"Keep your back straight."
"Slow down and lower smoothly."
"Bring your arm all the way down."
"Move slightly closer to the camera."

Examples of BAD responses:
"Your knee angle is 142 degrees..."
"The system detected insufficient extension..."
"You should try to..."`;

interface FeedbackRequest {
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

export async function POST(req: NextRequest) {
  const apiKey = process.env.NEXT_GROQ_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { feedback: "Check your positioning." },
      { status: 200 }
    );
  }

  let body: FeedbackRequest;
  try {
    body = (await req.json()) as FeedbackRequest;
  } catch {
    return NextResponse.json({ feedback: "Adjust your position." }, { status: 200 });
  }

  const userMessage = `Exercise: ${body.exerciseName}
Step: ${body.stepTitle}
Instruction: ${body.stepInstruction}
Issue: ${body.issueCode}
Severity: ${body.severity}

Generate a single short corrective instruction (max 10 words).`;

  try {
    const groqResponse = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        max_tokens: 40,
        temperature: 0.3,
      }),
      // 4s timeout — never block the camera loop
      signal: AbortSignal.timeout(4000),
    });

    if (!groqResponse.ok) {
      throw new Error(`Groq API error: ${groqResponse.status}`);
    }

    interface GroqChoice {
      message: { content: string };
    }
    interface GroqAPIResponse {
      choices?: GroqChoice[];
    }
    const data = (await groqResponse.json()) as GroqAPIResponse;
    const raw = data?.choices?.[0]?.message?.content ?? "";
    // Strip surrounding quotes if the model added them
    const feedback = raw.replace(/^["']|["']$/g, "").trim();

    return NextResponse.json({ feedback: feedback || body.fallbackMessage });
  } catch (err) {
    // Groq failure → return fallback, never expose error to client
    console.error("[/api/feedback] Groq call failed:", err);
    return NextResponse.json({ feedback: body.fallbackMessage });
  }
}
