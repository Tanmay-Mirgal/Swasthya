/**
 * voiceService.ts — Platform-aware TTS abstraction for RehabLens.
 *
 * Architecture:
 *   Exercise feedback
 *     └─> VoiceService.speak(text, priority?)
 *           ├─ Browser          → window.speechSynthesis
 *           └─ Capacitor Android → @capacitor-community/text-to-speech (native)
 *
 * Platform detection:
 *   Uses the Capacitor.isNativePlatform() flag at runtime.
 *   Falls back gracefully to browser TTS when the native plugin is unavailable.
 *
 * Priority levels:
 *   "normal"   — waits if something is already speaking (no overlap)
 *   "high"     — interrupts any current speech (safety corrections)
 *
 * Deduplication:
 *   Identical consecutive cues are suppressed (lastSpoken guard).
 *
 * Lifecycle:
 *   Call VoiceService.init() once (e.g. on app mount).
 *   Call VoiceService.destroy() on unmount to release native resources.
 */

// We import lazily so server-side Next.js compilation does not fail
// (Capacitor APIs are browser/native only).

export type VoicePriority = "normal" | "high";

interface SpeakOptions {
  text: string;
  priority?: VoicePriority;
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------
let isNative = false;           // set once by init()
let nativeAvailable = false;    // set once by init() after plugin load
let isSpeakingFlag = false;     // guard for overlap prevention
let lastSpokenText = "";        // deduplication guard
let speechRate = 1.0;           // coaching rate (slightly slower for clarity)
let initialized = false;

// ── Browser TTS helpers ──────────────────────────────────────────────────────

function browserStop() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
  }
  isSpeakingFlag = false;
}

function browserSpeak(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = speechRate;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.onend = () => { isSpeakingFlag = false; resolve(); };
    utterance.onerror = () => { isSpeakingFlag = false; resolve(); };
    isSpeakingFlag = true;
    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      isSpeakingFlag = false;
      resolve();
    }
  });
}

// ── Native TTS helpers (Capacitor) ──────────────────────────────────────────

// We keep a reference to the plugin module to avoid repeated dynamic imports
let _nativeTTS: typeof import("@capacitor-community/text-to-speech").TextToSpeech | null = null;

async function loadNativeTTS() {
  if (_nativeTTS) return _nativeTTS;
  try {
    const mod = await import("@capacitor-community/text-to-speech");
    _nativeTTS = mod.TextToSpeech;
    return _nativeTTS;
  } catch {
    return null;
  }
}

async function nativeStop() {
  const TTS = await loadNativeTTS();
  if (!TTS) return;
  try { await TTS.stop(); } catch { /* ignore */ }
  isSpeakingFlag = false;
}

async function nativeSpeak(text: string): Promise<void> {
  const TTS = await loadNativeTTS();
  if (!TTS) {
    // Native plugin failed to load -- fall back to browser
    await browserSpeak(text);
    return;
  }
  isSpeakingFlag = true;
  try {
    await TTS.speak({
      text,
      lang: "en-US",
      rate: speechRate,
      pitch: 1.0,
      volume: 1.0,
      category: "ambient",
    });
  } catch (err) {
    console.warn("[VoiceService] Native TTS speak error:", err);
  } finally {
    isSpeakingFlag = false;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const VoiceService = {
  /**
   * Initialise the voice service.
   * Must be called once from a client component (browser context).
   */
  async init(): Promise<void> {
    if (initialized) return;
    initialized = true;

    try {
      const { Capacitor } = await import("@capacitor/core");
      isNative = Capacitor.isNativePlatform();
    } catch {
      isNative = false;
    }

    if (isNative) {
      const TTS = await loadNativeTTS();
      if (TTS) {
        try {
          // Verify the plugin is functional -- getSupportedLanguages is a lightweight call
          await TTS.getSupportedLanguages();
          nativeAvailable = true;
          console.info("[VoiceService] Native TTS ready (Capacitor Android)");
        } catch (err) {
          console.warn("[VoiceService] Native TTS init failed, will use browser:", err);
          nativeAvailable = false;
        }
      }
    } else {
      console.info("[VoiceService] Browser TTS mode");
    }
  },

  /**
   * Speak a coaching cue.
   *
   * @param text     The text to speak.
   * @param priority "high" interrupts any current speech.
   *                 "normal" is suppressed if already speaking.
   */
  async speak(text: string, priority: VoicePriority = "normal"): Promise<void> {
    if (!text || text.trim().length === 0) return;

    // Deduplication: do not repeat identical consecutive cues
    if (text === lastSpokenText && priority !== "high") return;

    // Overlap prevention
    if (isSpeakingFlag) {
      if (priority === "normal") {
        // Do not overlap -- skip this cue
        return;
      }
      // High priority -- interrupt current speech
      await VoiceService.stop();
    }

    lastSpokenText = text;

    if (isNative && nativeAvailable) {
      await nativeSpeak(text);
    } else {
      await browserSpeak(text);
    }
  },

  /** Immediately stop any current speech. */
  async stop(): Promise<void> {
    if (isNative && nativeAvailable) {
      await nativeStop();
    } else {
      browserStop();
    }
  },

  /** Returns true if TTS is currently speaking. */
  isSpeaking(): boolean {
    return isSpeakingFlag;
  },

  /** Set the speech rate (1.0 = normal). */
  setRate(rate: number): void {
    speechRate = Math.max(0.5, Math.min(2.0, rate));
  },

  /** Release native resources. Call on component unmount. */
  async destroy(): Promise<void> {
    await VoiceService.stop();
    lastSpokenText = "";
    isSpeakingFlag = false;
    // Note: we intentionally keep initialized=true so re-mount is cheap
  },
};

export default VoiceService;
