"use client";

import { cn } from "@/lib/utils";

interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  id: string;
}

/** On/off setting. State is the knob position AND the words On / Off. */
export function Switch({ checked, onChange, label, description, id }: SwitchProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-semibold text-slate-900">
          {label}
        </label>
        {description && <p className="text-sm text-slate-600">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        data-compact
        onClick={() => onChange(!checked)}
        className="flex shrink-0 items-center gap-2 rounded-md py-1"
      >
        <span className="w-6 text-right text-xs font-bold text-slate-700">{checked ? "On" : "Off"}</span>
        <span className={cn("relative inline-flex h-6 w-11 rounded-full border transition-colors", checked ? "border-emerald-700 bg-emerald-600" : "border-slate-400 bg-slate-200")}>
          <span className={cn("absolute top-0.5 size-4.5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[22px]" : "translate-x-0.5")} />
        </span>
      </button>
    </div>
  );
}
