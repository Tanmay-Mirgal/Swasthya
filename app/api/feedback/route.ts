import { NextRequest, NextResponse } from "next/server";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-20b"; // Active, fast Groq model

const DEFAULT_GROQ_KEY = "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";

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
  const apiKey = process.env.NEXT_GROQ_API_KEY || process.env.GROQ_API_KEY || DEFAULT_GROQ_KEY;

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
Issue: ${body.issueCode}
Severity: ${body.severity}

Generate a short corrective instruction (max 8 words).`;

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
        max_tokens: 30,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(4000),
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      console.error(`[/api/feedback] Groq API error (${groqResponse.status}):`, errText);
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

    // Strip reasoning tags or quotes if returned
    const cleaned = raw
      .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
      .replace(/^["']|["']$/g, "")
      .trim();

    const feedback = cleaned || body.fallbackMessage;
    console.log(`[/api/feedback] Groq Feedback Generated: "${feedback}"`);

    return NextResponse.json({ feedback });
  } catch (err) {
    console.error("[/api/feedback] Groq call failed:", err);
    return NextResponse.json({ feedback: body.fallbackMessage });
  }
}
