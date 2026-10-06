import { cn } from "@/lib/utils"

/**
 * The product's one progress glyph: pen-ticked boxes, as on a handed-out exercise sheet.
 * Used for sets x reps in a session, adherence across days, and plan completion.
 * State is a shape (tick = done, empty box = to do, dash = partly done, cross = missed),
 * never colour alone, and the whole row is described to screen readers in words.
 */
export type TickState = "done" | "todo" | "partial" | "missed";

interface TickBoxProps {
  state: TickState;
  size?: number;
  animate?: boolean;
  className?: string;
}

export function TickBox({ state, size = 20, animate = false, className }: TickBoxProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex shrink-0 items-center justify-center rounded-[3px] border", animate && "tick-animate",
        state === "done" && "border-emerald-600 bg-emerald-50 text-emerald-700",
        state === "todo" && "border-slate-400 bg-white text-transparent",
        state === "partial" && "border-slate-600 bg-white text-slate-700",
        state === "missed" && "border-red-600 bg-red-50 text-red-700",
        className
      )}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 20 20" width={size - 4} height={size - 4} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {state === "done" && <path className="tick-path" d="M4.5 10.5l3.6 3.6L15.5 5.5" />}
        {state === "partial" && <path d="M5 10h10" />}
        {state === "missed" && <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />}
      </svg>
    </span>
  );
}

interface TickRowProps {
  total: number;
  done: number;
  size?: number;
  /** Max boxes before the row wraps (keeps long rep counts tidy). */
  wrapAt?: number;
  label?: string;
  className?: string;
}

/** A single row of boxes: `done` ticked out of `total`. */
export function TickRow({ total, done, size = 18, wrapAt = 15, label, className }: TickRowProps) {
  const safeTotal = Math.max(0, Math.min(total, 60));
  const safeDone = Math.max(0, Math.min(done, safeTotal));
  return (
    <div
      role="img"
      aria-label={label ?? `${safeDone} of ${safeTotal} done`}
      className={cn("flex flex-wrap gap-1", className)}
      style={{ maxWidth: wrapAt * (size + 4) }}
    >
      {Array.from({ length: safeTotal }, (_, i) => (
        <TickBox key={i} state={i < safeDone ? "done" : "todo"} size={size} />
      ))}
    </div>
  );
}

interface SetsGridProps {
  sets: number;
  reps: number;
  /** Total reps completed so far across all sets, in order. */
  completedReps: number;
  size?: number;
  className?: string;
}

/** Sets x reps: one row per set, one box per rep. */
export function SetsGrid({ sets, reps, completedReps, size = 16, className }: SetsGridProps) {
  const rows = Math.max(0, Math.min(sets, 10));
  const cols = Math.max(0, Math.min(reps, 40));
  return (
    <div
      role="img"
      aria-label={`${Math.min(completedReps, rows * cols)} of ${rows * cols} reps done across ${rows} sets of ${cols}`}
      className={cn("inline-flex flex-col gap-1", className)}
    >
      {Array.from({ length: rows }, (_, s) => (
        <div key={s} className="flex flex-wrap items-center gap-1">
          <span className="w-5 text-xs font-medium tabular text-slate-500" aria-hidden="true">{s + 1}</span>
          {Array.from({ length: cols }, (_, r) => (
            <TickBox key={r} state={s * cols + r < completedReps ? "done" : "todo"} size={size} />
          ))}
        </div>
      ))}
    </div>
  );
}

interface WeekRowProps {
  days: { label: string; state: TickState; isToday?: boolean }[];
  className?: string;
}

/** Seven (or any number of) day boxes with labels: adherence across a week. */
export function DayTicks({ days, className }: WeekRowProps) {
  const done = days.filter((d) => d.state === "done").length;
  return (
    <ol className={cn("flex gap-2", className)} aria-label={`${done} of ${days.length} days done`}>
      {days.map((d, i) => (
        <li key={i} className="flex flex-col items-center gap-1">
          <TickBox state={d.state} size={22} />
          <span className={cn("text-xs tabular", d.isToday ? "font-bold text-slate-900" : "text-slate-500")}>
            {d.label}
            <span className="sr-only">
              {d.state === "done" ? " done" : d.state === "missed" ? " missed" : d.state === "partial" ? " partly done" : " not yet"}
              {d.isToday ? ", today" : ""}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
