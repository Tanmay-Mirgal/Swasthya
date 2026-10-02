"use client";

import { useEffect, useRef, useState } from "react";
import { FeedbackMessage } from "@/lib/exercises/types";
import { Info, AlertCircle, CheckCircle2, Camera, Volume2, VolumeX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";

interface FeedbackBannerProps {
  feedback: FeedbackMessage;
}

export default function FeedbackBanner({ feedback }: FeedbackBannerProps) {
  const [isVoiceEnabled, setIsVoiceEnabled] = useState<boolean>(true);
  const lastSpokenRef = useRef<string>("");

  useEffect(() => {
    if (!isVoiceEnabled || !feedback.message) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (lastSpokenRef.current === feedback.message) return;
    lastSpokenRef.current = feedback.message;

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(feedback.message);
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Ignore audio policy restrictions
    }
  }, [feedback.message, isVoiceEnabled]);

  const getIcon = () => {
    switch (feedback.type) {
      case "success":
        return <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />;
      case "warning":
        return <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />;
      case "camera":
        return <Camera className="w-5 h-5 text-slate-600 shrink-0" />;
      default:
        return <Info className="w-5 h-5 text-blue-600 shrink-0" />;
    }
  };

  const getStyles = () => {
    switch (feedback.type) {
      case "success":
        return "bg-emerald-50 border-emerald-200";
      case "warning":
        return "bg-amber-50 border-amber-200";
      case "camera":
      default:
        return "bg-blue-50 border-blue-200";
    }
  };

  return (
    <Card className={`transition-colors ${getStyles()}`}>
      <CardContent className="p-4 flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          {getIcon()}
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Feedback
            </span>

            <button
              onClick={() => setIsVoiceEnabled((prev) => !prev)}
              className="text-slate-400 hover:text-slate-600 transition-colors"
              title={isVoiceEnabled ? "Mute Voice" : "Enable Voice"}
            >
              {isVoiceEnabled ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
            </button>
          </div>

          <p className="text-sm font-medium text-slate-900 leading-snug">
            {feedback.message}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
