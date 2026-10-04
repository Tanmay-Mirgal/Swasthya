"use client";

import React from "react";
import { Sparkles, Clock, CheckCircle2 } from "lucide-react";

interface RecoveryRingsProps {
  mobilityPercent?: number; // Outer ring (Emerald)
  formPercent?: number;     // Middle ring (Mint)
  targetPercent?: number;   // Inner ring (Amber)
  completedCount?: number;
  totalCount?: number;
  activeMinutes?: number;
}

export default function RecoveryRings({
  mobilityPercent = 75,
  formPercent = 94,
  targetPercent = 50,
  completedCount = 2,
  totalCount = 4,
  activeMinutes = 18,
}: RecoveryRingsProps) {
  // SVG Ring Calculations
  // Outer Ring: r = 48, c = 2 * pi * 48 = 301.59
  // Middle Ring: r = 38, c = 2 * pi * 38 = 238.76
  // Inner Ring: r = 28, c = 2 * pi * 28 = 175.93
  const cOuter = 301.59;
  const cMiddle = 238.76;
  const cInner = 175.93;

  const offsetOuter = cOuter - (mobilityPercent / 100) * cOuter;
  const offsetMiddle = cMiddle - (formPercent / 100) * cMiddle;
  const offsetInner = cInner - (targetPercent / 100) * cInner;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)] hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/50">
            Daily Recovery Goal
          </span>
          <h2 className="text-base font-bold text-slate-900 mt-1">
            Movement Progress
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200">
          <Clock className="size-3.5 text-emerald-600" />
          <span>{activeMinutes} mins active</span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Concentric SVG Rings */}
        <div className="relative size-32 shrink-0 flex items-center justify-center">
          <svg className="size-full -rotate-90" viewBox="0 0 120 120">
            {/* Background Tracks */}
            <circle cx="60" cy="60" r="48" fill="none" stroke="#E2E8F0" strokeWidth="8" strokeOpacity="0.7" />
            <circle cx="60" cy="60" r="38" fill="none" stroke="#E2E8F0" strokeWidth="8" strokeOpacity="0.7" />
            <circle cx="60" cy="60" r="28" fill="none" stroke="#E2E8F0" strokeWidth="8" strokeOpacity="0.7" />

            {/* Outer Ring: Mobility (Deep Emerald) */}
            <circle
              cx="60"
              cy="60"
              r="48"
              fill="none"
              stroke="#059669"
              strokeWidth="8"
              strokeDasharray={cOuter}
              strokeDashoffset={offsetOuter}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />

            {/* Middle Ring: Form Accuracy (Mint Green) */}
            <circle
              cx="60"
              cy="60"
              r="38"
              fill="none"
              stroke="#10B981"
              strokeWidth="8"
              strokeDasharray={cMiddle}
              strokeDashoffset={offsetMiddle}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out delay-150"
            />

            {/* Inner Ring: Daily Target (Warm Amber) */}
            <circle
              cx="60"
              cy="60"
              r="28"
              fill="none"
              stroke="#F59E0B"
              strokeWidth="8"
              strokeDasharray={cInner}
              strokeDashoffset={offsetInner}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out delay-300"
            />
          </svg>

          {/* Center Badge */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
            <span className="text-xs font-bold text-slate-900 leading-tight">
              {completedCount}/{totalCount}
            </span>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-tight">
              Done
            </span>
          </div>
        </div>

        {/* Legend Metrics */}
        <div className="flex-1 w-full flex flex-col gap-2.5">
          {/* Metric 1 */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-[#059669] shrink-0" />
              <span className="text-slate-600 font-medium">Mobility Goal</span>
            </div>
            <span className="font-bold text-slate-900">{mobilityPercent}%</span>
          </div>

          {/* Metric 2 */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-[#10B981] shrink-0" />
              <span className="text-slate-600 font-medium">Form Accuracy</span>
            </div>
            <span className="font-bold text-slate-900">{formPercent}%</span>
          </div>

          {/* Metric 3 */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-[#F59E0B] shrink-0" />
              <span className="text-slate-600 font-medium">Daily Routines</span>
            </div>
            <span className="font-bold text-slate-900">{completedCount} of {totalCount} completed</span>
          </div>

          <div className="pt-1 mt-1 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
              <Sparkles className="size-3 text-emerald-600" />
              Trending 14% better form
            </span>
            <span className="font-medium text-slate-400">Target: 30m</span>
          </div>
        </div>
      </div>
    </div>
  );
}
