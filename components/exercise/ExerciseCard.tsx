"use client";

import Link from "next/link";
import { ExtendedExerciseConfig } from "@/lib/exercises/registry";
import { Dumbbell, Activity, ChevronRight, RefreshCcw, Camera, Play, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExerciseCardProps {
  exercise: ExtendedExerciseConfig;
  isFeatured?: boolean;
  isAvailable?: boolean;
  matchedConcern?: string;
  matchType?: string;
  clinicalRationale?: string;
  confidencePercent?: number;
  targetSets?: number;
  targetReps?: number;
}

export default function ExerciseCard({
  exercise,
  isFeatured = false,
  isAvailable = true,
  matchedConcern,
  matchType,
  clinicalRationale,
  confidencePercent,
  targetSets,
  targetReps,
}: ExerciseCardProps) {
  
  // Choose an icon based on body segment
  const getIcon = () => {
    switch (exercise.bodySegment) {
      case "upper":
        return <Dumbbell className={cn("size-5", isFeatured ? "text-emerald-600" : "text-emerald-700")} />;
      case "lower":
        return <Activity className={cn("size-5", isFeatured ? "text-teal-600" : "text-teal-700")} />;
      case "neck":
        return <RefreshCcw className={cn("size-5", isFeatured ? "text-emerald-600" : "text-emerald-700")} />;
      default:
        return <Dumbbell className="size-5 text-emerald-600" />;
    }
  };

  const getIconBg = () => {
    if (!isAvailable) return "bg-slate-100 text-slate-400";
    switch (exercise.bodySegment) {
      case "upper":
        return "bg-emerald-50 border border-emerald-200/60";
      case "lower":
        return "bg-teal-50 border border-teal-200/60";
      case "neck":
        return "bg-emerald-50 border border-emerald-200/60";
      default:
        return "bg-slate-100";
    }
  };

  const displaySets = targetSets || 3;
  const displayReps = targetReps || exercise.targetReps || 10;

  // ── FEATURED RECOMMENDED HERO CARD ──────────────────────────────────────────
  if (isFeatured) {
    return (
      <div className="bg-white rounded-2xl border border-emerald-200/90 p-5 shadow-[0_4px_20px_rgba(5,150,105,0.06)] relative overflow-hidden group hover:shadow-md transition-all">
        {/* Subtle Ambient Radial Highlight */}
        <div className="absolute top-0 right-0 size-48 bg-gradient-to-bl from-emerald-100/30 via-emerald-50/10 to-transparent rounded-bl-full pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-3.5">
          {/* Top Badges */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/60 text-[11px] font-bold text-emerald-800">
              <Sparkles className="size-3 text-emerald-600" />
              <span>
                {matchedConcern
                  ? matchType === "doctor_prescribed"
                    ? "Prescribed by Doctor"
                    : `Recommended for ${matchedConcern}`
                  : "Recommended Daily Routine"}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {confidencePercent && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50/80 px-2 py-0.5 rounded-full border border-emerald-200/50">
                  {confidencePercent}% Clinical Match
                </span>
              )}
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200/80 text-[11px] font-medium text-slate-600">
                <Camera className="size-3 text-emerald-600" />
                <span>Live AI</span>
              </div>
            </div>
          </div>

          {/* Exercise Info */}
          <div className="flex items-start gap-3.5">
            <div className={cn("size-12 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs", getIconBg())}>
              {getIcon()}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-slate-900 group-hover:text-emerald-800 transition-colors">
                {exercise.name}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed mt-1">
                {exercise.description}
              </p>
            </div>
          </div>

          {/* Personalized Clinical Explanation */}
          {clinicalRationale && (
            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/60 text-xs text-emerald-950 leading-relaxed">
              <span className="font-bold text-emerald-800 mr-1.5">💡 Clinical Rationale:</span>
              <span>{clinicalRationale}</span>
            </div>
          )}

          {/* Meta Specs Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
            <span className="text-[11px] font-semibold text-slate-700 bg-slate-50 border border-slate-200/70 px-2.5 py-1 rounded-lg">
              🎯 {displayReps} Reps × {displaySets} Sets
            </span>
            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 rounded-lg">
              {exercise.difficulty || "Beginner"}
            </span>
            <span className="text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-200/70 px-2.5 py-1 rounded-lg">
              Joint: {exercise.primaryJoint}
            </span>
          </div>

          {/* Launch CTA Button */}
          <Link
            href={`/exercise/${exercise.id}/setup`}
            className="w-full h-11.5 rounded-xl flex items-center justify-center gap-2 font-bold text-white text-sm bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-600/30 active:scale-[0.98] transition-all mt-1"
          >
            <span>Start Guided Session</span>
            <Play className="size-4 fill-white" />
          </Link>
        </div>
      </div>
    );
  }

  // ── STANDARD EXERCISE LIST CARD ─────────────────────────────────────────────
  const cardContent = (
    <div
      className={cn(
        "bg-white p-4 rounded-2xl border border-slate-200/80 shadow-[0_2px_10px_rgba(15,23,42,0.03)] flex items-center justify-between gap-3.5 transition-all duration-200 group",
        isAvailable
          ? "hover:border-emerald-300 hover:shadow-md cursor-pointer"
          : "opacity-60 bg-slate-50/80 cursor-not-allowed"
      )}
    >
      {/* Icon */}
      <div className={cn("size-11 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105", getIconBg())}>
        {getIcon()}
      </div>

      {/* Info (No truncation of exercise name) */}
      <div className="flex-1 min-w-0 pr-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-bold text-sm sm:text-base text-slate-900 group-hover:text-emerald-800 transition-colors leading-snug">
            {exercise.name}
          </h3>
          {!isAvailable && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">
              Soon
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
          <span className="font-medium text-slate-700">{exercise.category}</span>
          <span className="opacity-40">•</span>
          <span>{displayReps} reps</span>
          {exercise.difficulty && (
            <>
              <span className="opacity-40">•</span>
              <span className="text-emerald-700 font-semibold">{exercise.difficulty}</span>
            </>
          )}
        </div>
      </div>

      {/* Action */}
      <div className="shrink-0">
        {isAvailable ? (
          <div className="flex items-center gap-1 font-semibold text-xs text-emerald-700 bg-emerald-50 group-hover:bg-emerald-600 group-hover:text-white px-3 py-1.5 rounded-xl border border-emerald-200/60 group-hover:border-emerald-600 transition-all shadow-2xs">
            <span>Start</span>
            <ChevronRight className="size-3.5" />
          </div>
        ) : (
          <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
            Testing
          </span>
        )}
      </div>
    </div>
  );

  if (!isAvailable) {
    return <div className="block">{cardContent}</div>;
  }

  return (
    <Link href={`/exercise/${exercise.id}/setup`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded-2xl">
      {cardContent}
    </Link>
  );
}
