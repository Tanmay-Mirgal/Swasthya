import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  /** 0..1 */
  value: number;
  /** Diameter in px. */
  size?: number;
  stroke?: number;
  className?: string;
  /** Draw the arc once when it first appears (a moment of completion), instead of changing smoothly. */
  drawIn?: boolean;
  children?: ReactNode;
}

/**
 * A quiet completion arc around a number. It only ever grows, it never flashes, and it is decorative:
 * the number inside (and the words around it) carry the meaning, so it is hidden from screen readers.
 */
export default function ProgressRing({ value, size = 136, stroke = 10, className, drawIn = false, children }: Props) {
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg aria-hidden="true" width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-200" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={drawIn ? ({ "--ring-c": c, "--ring-to": c * (1 - v) } as CSSProperties) : undefined}
          className={cn("stroke-emerald-700", drawIn ? "ring-draw" : "transition-[stroke-dashoffset] duration-500 ease-out")}
        />
      </svg>
      <div className="relative text-center">{children}</div>
    </div>
  );
}
