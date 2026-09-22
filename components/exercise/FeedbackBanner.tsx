import { FeedbackMessage } from "@/lib/exercises/types";
import { Sparkles, AlertTriangle, CheckCircle2, Camera } from "lucide-react";

interface FeedbackBannerProps {
  feedback: FeedbackMessage;
}

export default function FeedbackBanner({ feedback }: FeedbackBannerProps) {
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
        return "bg-emerald-950/85 border-emerald-500/40 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.15)]";
      case "warning":
        return "bg-amber-950/85 border-amber-500/50 text-amber-100 shadow-[0_0_20px_rgba(245,158,11,0.2)]";
      case "camera":
        return "bg-cyan-950/85 border-cyan-500/40 text-cyan-100 shadow-[0_0_20px_rgba(6,182,212,0.15)]";
      default:
        return "bg-zinc-900/90 border-zinc-800 text-zinc-200";
    }
  };

  return (
    <div
      className={`p-3.5 rounded-2xl border backdrop-blur-xl transition-all duration-300 flex items-center gap-3 ${getStyles()}`}
    >
      <div className="p-1.5 rounded-xl bg-black/30 border border-white/10 flex items-center justify-center">
        {getIcon()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 opacity-90">
            Groq AI Form Feedback
          </span>
        </div>
        <p className="text-xs font-semibold leading-snug truncate mt-0.5">
          {feedback.message}
        </p>
      </div>
    </div>
  );
}
