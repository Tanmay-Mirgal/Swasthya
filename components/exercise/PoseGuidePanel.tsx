"use client";

import Image from "next/image";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { exerciseGuideImage } from "@/lib/exercises/presentation";

interface PoseGuidePanelProps {
  exerciseId: string;
  exerciseName: string;
  instructions: string[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

/** How to do the exercise: reference photo, numbered steps, and the one safety rule. */
export default function PoseGuidePanel({ exerciseId, exerciseName, instructions, isOpen, onOpenChange }: PoseGuidePanelProps) {
  const image = exerciseGuideImage(exerciseId);
  return (
    <Dialog
      open={isOpen}
      onClose={() => onOpenChange(false)}
      title={exerciseName}
      description="How to do this exercise"
      footer={<Button onClick={() => onOpenChange(false)}>Back to exercise</Button>}
    >
      <div className="space-y-4">
        {image && (
          <Image src={image} alt={`${exerciseName}: reference positions`} width={640} height={480} className="w-full rounded-md border border-slate-300 object-cover" />
        )}
        <ol className="space-y-2.5">
          {instructions.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed text-slate-800">
              <span className="w-5 shrink-0 text-right font-mono font-semibold text-slate-500 tabular">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <p className="border-t border-slate-200 pt-3 text-sm text-slate-700">
          <span className="highlight font-semibold">Stop if you feel sharp pain.</span> Move slowly and smoothly; control matters more than speed.
        </p>
      </div>
    </Dialog>
  );
}
