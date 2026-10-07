"use client";

import { useCallback, useEffect, useState } from "react";
import VoiceService from "@/services/voice/voiceService";
import { useSelectedLanguage } from "@/lib/i18n/useSelectedLanguage";
import { getVoiceCoachPreference, getVoiceSettings, normalizeVoiceSettings, setVoiceCoachPreference, setVoiceSettings, type VoiceSettings } from "@/lib/preferences";

/**
 * The patient's voice choices: on or off, how loud, how fast, which voice, whether to keep captions and whether to celebrate.
 * The coach speaks in the chosen language (the language switcher, or the one on the exercise screen) and follows a change at once.
 * What is said, and when, is decided by the coaching loop (lib/movement/coach); this hook only owns the
 * switch, the settings and the speaker's lifecycle.
 */
export function useVoicePreference() {
  const [enabled, setEnabled] = useState(() => getVoiceCoachPreference());
  const [settings, setSettings] = useState<VoiceSettings>(() => getVoiceSettings());
  const language = useSelectedLanguage();

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
