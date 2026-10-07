/**
 * voiceService.ts: browser SpeechSynthesis for the exercise coach.
 *
 * This is only the speaker. WHETHER something should be said (cooldowns, priority,
 * duplicates, movement phase) is decided upstream by lib/movement/coach/voicePolicy. Here:
 *
 *   - one utterance at a time
 *   - a cue that arrives while speaking waits in a single slot (the latest wins; stale cues
 *     are dropped instead of piling up)
 *   - `interrupt` cuts off the current speech, for something more important
 *   - everything fails silently: no voice is never an error
 *   - the line is voiced in the language the person chose (Hindi is spoken by a Hindi voice, in Hindi). A line with no
 *     reviewed translation, or a device with no voice for the language, falls back to English with an English voice
 *     rather than reading Devanagari with the wrong voice. `prepare` says what will really be spoken, so captions match.
 */
import { getSelectedLanguage, languageInfo, type LanguageCode } from "@/lib/i18n/languages";
import { localizeSpoken } from "@/lib/i18n/spoken";
import { availability, chooseVoice, primaryLanguage, type VoiceAvailability, type VoiceInfo } from "./voicePick";

let speaking = false;
let queued: string | null = null;
let rate = 0.9;
let volume = 1;
/** The English voice choice (kept under its original name) and the choice for each other language. */
let voiceURI: string | null = null;
let voiceByLang: { hi?: string; mr?: string } = {};
let primed = false;

const supported = () => typeof window !== "undefined" && "speechSynthesis" in window;

function installed(): (VoiceInfo & { native: SpeechSynthesisVoice })[] {
  if (!supported()) return [];
  try {
    return window.speechSynthesis.getVoices().map((v) => ({ voiceURI: v.voiceURI, name: v.name, lang: v.lang, localService: v.localService, native: v }));
  } catch {
    return [];
  }
}

export interface Prepared {
  /** What will actually be spoken (and what captions should show). */
  text: string;
  /** The language it is spoken in. */
  lang: LanguageCode;
  voice: SpeechSynthesisVoice | null;
}

/** Decides the words and the voice for a line the coach wrote in English. */
function prepare(text: string): Prepared {
  const want = getSelectedLanguage();
  const voices = installed();
  const nativeOf = (uri: string | undefined) => voices.find((v) => v.voiceURI === uri)?.native ?? null;
  const english = (): Prepared => ({ text, lang: "en", voice: nativeOf(chooseVoice(voices, "en", voiceURI).voice?.voiceURI) });
  if (want === "en") return english();
  const local = localizeSpoken(text, want);
  if (local === null) return english();
  // Voices load a moment after the page does. Until they have, trust the engine to pick one from the language tag.
  if (voices.length === 0) return { text: local, lang: want, voice: null };
  const c = chooseVoice(voices, want, voiceByLang[want as "hi" | "mr"]);
  return c.voice ? { text: local, lang: want, voice: nativeOf(c.voice.voiceURI) } : english();
}

function speakNow(text: string) {
  if (!supported()) return;
  const p = prepare(text);
  const u = new SpeechSynthesisUtterance(p.text);
  u.rate = rate;
  u.pitch = 1;
  u.volume = volume;
  if (p.voice) {
    u.voice = p.voice;
    u.lang = p.voice.lang;
  } else if (p.lang !== "en") {
    u.lang = languageInfo(p.lang).speech;
  }
  const done = () => {
    speaking = false;
    if (queued) {
      const next = queued;
      queued = null;
      speakNow(next);
    }
  };
  u.onend = done;
  u.onerror = done;
  speaking = true;
  try {
    window.speechSynthesis.speak(u);
  } catch {
    speaking = false;
  }
}

export const VoiceService = {
  isSupported: supported,

  async init(): Promise<void> {
    /* nothing to prepare for the browser engine; kept so callers have one lifecycle */
  },

  speak(text: string, opts: { interrupt?: boolean } = {}): void {
    if (!text || !text.trim() || !supported()) return;
    if (speaking) {
      if (opts.interrupt) {
        queued = null;
        try {
          window.speechSynthesis.cancel();
        } catch {
          /* ignore */
        }
        speaking = false;
        speakNow(text);
      } else {
        queued = text;
      }
      return;
    }
    speakNow(text);
  },

  /** The words that will really be spoken for `text` (translated when it can be), for captions and settings. */
  prepare(text: string): { text: string; lang: LanguageCode } {
    const p = prepare(text);
    return { text: p.text, lang: p.lang };
  },

  stop(): void {
    queued = null;
    speaking = false;
    if (supported()) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    }
  },

  isSpeaking: () => speaking,

  setRate(r: number) {
    rate = Math.max(0.5, Math.min(2, r));
  },

  /** Volume 0..1, speed, and the optional chosen voices. Applies to the next thing said. */
  configure(o: { volume?: number; rate?: number; voiceURI?: string | null; voiceByLang?: { hi?: string; mr?: string } }) {
    if (o.volume !== undefined) volume = Math.max(0, Math.min(1, o.volume));
    if (o.rate !== undefined) rate = Math.max(0.5, Math.min(2, o.rate));
    if (o.voiceURI !== undefined) voiceURI = o.voiceURI;
    if (o.voiceByLang !== undefined) voiceByLang = o.voiceByLang;
  },

  /** Voices installed on this device that speak `lang` (English by default), for the settings list. Some browsers fill this in a moment after load. */
  getVoices(lang: LanguageCode = "en"): { voiceURI: string; name: string; lang: string }[] {
    return installed()
      .filter((v) => chooseVoiceCandidates(lang).includes(primaryLanguage(v.lang)))
      .map((v) => ({ voiceURI: v.voiceURI, name: v.name, lang: v.lang }));
  },

  /** Can this device voice `lang`? `borrowed` = Marathi read by a Hindi voice; `none` = it will be spoken in English. */
  availability(lang: LanguageCode): VoiceAvailability {
    return availability(installed(), lang);
  },

  /**
   * Some browsers (iOS Safari especially) only allow speech after a tap. Call this from a button press and every
   * later cue can be spoken. It makes no sound.
   */
  prime() {
    if (primed || !supported()) return;
    primed = true;
    try {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      window.speechSynthesis.speak(u);
    } catch {
      primed = false;
    }
  },

  destroy(): void {
    VoiceService.stop();
  },
};

/** The language codes whose voices belong in the picker for `lang`: its own, and for Marathi also Hindi (the fallback). */
function chooseVoiceCandidates(lang: LanguageCode): string[] {
  return lang === "mr" ? ["mr", "hi"] : [lang];
}

export default VoiceService;
