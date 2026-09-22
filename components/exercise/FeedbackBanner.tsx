"use client";

import { useEffect, useRef, useState } from "react";
import { FeedbackMessage } from "@/lib/exercises/types";
import { Sparkles, AlertTriangle, CheckCircle2, Camera, Volume2, VolumeX, Radio } from "lucide-react";

interface FeedbackBannerProps {
  feedback: FeedbackMessage;
}

export default function FeedbackBanner({ feedback }: FeedbackBannerProps) {
  const [isVoiceEnabled, setIsVoiceEnabled] = useState<boolean>(true);
  const lastSpokenRef = useRef<string>("");

  // Real-time Text-to-Speech AI Voice Coach
  useEffect(() => {
    if (!isVoiceEnabled || !feedback.message) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    // Don't repeat the exact same sentence consecutively
    if (lastSpokenRef.current === feedback.message) return;
    lastSpokenRef.current = feedback.message;

    try {
      window.speechSynthesis.cancel(); // Cancel any ongoing speech
      const utterance = new SpeechSynthesisUtterance(feedback.message);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Ignore audio policy restrictions if user hasn't interacted yet
    }
  }, [feedback.message, isVoiceEnabled]);

  const getIcon = () => {
    switch (feedback.type) {
      case "success":
        return <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 animate-bounce" />;
      case "camera":
        return <Camera className="w-5 h-5 text-cyan-400 shrink-0" />;
      default:
        return <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />;
    }
  };

  const getStyles = () => {
    switch (feedback.type) {
      case "success":
        return "bg-emerald-950/90 border-emerald-500/50 text-emerald-100 shadow-[0_0_30px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500/30";
      case "warning":
        return "bg-amber-950/90 border-amber-500/60 text-amber-100 shadow-[0_0_35px_rgba(245,158,11,0.3)] ring-1 ring-amber-500/40 animate-pulse";
      case "camera":
        return "bg-cyan-950/90 border-cyan-500/50 text-cyan-100 shadow-[0_0_30px_rgba(6,182,212,0.25)] ring-1 ring-cyan-500/30";
      default:
        return "bg-zinc-900/90 border-zinc-800 text-zinc-200 shadow-xl";
    }
  };

  return (
    <div
      className={`relative p-4 rounded-2xl border backdrop-blur-2xl transition-all duration-500 flex items-start gap-3.5 ${getStyles()}`}
    >
      {/* Top AI Indicator Bar */}
      <div className="p-2 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
        {getIcon()}
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800/80">
              <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
              Groq AI Coach
            </span>

            {feedback.type === "warning" && (
              <span className="text-[9px] font-extrabold uppercase px-2 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                Action Required
              </span>
            )}
          </div>

          {/* Voice Coach Toggle */}
          <button
            onClick={() => setIsVoiceEnabled((prev) => !prev)}
            type="button"
            title={isVoiceEnabled ? "Mute AI Voice Coach" : "Enable AI Voice Coach"}
            className="p-1 rounded-lg bg-black/30 hover:bg-black/50 text-zinc-400 hover:text-white transition-colors"
          >
            {isVoiceEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-zinc-500" />
            )}
          </button>
        </div>

        {/* Dynamic AI Feedback Text */}
        <p className="text-sm font-extrabold tracking-tight text-white leading-snug animate-in fade-in slide-in-from-bottom-1 duration-300">
          {feedback.message}
        </p>
      </div>
    </div>
  );
}
