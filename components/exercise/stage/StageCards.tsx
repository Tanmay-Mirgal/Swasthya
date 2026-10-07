"use client";

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { Check } from "lucide-react";
import type { AttemptMark } from "@/lib/movement/coach/coachState";
import type { StageTone, StageVerdict } from "@/lib/movement/verdict/stageVerdict";
import { cn } from "@/lib/utils";
import { AttemptStrip, Glyph } from "./marks";

/** Solid panels with strong contrast (white on deep green or coral, ink on highlighter), never translucent over the body. */
const TONE: Record<StageTone, string> = {
  good: "bg-emerald-700 text-white border-emerald-300",
  bad: "bg-red-700 text-white border-red-200",
  unsure: "bg-amber-300 text-slate-900 border-amber-100",
  neutral: "bg-slate-900 text-white border-slate-500",
};

export function Card({ tone = "neutral", className, children, ...rest }: { tone?: StageTone; className?: string; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-xl border-2 p-[calc(var(--t-detail)*0.7)] shadow-none", TONE[tone], className)} {...rest}>
      {children}
    </div>
  );
}

/**
 * The verdict: one mark, one or two words, one short instruction. Re-mounts on every new verdict (key = seq) so it
 * settles in over 200 ms, which is how you can tell two of the same kind in a row apart. Polite live region.
 */
export function VerdictCard({ stage, setupProgress, children, compact = false }: { stage: StageVerdict; setupProgress?: number; children?: ReactNode; compact?: boolean }) {
  return (
    <Card tone={stage.tone} key={`${stage.kind}-${stage.seq}`} className="verdict-in" role="status" aria-live="polite" aria-atomic="true">
      <Glyph glyph={stage.glyph} className="text-current" style={{ width: compact ? "calc(var(--t-glyph) * 0.55)" : "var(--t-glyph)", height: compact ? "calc(var(--t-glyph) * 0.55)" : "var(--t-glyph)" }} />
      <p data-distance="verdict" className="mt-1 break-words font-extrabold uppercase leading-[1.05] tracking-wide" style={{ fontSize: "var(--t-verdict)" }}>
        {stage.word}
      </p>
      {stage.instruction && (
        <p data-distance="instruction" className="mt-2 font-semibold leading-tight" style={{ fontSize: compact ? "calc(var(--t-instr) * 0.75)" : "var(--t-instr)" }}>
          {stage.instruction}
        </p>
      )}
      {stage.kind === "ready" && typeof setupProgress === "number" && setupProgress > 0 && (
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-white/25" aria-hidden="true">
          <div className="h-full bg-white" style={{ width: `${Math.round(setupProgress * 100)}%` }} />
        </div>
      )}
      {children}
    </Card>
  );
}

/** The good-rep count. This number only ever moves for a good rep. */
export function ProgressCard({ good, target, marks, label = "GOOD REPS", detail, mini = false }: { good: number; target: number; marks: AttemptMark[]; label?: string; detail?: string | null; mini?: boolean }) {
  const k = mini ? 0.62 : 1;
  return (
    <Card tone="neutral" className="bg-slate-950">
      <p className="font-mono font-bold leading-none tabular text-white" style={{ fontSize: `calc(var(--t-counter) * ${k})` }} aria-label={`${good} of ${target} good reps`}>
        <span data-distance="counter">{good}</span>
        <span className="text-white/60" style={{ fontSize: "0.5em" }}> / {target}</span>
      </p>
      <p data-distance="instruction" className="mt-2 font-bold uppercase tracking-wide text-white" style={{ fontSize: `calc(var(--t-instr) * ${mini ? 0.62 : 0.8})` }}>
        {label}
      </p>
      {detail && !mini && <p className="mt-1 text-white/80" style={{ fontSize: "var(--t-detail)" }}>{detail}</p>}
      <div className="mt-3">
        <AttemptStrip marks={marks} size={mini ? 22 : 30} max={mini ? 8 : 10} />
      </div>
    </Card>
  );
}

/** A completed set, shown as a calm check and a filling bar of sets, never a celebration. */
export function SetBar({ done, total }: { done: number; total: number }) {
  return (
    <div className="flex items-center gap-2" role="img" aria-label={`${done} of ${total} sets done`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cn("h-4 flex-1 rounded-full border-2", i < done ? "border-white bg-white" : "border-white/60 bg-transparent")} />
      ))}
    </div>
  );
}

export function DoneMark({ className, style }: { className?: string; style?: CSSProperties }) {
  return <Check className={cn("shrink-0", className)} style={style} strokeWidth={4} aria-hidden="true" />;
}
