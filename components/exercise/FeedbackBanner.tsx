import { FeedbackMessage } from "@/lib/exercises/types";

interface FeedbackBannerProps {
  feedback: FeedbackMessage;
}

export default function FeedbackBanner({ feedback }: FeedbackBannerProps) {
  const getThemeStyles = () => {
    switch (feedback.type) {
      case "success":
        return "bg-emerald-500/10 border-emerald-500/40 text-emerald-400 dark:bg-emerald-950/80 dark:border-emerald-700/80 dark:text-emerald-300";
      case "camera":
        return "bg-amber-500/10 border-amber-500/40 text-amber-400 dark:bg-amber-950/80 dark:border-amber-700/80 dark:text-amber-300";
      case "warning":
        return "bg-rose-500/10 border-rose-500/40 text-rose-400 dark:bg-rose-950/80 dark:border-rose-700/80 dark:text-rose-300";
      case "info":
      default:
        return "bg-cyan-500/10 border-cyan-500/40 text-cyan-400 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-200";
    }
  };

  const getBadgeStyles = () => {
    switch (feedback.type) {
      case "success":
        return "bg-emerald-500 text-white shadow-emerald-900/40";
      case "camera":
        return "bg-amber-500 text-zinc-950 shadow-amber-900/40";
      case "warning":
        return "bg-rose-500 text-white shadow-rose-900/40";
      case "info":
      default:
        return "bg-cyan-600 text-white shadow-cyan-900/40";
    }
  };

  return (
    <div
      className={`w-full p-4 rounded-2xl border flex flex-col gap-2 transition-all duration-300 shadow-md backdrop-blur ${getThemeStyles()}`}
    >
      {/* Directive Header Pill */}
      {feedback.actionDirective && (
        <div className="flex items-center justify-between">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase shadow-sm ${getBadgeStyles()}`}
          >
            <span>{feedback.icon || "💡"}</span>
            <span>{feedback.actionDirective}</span>
          </span>
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        </div>
      )}

      {/* Main Guidance Text */}
      <p className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 leading-snug">
        {feedback.message}
      </p>
    </div>
  );
}
