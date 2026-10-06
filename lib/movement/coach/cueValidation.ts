/**
 * lib/movement/coach/cueValidation.ts
 *
 * Validation shared by the browser and the server for text produced by a language model.
 * A cue is spoken to a patient mid-exercise, so it must be short, plain, non-diagnostic
 * and free of measurements. Anything that fails is discarded and the deterministic
 * message is used instead.
 */
const FORBIDDEN: RegExp[] = [
  /\b(angle|degree|degrees|sensor|mediapipe|camera|landmark|coordinate|threshold|algorithm|confidence|percent|pixel)\b/i,
  /\b(diagnos\w*|injur\w*|pain|painful|hurt\w*|damage|tear|torn|arthritis|medication|medicine|prescri\w*|dose|dosage|surgery|condition|disease|syndrome)\b/i,
  /\b(push through|no pain no gain|you have|you are suffering)\b/i,
  /\b(i see|it appears|as an ai|as a language model|please note)\b/i,
  /```|json|markdown/i,
  /[<>{}\[\]]/,
  /\d/,
  /https?:|www\./i,
];

/** Returns the cleaned cue, or null when it must not be used. */
export function cleanCue(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let text = raw
    .replace(/<think(ing)?>[\s\S]*?<\/think(ing)?>/gi, "")
    .replace(/^(coach|cue|response|physiotherapist|ai coach)\s*:\s*/i, "")
    .replace(/^["'`“”]+|["'`“”]+$/g, "")
    .replace(/\*\*/g, "")
    .trim();
  if (!text) return null;
  if (/[\r\n]/.test(text)) return null;
  text = text.replace(/\s+/g, " ");
  for (const re of FORBIDDEN) if (re.test(text)) return null;
  const words = text.split(" ").filter(Boolean);
  if (words.length < 3 || words.length > 20) return null;
  if ((text.match(/[.!?]+(\s|$)/g) ?? []).length > 2) return null;
  if (!/[.!?]$/.test(text)) text += ".";
  return text;
}

/** Sanitises text that came from the client before it is placed in a prompt as data. */
export function sanitiseQuoted(raw: unknown, max = 140): string | undefined {
  if (typeof raw !== "string") return undefined;
  const s = raw.replace(/\s+/g, " ").replace(/[^\p{L}\p{N} .,'!?-]/gu, "").replace(/\s+/g, " ").trim().slice(0, max);
  return s || undefined;
}
