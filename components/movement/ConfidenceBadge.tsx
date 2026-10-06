import { cn } from "@/lib/utils";
import type { ConfidenceLevel } from "@/lib/movement/types";

const LEVEL: Record<ConfidenceLevel, { bars: number; word: string; hint: string }> = {
  HIGH: { bars: 3, word: "High", hint: "I can see you clearly." },
  MEDIUM: { bars: 2, word: "Medium", hint: "I can see you well enough." },
  LOW: { bars: 1, word: "Low", hint: "I can't see you clearly yet." },
};

/** How well the camera can see the joints this exercise needs: three bars and a word. */
export function ConfidenceBadge({ level, tracking = true, className }: { level: ConfidenceLevel; tracking?: boolean; className?: string }) {
  const l = tracking ? LEVEL[level] : { bars: 0, word: "off", hint: "No one in view." };
  const low = !tracking || level === "LOW";
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm", className)} title={l.hint}>
      <span aria-hidden="true" className="flex items-end gap-[3px]">
        {[1, 2, 3].map((n) => (
          <span key={n} className={cn("w-[5px] rounded-[1px]", n <= l.bars ? (low ? "bg-amber-500" : "bg-emerald-700") : "bg-slate-300")} style={{ height: 6 + n * 4 }} />
        ))}
      </span>
      <span className="font-semibold text-slate-900">{tracking ? `Tracking ${l.word.toLowerCase()}` : "Not tracking"}</span>
      <span className="sr-only">. {l.hint}</span>
    </span>
  );
}
