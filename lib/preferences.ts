const VOICE_KEY = "swasthya_voice_coach";

/** Voice coaching is on unless the person turned it off. Stored on this device only. */
export function getVoiceCoachPreference(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(VOICE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setVoiceCoachPreference(enabled: boolean): void {
  try {
    localStorage.setItem(VOICE_KEY, enabled ? "on" : "off");
  } catch {
    /* preference simply isn't remembered */
  }
}

// ── Voice and sound settings ───────────────────────────────────────────────────

const VOICE_SETTINGS_KEY = "swasthya_voice_settings";

export interface VoiceSettings {
  /** 0..1 */
  volume: number;
  /** Speaking speed. Slower than normal by default: older listeners follow it more easily. */
  rate: number;
  /** A specific installed English voice, or null for the device's default. */
  voiceURI: string | null;
  /** The voice chosen for each other language. A Hindi voice is never offered for Marathi text or the reverse, except as a fallback. */
  voiceByLang: { hi?: string; mr?: string };
  /** Keep the last few spoken lines on screen as text. */
  captions: boolean;
  /** A short burst of confetti and a soft sound when a set is finished. Off for anyone who prefers a quieter screen. */
  celebrations: boolean;
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = { volume: 1, rate: 0.9, voiceURI: null, voiceByLang: {}, captions: false, celebrations: true };

export const VOICE_RATE_RANGE = { min: 0.7, max: 1.2 } as const;

const plausibleVoice = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length < 300;

const clamp = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback;
};

/** Turns whatever was stored (or typed) into valid settings: out-of-range numbers are clamped, anything unknown is defaulted. */
export function normalizeVoiceSettings(raw: unknown): VoiceSettings {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_VOICE_SETTINGS;
  const byLang = r.voiceByLang && typeof r.voiceByLang === "object" ? (r.voiceByLang as Record<string, unknown>) : {};
  return {
    volume: Math.round(clamp(r.volume, 0, 1, d.volume) * 100) / 100,
    rate: Math.round(clamp(r.rate, VOICE_RATE_RANGE.min, VOICE_RATE_RANGE.max, d.rate) * 100) / 100,
    voiceURI: plausibleVoice(r.voiceURI) ? r.voiceURI : null,
    voiceByLang: {
      ...(plausibleVoice(byLang.hi) ? { hi: byLang.hi } : {}),
      ...(plausibleVoice(byLang.mr) ? { mr: byLang.mr } : {}),
    },
    captions: r.captions === true,
    // On unless the person turned it off: only an explicit `false` counts.
    celebrations: r.celebrations !== false,
  };
}

export function getVoiceSettings(): VoiceSettings {
  if (typeof window === "undefined") return DEFAULT_VOICE_SETTINGS;
  try {
    const raw = localStorage.getItem(VOICE_SETTINGS_KEY);
    return normalizeVoiceSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT_VOICE_SETTINGS;
  }
}

export function setVoiceSettings(settings: VoiceSettings): void {
  try {
    localStorage.setItem(VOICE_SETTINGS_KEY, JSON.stringify(normalizeVoiceSettings(settings)));
  } catch {
    /* settings simply aren't remembered */
  }
}

// ── Reading distance ───────────────────────────────────────────────────────────

const VIEW_SCALE_KEY = "swasthya_view_scale";

/** How much bigger than normal the patient asked the exercise screen's text to be. The browser cannot know the screen's physical size, so the patient says. */
export const VIEW_SCALES = [1, 1.25, 1.5, 2] as const;
export type ViewScale = (typeof VIEW_SCALES)[number];

/** The closest allowed scale to whatever is given (anything unusable becomes 1). */
export function normalizeViewScale(v: unknown): ViewScale {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return VIEW_SCALES.reduce((best, s) => (Math.abs(s - n) < Math.abs(best - n) ? s : best), VIEW_SCALES[0] as ViewScale);
}

/** The chosen scale, or null when the patient has not yet checked "can you read this from where you will sit?". */
export function getViewScale(): ViewScale | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(VIEW_SCALE_KEY);
    return raw === null ? null : normalizeViewScale(raw);
  } catch {
    return null;
  }
}

export function setViewScale(scale: ViewScale): void {
  try {
    localStorage.setItem(VIEW_SCALE_KEY, String(normalizeViewScale(scale)));
  } catch {
    /* the choice is simply not remembered */
  }
}

// ── Hands-free rest ────────────────────────────────────────────────────────────

const START_FOR_ME_KEY = "swasthya_start_for_me";

/** After a rest, start the next set by itself after this many seconds (always through the 3·2·1). 0 means never, which is the default. */
export const START_FOR_ME_OPTIONS = [0, 30, 60] as const;
export type StartForMe = (typeof START_FOR_ME_OPTIONS)[number];

export function normalizeStartForMe(v: unknown): StartForMe {
  const n = Number(v);
  return (START_FOR_ME_OPTIONS as readonly number[]).includes(n) ? (n as StartForMe) : 0;
}

export function getStartForMe(): StartForMe {
  if (typeof window === "undefined") return 0;
  try {
    return normalizeStartForMe(localStorage.getItem(START_FOR_ME_KEY));
  } catch {
    return 0;
  }
}

export function setStartForMe(seconds: StartForMe): void {
  try {
    localStorage.setItem(START_FOR_ME_KEY, String(normalizeStartForMe(seconds)));
  } catch {
    /* the choice is simply not remembered */
  }
}

// ── Sidebar ────────────────────────────────────────────────────────────────────

const SIDEBAR_KEY = "swasthya_sidebar_collapsed";

/** The desktop sidebar is open unless the person collapsed it. Stored on this device only. */
export function getSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(SIDEBAR_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSidebarCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
  } catch {
    /* the choice is simply not remembered */
  }
}
