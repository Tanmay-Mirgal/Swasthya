"use client";

import { BookOpen } from "lucide-react";
import { Authorship, Button, Dialog } from "@/components/ui";
import { ConfidenceBadge } from "@/components/movement/ConfidenceBadge";
import { JointStatusStrip } from "@/components/movement/JointStatusStrip";
import type { MovementUi } from "@/hooks/useMovementSession";

interface Props {
  open: boolean;
  onClose: () => void;
  ui: MovementUi;
  /** Therapist-written note for this exercise, shown only when it exists, with their name. */
  therapistTip?: string | null;
  therapistName?: string | null;
  onOpenGuide: () => void;
  /** The last few spoken lines. */
  captionLines: string[];
}

/** Everything that is not needed mid-movement: how well the camera sees, the joints, the measurements, the guide. Up close, behind a tap. */
export default function StageDetails({ open, onClose, ui, therapistTip, therapistName, onOpenGuide, captionLines }: Props) {
  const unit = ui.unit === "deg" ? "°" : "%";
  return (
    <Dialog open={open} onClose={onClose} title="Details" description="For when you are at the screen. Nothing here is needed while you exercise." footer={<Button size="lg" onClick={onClose}>Done</Button>}>
      <div className="flex flex-col gap-5 text-base">
        {therapistTip && (
          <div>
            <p className="hand">“{therapistTip}”</p>
            {therapistName && <p className="mt-1 text-sm text-slate-700">{therapistName}</p>}
          </div>
        )}
        <p className="text-slate-900">
          <span className="font-semibold tabular">{ui.valid}</span> good {ui.valid === 1 ? "rep" : "reps"}
          {ui.invalid > 0 && <>, <span className="font-semibold tabular">{ui.invalid}</span> not counted (a movement check)</>}
          {ui.partial > 0 && <>, <span className="font-semibold tabular">{ui.partial}</span> not counted (too short)</>}
        </p>
        <div className="flex flex-col gap-2.5">
          <ConfidenceBadge level={ui.confidence} tracking={ui.tracking} />
          <JointStatusStrip joints={ui.joints} />
        </div>
        <dl className="grid grid-cols-3 gap-3">
          <div>
            <dt className="text-slate-700">{ui.unit === "deg" ? "Angle" : "Turn"}</dt>
            <dd className="font-mono text-xl font-semibold tabular">{Number.isFinite(ui.primary) ? `${ui.primary}${unit}` : "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-700">Best range</dt>
            <dd className="font-mono text-xl font-semibold tabular">{ui.rom > 0 ? `${ui.rom}${unit}` : "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-700">Last rep</dt>
            <dd className="font-mono text-xl font-semibold tabular">{ui.lastRepSeconds > 0 ? `${ui.lastRepSeconds.toFixed(1)}s` : "—"}</dd>
          </div>
        </dl>
        {captionLines.length > 0 && (
          <div>
            <p className="font-semibold text-slate-900">What was just said</p>
            <ul className="mt-1 space-y-0.5 text-slate-800">{captionLines.map((l, i) => <li key={`${i}-${l}`}>{l}</li>)}</ul>
          </div>
        )}
        <Authorship by="automated" />
        <Button variant="outline" size="lg" onClick={onOpenGuide}><BookOpen className="size-5" aria-hidden="true" /> Open the exercise guide</Button>
      </div>
    </Dialog>
  );
}
