"use client";

import { useState } from "react";
import Image from "next/image";

interface PoseGuidePanelProps {
  exerciseId: string;
  exerciseName: string;
  instructions: string[];
}

/** Maps exerciseId → /exercise-guides/<filename>.jpg */
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
      {/* Floating trigger button — always visible on right side */}
      <button
        id="pose-guide-toggle"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? "Close pose guide" : "Open pose guide"}
        className={`
          fixed right-0 top-1/2 -translate-y-1/2 z-50
          flex items-center gap-1.5
          py-3 pl-3 pr-2
          rounded-l-2xl border border-r-0
          shadow-xl backdrop-blur-md
          transition-all duration-300
          ${isOpen
            ? "bg-emerald-600 border-emerald-500 text-white"
            : "bg-zinc-900/90 border-zinc-700 text-emerald-400 hover:bg-zinc-800/90"
          }
        `}
      >
        {isOpen ? (
          /* Close X */
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          /* Guide book icon */
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        )}
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
          w-[82vw] max-w-xs
          bg-zinc-950/98 border-l border-zinc-800
          shadow-2xl backdrop-blur-xl
          flex flex-col
          transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "translate-x-full"}
        `}
        aria-hidden={!isOpen}
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between px-4 pt-5 pb-3 border-b border-zinc-800/80">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
              Exercise Guide
            </p>
            <h2 className="text-sm font-extrabold text-white leading-tight mt-0.5">
              {exerciseName}
            </h2>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {/* Reference Image */}
          {guideImage && (
            <div className="relative w-full aspect-[3/4] bg-zinc-900">
              <Image
                src={guideImage}
                alt={`${exerciseName} reference guide`}
                fill
                className="object-cover"
                priority
              />
              {/* Gradient fade at bottom */}
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-zinc-950 to-transparent" />
            </div>
          )}

          {/* Step-by-step Instructions */}
          <div className="px-4 py-4 space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              How to do it
            </h3>
            <ol className="space-y-2.5">
              {instructions.map((step, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="text-xs text-zinc-300 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Quick Tips */}
          <div className="mx-4 mb-6 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/40">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-1.5">
              💡 Tip
            </p>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Move slowly and smoothly. Stop if you feel pain. Focus on controlled motion, not speed.
            </p>
          </div>
        </div>
      </div>

      {/* Backdrop (closes panel on tap outside) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}
