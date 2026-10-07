"use client";

import { useCallback, useEffect, useState } from "react";
import VoiceService from "@/services/voice/voiceService";
import { getSelectedLanguage, type LanguageCode } from "@/lib/i18n/languages";
import { getVoiceCoachPreference, getVoiceSettings, normalizeVoiceSettings, setVoiceCoachPreference, setVoiceSettings, type VoiceSettings } from "@/lib/preferences";

/**
 * The patient's voice choices: on or off, how loud, how fast, which voice, whether to keep captions and whether to celebrate.
 * The coach speaks in the language chosen in the language switcher.
 * What is said, and when, is decided by the coaching loop (lib/movement/coach); this hook only owns the
 * switch, the settings and the speaker's lifecycle.
 */
export function useVoicePreference() {
  const [enabled, setEnabled] = useState(() => getVoiceCoachPreference());
  const [settings, setSettings] = useState<VoiceSettings>(() => getVoiceSettings());
  /** Read after mount: the choice lives in a cookie the server cannot see, so reading it during render would not match. */
  const [language, setLanguage] = useState<LanguageCode>("en");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- cookie is only readable after mount
    setLanguage(getSelectedLanguage());
  }, []);

  useEffect(() => {
    void VoiceService.init();
    return () => VoiceService.destroy();
  }, []);

  useEffect(() => {
    VoiceService.configure({ volume: settings.volume, rate: settings.rate, voiceURI: settings.voiceURI, voiceByLang: settings.voiceByLang });
  }, [settings]);

  const toggle = useCallback(() => {
    if (enabled) VoiceService.stop();
    setVoiceCoachPreference(!enabled);
    setEnabled(!enabled);
  }, [enabled]);

  const update = useCallback((patch: Partial<VoiceSettings>) => {
    setSettings((cur) => {
      const next = normalizeVoiceSettings({ ...cur, ...patch });
      setVoiceSettings(next);
      return next;
    });
  }, []);

  const setEnabledTo = useCallback((on: boolean) => {
    if (!on) VoiceService.stop();
    setVoiceCoachPreference(on);
    setEnabled(on);
  }, []);

  return { voiceEnabled: enabled, toggleVoice: toggle, setVoiceEnabled: setEnabledTo, voiceSettings: settings, updateVoiceSettings: update, language };
}
