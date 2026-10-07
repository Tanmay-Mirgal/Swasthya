/**
 * services/voice/voicePick.ts
 *
 * Which installed speech voice should say a line in a given language. Pure, so it can be tested without a browser.
 *
 * The rule that matters: never read Hindi or Marathi with an English voice (or the reverse). A voice is chosen by
 * the language it was built for. Marathi falls back to a Hindi voice, because both are written in Devanagari and a
 * Hindi voice reads Marathi text intelligibly, which many devices cannot say for any other voice.
 */
import type { LanguageCode } from "@/lib/i18n/languages";

export interface VoiceInfo {
  voiceURI: string;
  name: string;
  /** BCP-47 tag as the engine reports it (`hi-IN`; Android uses `hi_IN`). */
  lang: string;
  localService?: boolean;
}

const tag = (lang: string) => lang.toLowerCase().replace(/_/g, "-");
/** `hi-IN` → `hi`. Some engines report three-letter codes (`hin`); those are mapped too. */
export function primaryLanguage(lang: string): string {
  const p = tag(lang).split("-")[0];
  return ({ eng: "en", hin: "hi", mar: "mr" } as Record<string, string>)[p] ?? p;
}

export function voicesFor(voices: readonly VoiceInfo[], code: LanguageCode): VoiceInfo[] {
  return voices.filter((v) => primaryLanguage(v.lang) === code);
}

/** Indian-region voices first, then ones that run on the device (they work offline and start faster). */
const quality = (v: VoiceInfo) => (tag(v.lang).endsWith("-in") ? 2 : 0) + (v.localService ? 1 : 0);
const best = (list: VoiceInfo[]) => [...list].sort((a, b) => quality(b) - quality(a))[0];

export interface VoiceChoice {
  voice: VoiceInfo | null;
  /** The language the line will be voiced in. */
  lang: LanguageCode;
  /** A Hindi voice standing in for Marathi. */
  borrowed: boolean;
}

/**
 * `preferredURI` is the person's own choice for THIS language; it is honoured only if that voice really speaks the
 * language. For English with no choice, `voice` is null: the device's default is the right answer, as before.
 */
export function chooseVoice(voices: readonly VoiceInfo[], code: LanguageCode, preferredURI?: string | null): VoiceChoice {
  const own = voicesFor(voices, code);
  const preferred = preferredURI ? own.find((v) => v.voiceURI === preferredURI) : undefined;
  if (preferred) return { voice: preferred, lang: code, borrowed: false };
  if (code === "en") return { voice: null, lang: "en", borrowed: false };
  if (own.length > 0) return { voice: best(own), lang: code, borrowed: false };
  if (code === "mr") {
    const hindi = voicesFor(voices, "hi");
    if (hindi.length > 0) return { voice: best(hindi), lang: "mr", borrowed: true };
  }
  return { voice: null, lang: code, borrowed: false };
}

export type VoiceAvailability = "own" | "borrowed" | "none" | "unknown";

/** What the settings screen should tell the person about voices for a language. `unknown` = the list has not loaded yet. */
export function availability(voices: readonly VoiceInfo[], code: LanguageCode): VoiceAvailability {
  if (code === "en") return "own";
  if (voices.length === 0) return "unknown";
  const c = chooseVoice(voices, code);
  return c.voice ? (c.borrowed ? "borrowed" : "own") : "none";
}
