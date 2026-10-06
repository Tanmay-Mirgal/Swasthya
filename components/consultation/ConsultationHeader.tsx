"use client";

import React from "react";
import { FileText, ChevronLeft } from "lucide-react";

interface ConsultationHeaderProps {
  peerName?: string;
  activeRole: "patient" | "doctor";
  onlineUsers: number;
  isCompleted: boolean;
  callActive: boolean;
  onBack: () => void;
  /** Where the therapist writes the rehabilitation plan. Opens in a new tab so the call stays up. */
  planHref?: string;
}

/** Who you're with and whether they are here. Solid bar, no overlay gradient. */
export default function ConsultationHeader({ peerName, activeRole, onlineUsers, isCompleted, onBack, planHref }: ConsultationHeaderProps) {
  const status = isCompleted ? "Completed" : onlineUsers > 1 ? "In the room" : "Waiting for them";
  return (
    <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-700 bg-slate-900 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <button onClick={onBack} aria-label="Leave consultation" className="flex size-11 items-center justify-center rounded-lg text-slate-100 hover:bg-slate-700">
          <ChevronLeft className="size-6" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold leading-tight text-white">{peerName || (activeRole === "patient" ? "Doctor" : "Patient")}</h1>
          <p className="flex items-center gap-1.5 text-sm text-slate-300">
            <span className={`inline-block size-2 rounded-full ${onlineUsers > 1 && !isCompleted ? "bg-emerald-400" : "border border-slate-400"}`} aria-hidden="true" />
            {status}
          </p>
        </div>
      </div>
      {activeRole === "doctor" && !isCompleted && planHref && (
        <a href={planHref} target="_blank" rel="noopener noreferrer" className="hidden h-10 items-center gap-2 rounded-lg border border-slate-500 px-3 text-sm font-semibold text-white hover:bg-slate-700 md:flex">
          <FileText className="size-4" aria-hidden="true" /> Create plan<span className="sr-only"> (opens in a new tab)</span>
        </a>
      )}
    </div>
  );
}
