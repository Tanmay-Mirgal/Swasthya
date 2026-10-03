"use client";

import { useState } from "react";
import Image from "next/image";
import { BookOpen, X, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface PoseGuidePanelProps {
  exerciseId: string;
  exerciseName: string;
  instructions: string[];
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideFloatingTrigger?: boolean;
}

function getGuideImage(exerciseId: string): string | null {
  const map: Record<string, string> = {
    "neck-rotation": "/exercise-guides/neck-rotation.jpg",
    "seated-bicep-curl": "/exercise-guides/seated-bicep-curl.jpg",
    "seated-knee-extension": "/exercise-guides/seated-knee-extension.jpg",
  };
  return map[exerciseId] ?? null;
}

export default function PoseGuidePanel({
  exerciseId,
  exerciseName,
  instructions,
  isOpen: controlledIsOpen,
  onOpenChange,
  hideFloatingTrigger = false,
}: PoseGuidePanelProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;

  const setOpen = (open: boolean) => {
    if (!isControlled) {
      setInternalIsOpen(open);
    }
    onOpenChange?.(open);
  };

  const guideImage = getGuideImage(exerciseId);

  return (
    <>
      {/* Mobile-friendly Floating trigger button */}
      {!hideFloatingTrigger && (
        <button
          id="pose-guide-toggle"
          onClick={() => setOpen(!isOpen)}
          className={`
            fixed right-3 sm:right-6 top-20 z-40
            flex items-center gap-1.5 px-3 py-2
            rounded-full border shadow-md backdrop-blur-md transition-all active:scale-95
            ${
              isOpen
                ? "bg-slate-900 border-slate-900 text-white"
                : "bg-white/95 border-slate-200 text-slate-800 hover:bg-white"
            }
          `}
          title={isOpen ? "Close Guide" : "Open Exercise Guide"}
        >
          {isOpen ? (
            <X className="w-4 h-4 shrink-0 text-slate-400" />
          ) : (
            <BookOpen className="w-4 h-4 shrink-0 text-blue-600" />
          )}
          <span className="text-xs font-semibold">
            {isOpen ? "Close" : "Guide"}
          </span>
        </button>
      )}

      {/* Slide-in panel */}
      <div
        className={`
          fixed right-0 top-0 h-full z-50
          w-full max-w-[400px] bg-white border-l border-slate-200 shadow-2xl
          flex flex-col transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "translate-x-full"}
        `}
        aria-hidden={!isOpen}
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900 leading-tight">
              {exerciseName}
            </h2>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mt-0.5">
              Exercise Guide & Form
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {/* Reference Image */}
          {guideImage && (
            <div className="relative w-full aspect-[4/3] bg-slate-100 border-b border-slate-100">
              <Image
                src={guideImage}
                alt={`${exerciseName} reference guide`}
                fill
                className="object-cover"
                priority
              />
            </div>
          )}

          {/* Step-by-step Instructions */}
          <div className="p-4 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900">
              Proper Execution Steps
            </h3>
            <ol className="space-y-3">
              {instructions.map((step, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold flex items-center justify-center border border-blue-100">
                    {idx + 1}
                  </span>
                  <span className="text-sm text-slate-700 leading-relaxed pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Quick Tips */}
          <div className="mx-4 mb-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-blue-600" />
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-900">
                Safety & Form Tips
              </p>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Move slowly and smoothly. Stop if you feel any sharp pain. Focus on controlled cadence rather than speed.
            </p>
          </div>
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}
