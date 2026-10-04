/**
 * voiceService.ts — Browser SpeechSynthesis TTS service for RehabLens.
 *
 * Architecture:
 *   Exercise feedback
 *     └─> VoiceService.speak(text, priority?)
 *           └─ Browser → window.speechSynthesis
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
 *   Call VoiceService.destroy() on unmount to release resources.
 */

export type VoicePriority = "normal" | "high";

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const VoiceService = {
  /**
   * Initialise the voice service.
   * Safe to call from any client component context.
   */
  async init(): Promise<void> {
    if (initialized) return;
    initialized = true;
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
    await browserSpeak(text);
  },

  /** Immediately stop any current speech. */
  async stop(): Promise<void> {
    browserStop();
  },

  /** Returns true if TTS is currently speaking. */
  isSpeaking(): boolean {
    return isSpeakingFlag;
  },

  /** Set the speech rate (1.0 = normal). */
  setRate(rate: number): void {
    speechRate = Math.max(0.5, Math.min(2.0, rate));
  },

  /** Release resources. Call on component unmount. */
  async destroy(): Promise<void> {
    await VoiceService.stop();
    lastSpokenText = "";
    isSpeakingFlag = false;
  },
};

export default VoiceService;
