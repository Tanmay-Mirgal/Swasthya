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
 */

let speaking = false;
let queued: string | null = null;
let rate = 1.0;

const supported = () => typeof window !== "undefined" && "speechSynthesis" in window;

function speakNow(text: string) {
  if (!supported()) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = rate;
  u.pitch = 1;
  u.volume = 1;
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

  destroy(): void {
    VoiceService.stop();
  },
};

export default VoiceService;
