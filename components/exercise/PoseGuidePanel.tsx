"use client";

import { useState } from "react";
import Image from "next/image";
import { BookOpen, X, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface PoseGuidePanelProps {
  exerciseId: string;
  exerciseName: string;
  instructions: string[];
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
}: PoseGuidePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const guideImage = getGuideImage(exerciseId);

  return (
    <>
      {/* Floating trigger button */}
      <button
        id="pose-guide-toggle"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`
          fixed right-0 top-1/2 -translate-y-1/2 z-50
          flex items-center gap-1.5 py-3 pl-3 pr-2
          rounded-l-xl border border-r-0 shadow-md backdrop-blur-md transition-all
          ${isOpen
            ? "bg-slate-900 border-slate-900 text-white"
            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
          }
        `}
      >
        {isOpen ? <X className="w-4 h-4 shrink-0" /> : <BookOpen className="w-4 h-4 shrink-0" />}
        <span
          className="text-[10px] font-bold uppercase tracking-widest leading-none"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          {isOpen ? "Close" : "Guide"}
        </span>
      </button>

      {/* Slide-in panel */}
      <div
        className={`
          fixed right-0 top-0 h-full z-40
          w-[85vw] max-w-sm bg-white border-l border-slate-200 shadow-2xl
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
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mt-1">
              Exercise Guide
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
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
              Instructions
            </h3>
            <ol className="space-y-3">
              {instructions.map((step, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-md bg-slate-100 text-slate-700 text-xs font-medium flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="text-sm text-slate-600 leading-relaxed pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Quick Tips */}
          <div className="mx-4 mb-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-slate-500" />
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-900">
                Important Note
              </p>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Move slowly and smoothly. Stop if you feel pain. Focus on controlled motion, not speed.
            </p>
          </div>
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/20 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}
