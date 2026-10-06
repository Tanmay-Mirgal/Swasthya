"use client";

import { useCallback, useEffect, useState } from "react";
import VoiceService from "@/services/voice/voiceService";
import { getVoiceCoachPreference, setVoiceCoachPreference } from "@/lib/preferences";

/**
 * The patient's voice on/off preference. What is said, and when, is decided by the coaching
 * loop (lib/movement/coach); this hook only owns the switch and the speaker's lifecycle.
 */
export function useVoicePreference() {
  const [enabled, setEnabled] = useState(() => getVoiceCoachPreference());

  useEffect(() => {
    void VoiceService.init();
    return () => VoiceService.destroy();
  }, []);

  const toggle = useCallback(() => {
    if (enabled) VoiceService.stop();
    setVoiceCoachPreference(!enabled);
    setEnabled(!enabled);
  }, [enabled]);

  return { voiceEnabled: enabled, toggleVoice: toggle };
}
