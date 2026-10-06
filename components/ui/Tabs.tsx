"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: string;
  /** Count or flag shown after the label (e.g. pending items). */
  badge?: number;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  className?: string;
}

/** Accessible tab list (arrow keys, roving tabindex). Panels are rendered by the caller with role="tabpanel". */
export function Tabs({ items, value, onChange, label, className }: TabsProps) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    let next = i;
    if (e.key === "ArrowRight") next = (i + 1) % items.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    else return;
    e.preventDefault();
    onChange(items[next].id);
    refs.current[next]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className={cn("flex gap-1 overflow-x-auto border-b border-slate-300 [mask-image:linear-gradient(to_right,#000_calc(100%-2rem),transparent)] md:[mask-image:none]", className)}>
      {items.map((t, i) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={active}
            aria-controls={`panel-${t.id}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition-colors",
              active ? "border-slate-900 text-slate-900" : "border-transparent text-slate-600 hover:text-slate-900"
            )}
          >
            {t.label}
            {t.badge ? (
              <span className="rounded bg-amber-300 px-1.5 text-xs font-bold tabular text-[var(--ink)]">
                {t.badge}
                <span className="sr-only"> pending</span>
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
