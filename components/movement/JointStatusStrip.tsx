import { Check, X } from "lucide-react";
import type { JointStatus } from "@/hooks/useMovementSession";
import { JOINT_ERROR, JOINT_OK, JOINT_UNCERTAIN } from "@/lib/movement/types";
import { cn } from "@/lib/utils";

const WORD: Record<number, string> = { [JOINT_OK]: "good", [JOINT_ERROR]: "check this", [JOINT_UNCERTAIN]: "not clear" };

/**
 * The joints this exercise watches, each with the same verdict the skeleton shows:
 * tick = fine, cross = check this, dashed ring = not clear enough to judge. Shape plus word,
 * so it does not depend on telling green from red.
 */
export function JointStatusStrip({ joints, className }: { joints: JointStatus[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-2", className)} aria-label="What the camera is checking">
      {joints.map((j) => (
        <li key={j.label} className="inline-flex items-center gap-1.5 text-sm text-slate-900">
          <span
            aria-hidden="true"
            className={cn(
              "inline-flex size-[18px] items-center justify-center rounded-full",
              j.state === JOINT_OK && "bg-emerald-600 text-white",
              j.state === JOINT_ERROR && "bg-red-600 text-white",
              j.state === JOINT_UNCERTAIN && "border-2 border-dashed border-amber-500 text-transparent",
              j.state !== JOINT_OK && j.state !== JOINT_ERROR && j.state !== JOINT_UNCERTAIN && "border border-slate-400"
            )}
          >
            {j.state === JOINT_OK && <Check className="size-3" strokeWidth={3} />}
            {j.state === JOINT_ERROR && <X className="size-3" strokeWidth={3} />}
          </span>
          <span className="font-medium">{j.label}</span>
          <span className="text-xs text-slate-600">{WORD[j.state] ?? "waiting"}</span>
        </li>
      ))}
    </ul>
  );
}
