"use client";

import { useState } from "react";
import { Button, Dialog, Field, Notice, Textarea, TickBox } from "@/components/ui";
import { cn } from "@/lib/utils";

export type Assessment = "on_track" | "needs_work" | "concern";

export const ASSESSMENT_LABEL: Record<Assessment, string> = {
  on_track: "On track",
  needs_work: "Needs work",
  concern: "Concern",
};

const OPTIONS: { id: Assessment; label: string; help: string }[] = [
  { id: "on_track", label: "On track", help: "Movement and effort look appropriate." },
  { id: "needs_work", label: "Needs work", help: "Form or range needs coaching." },
  { id: "concern", label: "Concern", help: "Follow up with the patient soon." },
];

interface Props {
  open: boolean;
  onClose: () => void;
  exerciseName: string;
  initialAssessment?: Assessment;
  initialNote?: string;
  onSave: (assessment: Assessment | undefined, note: string) => Promise<string | null>;
}

/** The therapist's own assessment sits beside, never over, the automated measurements. */
export default function SessionReviewDialog({ open, onClose, exerciseName, initialAssessment, initialNote, onSave }: Props) {
  const [assessment, setAssessment] = useState<Assessment | undefined>(initialAssessment);
  const [note, setNote] = useState(initialNote ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    const err = await onSave(assessment, note);
    setSaving(false);
    if (err) setError(err);
    else onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Your assessment"
      description={`${exerciseName}. The camera’s measurements stay as recorded; this is your clinical judgement.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || (!assessment && !note.trim())}>{saving ? "Saving…" : "Save assessment"}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div role="radiogroup" aria-label="Assessment" className="divide-y divide-slate-200 border-y border-slate-300">
          {OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={assessment === o.id}
              onClick={() => setAssessment(o.id)}
              className={cn("flex w-full items-start gap-3 px-1 py-3 text-left hover:bg-slate-50", assessment === o.id && "bg-emerald-50")}
            >
              <TickBox state={assessment === o.id ? "done" : "todo"} size={20} className="mt-0.5" />
              <span>
                <span className="block font-semibold text-slate-900">{o.label}</span>
                <span className="block text-sm text-slate-600">{o.help}</span>
              </span>
            </button>
          ))}
        </div>
        <Field label="Note for the patient and your records" htmlFor="review-note" hint="Written in your name. Patients see this in handwriting style on their session.">
          <Textarea id="review-note" rows={4} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {error && <Notice tone="danger" title={error} />}
      </div>
    </Dialog>
  );
}
