import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

/** Real data is absent: say what belongs here and the one thing to do next. */
export function EmptyState({ title, children, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-start gap-1 border border-dashed border-slate-300 rounded-lg px-4 py-5", className)}>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {children && <p className="max-w-prose text-sm leading-relaxed text-slate-600">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
