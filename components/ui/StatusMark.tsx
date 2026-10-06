import { Check, Minus, X, Circle, Pencil, Bot, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

/** Status = a shape + a word. Colour only reinforces. */
export type StatusKind = "done" | "pending" | "partial" | "missed" | "attention" | "info";

const KIND: Record<StatusKind, { icon: typeof Check; cls: string }> = {
  done: { icon: Check, cls: "text-emerald-700" },
  pending: { icon: Circle, cls: "text-slate-600" },
  partial: { icon: Minus, cls: "text-slate-700" },
  missed: { icon: X, cls: "text-red-700" },
  attention: { icon: AlertTriangle, cls: "text-amber-800" },
  info: { icon: Info, cls: "text-slate-700" },
};

export function StatusMark({ kind, children, className }: { kind: StatusKind; children: React.ReactNode; className?: string }) {
  const { icon: Icon, cls } = KIND[kind];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", cls, className)}>
      <Icon className="size-3.5" strokeWidth={2.4} aria-hidden="true" />
      {children}
    </span>
  );
}

/** Marks who wrote an assessment: typed toner = automated, pen = therapist. */
export function Authorship({ by, name, className }: { by: "automated" | "therapist"; name?: string; className?: string }) {
  return by === "therapist" ? (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800", className)}>
      <Pencil className="size-3.5" aria-hidden="true" /> Written by {name || "your therapist"}
    </span>
  ) : (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600", className)}>
      <Bot className="size-3.5" aria-hidden="true" /> Automated from camera
    </span>
  );
}
