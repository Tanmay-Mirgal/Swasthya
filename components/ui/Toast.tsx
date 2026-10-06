"use client";

import * as React from "react";
import { CheckCircle2, Info, XOctagon } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "info" | "danger";
interface ToastItem { id: number; tone: ToastTone; message: string }

const ToastContext = React.createContext<(message: string, tone?: ToastTone) => void>(() => undefined);

export function useToast() {
  return React.useContext(ToastContext);
}

/** Polite, auto-dismissing confirmation. Errors that need action belong inline (Notice), not here. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const push = React.useCallback((message: string, tone: ToastTone = "success") => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, tone, message }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
        {items.map((t) => {
          const Icon = t.tone === "success" ? CheckCircle2 : t.tone === "danger" ? XOctagon : Info;
          return (
            <div
              key={t.id}
              className={cn(
                "pointer-events-auto flex max-w-md items-center gap-2 rounded-lg border bg-white px-3.5 py-2.5 text-sm font-medium shadow-md",
                t.tone === "success" && "border-emerald-300 text-emerald-900",
                t.tone === "info" && "border-slate-300 text-slate-900",
                t.tone === "danger" && "border-red-300 text-red-900"
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {t.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
