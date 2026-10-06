"use client";

import { useEffect, useRef, useState } from "react";
import VoiceService from "@/services/voice/voiceService";
import { getVoiceCoachPreference, setVoiceCoachPreference } from "@/lib/preferences";

// Issue codes that warrant high-priority speech (safety-critical).
const SAFETY_ISSUE_CODES = new Set([
  "CAMERA_TOO_FAR",
  "CAMERA_TOO_CLOSE",
  "LANDMARK_NOT_VISIBLE",
  "LOW_CONFIDENCE",
  "TRUNK_LEAN",
  "FOOT_NOT_PLANTED",
  "COMPENSATORY_MOVEMENT",
]);

/**
 * Speaks each new coaching cue once. Audio complements the on-screen text (it never adds
 * new information), and the person can mute it at any time.
 */
export function useVoiceCoach(message: string, issueCode?: string) {
  const [enabled, setEnabled] = useState(() => getVoiceCoachPreference());
  const lastSpoken = useRef("");
  const initialised = useRef(false);

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    VoiceService.init().catch(() => undefined);
    return () => {
      VoiceService.destroy().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !message || lastSpoken.current === message) return;
    lastSpoken.current = message;
    const priority = issueCode && SAFETY_ISSUE_CODES.has(issueCode) ? "high" : "normal";
    VoiceService.speak(message, priority).catch(() => undefined);
  }, [message, enabled, issueCode]);

  const toggle = () => {
    if (enabled) VoiceService.stop().catch(() => undefined);
    setVoiceCoachPreference(!enabled);
    setEnabled(!enabled);
  };

  return { voiceEnabled: enabled, toggleVoice: toggle };
}
