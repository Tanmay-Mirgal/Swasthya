import type { CSSProperties } from "react";
import type { AttemptMark } from "@/lib/movement/coach/coachState";
import type { StageGlyph } from "@/lib/movement/verdict/stageVerdict";
import { cn } from "@/lib/utils";

/**
 * The shapes that carry meaning without colour. One language everywhere: a tick is good, a cross is not counted, a
 * half-filled circle fell short, a dashed ring with a question mark could not be seen, two bars are paused.
 */
export function Glyph({ glyph, className, title, style }: { glyph: StageGlyph; className?: string; title?: string; style?: CSSProperties }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 48 48" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true} className={cn("shrink-0", className)} style={style}>
      {glyph === "check" && <path {...common} d="M10 25l9 9 19-21" />}
      {glyph === "cross" && <path {...common} d="M12 12l24 24M36 12L12 36" />}
      {glyph === "question" && (
        <>
          <path {...common} d="M17 18a7 7 0 1 1 10 6.3c-2.2 1.2-3 2.4-3 4.7" />
          <circle cx="24" cy="38" r="2.6" fill="currentColor" />
        </>
      )}
      {glyph === "pause" && <path {...common} d="M17 11v26M31 11v26" />}
      {glyph === "dots" && (
        <>
          <circle cx="12" cy="24" r="3.4" fill="currentColor" />
          <circle cx="24" cy="24" r="3.4" fill="currentColor" />
          <circle cx="36" cy="24" r="3.4" fill="currentColor" />
        </>
      )}
      {glyph === "ring" && <circle {...common} cx="24" cy="24" r="14" />}
    </svg>
  );
}

const MARK_LABEL: Record<AttemptMark, string> = { good: "good", not_counted: "not counted", partial: "not counted, fell short", uncertain: "could not be seen" };

/** One attempt: filled ring with a tick (good), ring with a cross (not counted), half-filled (fell short), dashed with a question mark (not seen). */
export function AttemptMarkIcon({ mark, size }: { mark: AttemptMark; size: number }) {
  const stroke = 4;
  const r = 20;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
      {mark === "good" && (
        <>
          <circle cx="24" cy="24" r={r} fill="#34d399" />
          <path d="M14 25l7 7 14-16" fill="none" stroke="#04281c" strokeWidth={stroke + 1} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {mark === "not_counted" && (
        <>
          <circle cx="24" cy="24" r={r} fill="none" stroke="#ff8f7a" strokeWidth={stroke} />
          <path d="M16 16l16 16M32 16L16 32" stroke="#ff8f7a" strokeWidth={stroke} strokeLinecap="round" />
        </>
      )}
      {mark === "partial" && (
        <>
          <circle cx="24" cy="24" r={r} fill="none" stroke="#ff8f7a" strokeWidth={stroke} />
          <path d="M24 4a20 20 0 0 0 0 40z" fill="#ff8f7a" />
        </>
      )}
      {mark === "uncertain" && (
        <>
          <circle cx="24" cy="24" r={r} fill="none" stroke="#f6d44b" strokeWidth={stroke} strokeDasharray="6 5" />
          <path d="M18 19a6 6 0 1 1 8.5 5.4c-1.8 1-2.5 2-2.5 3.6" fill="none" stroke="#f6d44b" strokeWidth={stroke} strokeLinecap="round" />
          <circle cx="24" cy="35" r="2.4" fill="#f6d44b" />
        </>
      )}
    </svg>
  );
}

/** What became of each attempt, in order. The big number is the credit; this is the honest record beside it. */
export function AttemptStrip({ marks, size = 30, max = 10 }: { marks: AttemptMark[]; size?: number; max?: number }) {
  const shown = marks.slice(-max);
  const counts = marks.reduce((a, m) => ({ ...a, [m]: (a[m] ?? 0) + 1 }), {} as Partial<Record<AttemptMark, number>>);
  const label = marks.length === 0 ? "No attempts yet" : (Object.keys(MARK_LABEL) as AttemptMark[]).filter((m) => counts[m]).map((m) => `${counts[m]} ${MARK_LABEL[m]}`).join(", ");
  return (
    <div role="img" aria-label={label} className="flex flex-wrap items-center gap-1.5" style={{ minHeight: size }}>
      {shown.map((m, i) => (
        <AttemptMarkIcon key={`${marks.length - shown.length + i}`} mark={m} size={size} />
      ))}
    </div>
  );
}
