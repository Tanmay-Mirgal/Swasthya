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
