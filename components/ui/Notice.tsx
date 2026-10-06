import { AlertTriangle, CheckCircle2, Info, XOctagon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "info" | "success" | "warning" | "danger";

const TONE: Record<Tone, { icon: typeof Info; box: string; role: "status" | "alert" }> = {
  info: { icon: Info, box: "border-slate-300 bg-slate-50 text-slate-800", role: "status" },
  success: { icon: CheckCircle2, box: "border-emerald-300 bg-emerald-50 text-emerald-900", role: "status" },
  warning: { icon: AlertTriangle, box: "border-amber-400 bg-amber-50 text-amber-900", role: "alert" },
  danger: { icon: XOctagon, box: "border-red-300 bg-red-50 text-red-900", role: "alert" },
};

interface NoticeProps {
  tone?: Tone;
  title?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

/** Inline message with an icon, a plain-language title and (ideally) what to do next. */
export function Notice({ tone = "info", title, children, action, className }: NoticeProps) {
  const { icon: Icon, box, role } = TONE[tone];
  return (
    <div role={role} className={cn("flex items-start gap-3 rounded-lg border px-3.5 py-3 text-sm", box, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold leading-snug">{title}</p>}
        {children && <div className={cn("leading-relaxed", title && "mt-0.5")}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
