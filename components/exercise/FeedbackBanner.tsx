"use client";

import { useEffect, useRef, useState } from "react";
import { FeedbackMessage } from "@/lib/exercises/types";
import {
  Info, AlertCircle, CheckCircle2, Camera,
  Volume2, VolumeX, Sparkles, Loader2
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import VoiceService from "@/lib/voice/voiceService";

// Issue codes that warrant high-priority speech (safety-critical)
const SAFETY_ISSUE_CODES = new Set([
  "CAMERA_TOO_FAR",
  "CAMERA_TOO_CLOSE",
  "LANDMARK_NOT_VISIBLE",
  "LOW_CONFIDENCE",
  "TRUNK_LEAN",
  "FOOT_NOT_PLANTED",
  "COMPENSATORY_MOVEMENT",
]);

interface FeedbackBannerProps {
  feedback: FeedbackMessage;
  /** Issue code of the current detected issue (used to determine speech priority) */
  issueCode?: string;
  /** Pass true while Groq is fetching a new cue */
  isLoading?: boolean;
}

export default function FeedbackBanner({
  feedback,
  issueCode,
  isLoading = false,
}: FeedbackBannerProps) {
  const [isVoiceEnabled, setIsVoiceEnabled] = useState<boolean>(true);
  const lastSpokenRef = useRef<string>("");
  const voiceInitialized = useRef(false);

  // Initialize VoiceService once on mount
  useEffect(() => {
    if (voiceInitialized.current) return;
    voiceInitialized.current = true;
    VoiceService.init().catch(() => {
      // Graceful -- exercise continues without voice
    });
    return () => {
      VoiceService.destroy().catch(() => {});
    };
  }, []);

  // Speak each unique message once via VoiceService
  useEffect(() => {
    if (!isVoiceEnabled || !feedback.message) return;
    if (lastSpokenRef.current === feedback.message) return;
    lastSpokenRef.current = feedback.message;

    const isSafetyCritical = issueCode ? SAFETY_ISSUE_CODES.has(issueCode) : false;
    const priority = isSafetyCritical ? "high" : "normal";

    VoiceService.speak(feedback.message, priority).catch(() => {
      // Fail silently -- exercise always continues
    });
  }, [feedback.message, isVoiceEnabled, issueCode]);

  const getIcon = () => {
    switch (feedback.type) {
      case "success":  return <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />;
      case "warning":  return <AlertCircle  className="w-5 h-5 text-amber-500  shrink-0" />;
      case "camera":   return <Camera       className="w-5 h-5 text-slate-500  shrink-0" />;
      default:         return <Info         className="w-5 h-5 text-blue-500   shrink-0" />;
    }
  };

  const getCardStyle = () => {
    switch (feedback.type) {
      case "success": return "bg-emerald-50/90 border-emerald-200/80";
      case "warning": return "bg-amber-50/90  border-amber-200/80";
      case "camera":  return "bg-slate-50/90  border-slate-200/80";
      default:        return "bg-blue-50/90   border-blue-200/80";
    }
  };

  return (
    <Card className={`transition-all duration-300 shadow-sm ${getCardStyle()}`}>
      <CardContent className="p-3.5 flex items-start gap-3">
        <div className="shrink-0 mt-0.5">{getIcon()}</div>

        <div className="flex-1 min-w-0 space-y-1">
          {/* Header: AI Coach label + status badge + voice toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-700">
                AI Coach
              </span>
              {isLoading ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold bg-blue-100/80 text-blue-700 rounded-full">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  Thinking
                </span>
              ) : (
                <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-semibold bg-emerald-100/80 text-emerald-700 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                  Live
                </span>
              )}
            </div>

            <button
              id="ai-coach-voice-toggle"
              onClick={() => {
                if (isVoiceEnabled) VoiceService.stop().catch(() => {});
                setIsVoiceEnabled((prev) => !prev);
              }}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1 -m-1 rounded-md"
              title={isVoiceEnabled ? "Mute Voice Coach" : "Enable Voice Coach"}
              aria-label={isVoiceEnabled ? "Mute Voice Coach" : "Enable Voice Coach"}
            >
              {isVoiceEnabled
                ? <Volume2  className="w-4 h-4 text-blue-500"  />
                : <VolumeX  className="w-4 h-4 text-slate-400" />
              }
            </button>
          </div>

          {/* Coaching cue text */}
          <p className="text-sm font-semibold text-slate-900 leading-snug">
            {feedback.message}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
