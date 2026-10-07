"use client";

import { useEffect, useState } from "react";
import { Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import { LANGUAGES, getSelectedLanguage, setSelectedLanguage, type LanguageCode } from "@/lib/i18n/languages";

/** English / Hindi / Marathi, translated by the browser through Google Translate. */
export default function LanguageSwitcher({ variant = "light", className }: { variant?: "light" | "dark"; className?: string }) {
  const [value, setValue] = useState<LanguageCode>("en");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- cookie is only readable after mount
    setValue(getSelectedLanguage());
  }, []);

  return (
    <label className={cn("relative inline-flex items-center", className)} translate="no">
      <span className="sr-only">Language</span>
      <Languages
        className={cn("pointer-events-none absolute left-2.5 size-4", variant === "dark" ? "text-emerald-200" : "text-slate-600")}
        aria-hidden="true"
      />
      <select
        value={value}
        onChange={(e) => {
          const code = e.target.value as LanguageCode;
          setValue(code);
          setSelectedLanguage(code);
        }}
        className={cn(
          "h-9 cursor-pointer appearance-none rounded-lg border bg-transparent pl-8 pr-3 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
          variant === "dark"
            ? "border-emerald-700 text-emerald-50 hover:bg-emerald-800 [&>option]:text-slate-900"
            : "border-slate-300 text-slate-800 hover:bg-slate-100",
        )}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.native}
          </option>
        ))}
      </select>
    </label>
  );
}
