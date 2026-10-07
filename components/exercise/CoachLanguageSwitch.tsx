"use client";

import { ChevronDown, Languages } from "lucide-react";
import VoiceService from "@/services/voice/voiceService";
import { cn } from "@/lib/utils";
import { LANGUAGES, changeLanguage, type LanguageCode } from "@/lib/i18n/languages";
import { useSelectedLanguage } from "@/lib/i18n/useSelectedLanguage";

/**
 * Which language the coach speaks and writes in, changeable in the middle of an exercise. It is the same choice as the
 * language button elsewhere in the app, but it never reloads the page: the camera keeps running and nothing is lost.
 * A native select keeps it compact next to the other header buttons, and phones open their own large picker.
 */
export default function CoachLanguageSwitch({ className }: { className?: string }) {
  const language = useSelectedLanguage();
  return (
    <label className={cn("relative inline-flex items-center", className)}>
      <span className="sr-only">Coach language</span>
      <Languages className="pointer-events-none absolute left-2.5 size-4 text-slate-600" aria-hidden="true" />
      <select
        translate="no"
        value={language}
        onChange={(e) => {
          // Stop a line that is half-spoken in the old language; the next one is said in the new one.
          VoiceService.stop();
          changeLanguage(e.target.value as LanguageCode);
        }}
        className="h-10 w-full cursor-pointer appearance-none rounded-lg border border-slate-400 bg-white pl-8 pr-8 text-sm font-semibold text-slate-900 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {l.native}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 size-4 text-slate-600" aria-hidden="true" />
    </label>
  );
}
