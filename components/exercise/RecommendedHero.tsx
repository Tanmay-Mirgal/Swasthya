"use client";

import Link from "next/link";
import { ExtendedExerciseConfig } from "@/lib/exercises/registry";
import { Dumbbell, Activity, RefreshCcw, ArrowRight, Video } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecommendedHeroProps {
  exercise: ExtendedExerciseConfig;
  matchedConcern?: string;
  matchType?: string;
  clinicalRationale?: string;
  targetSets?: number;
  targetReps?: number;
}

export default function RecommendedHero({
  exercise,
  matchedConcern,
  matchType,
  clinicalRationale,
  targetSets,
  targetReps,
}: RecommendedHeroProps) {
  const getIcon = () => {
    switch (exercise.bodySegment) {
      case "upper":
        return <Dumbbell className="size-5 text-slate-700" />;
      case "lower":
        return <Activity className="size-5 text-slate-700" />;
      case "neck":
        return <RefreshCcw className="size-5 text-slate-700" />;
      default:
        return <Dumbbell className="size-5 text-slate-700" />;
    }
  };

  const displaySets = targetSets || 3;
  const displayReps = targetReps || exercise.targetReps || 10;

  // Clinical context label
  const clinicalLabel = matchType === "doctor_prescribed"
    ? "Prescribed by physical therapist"
    : matchedConcern
    ? `Targeting ${matchedConcern.toLowerCase()}`
    : "Recommended for recovery plan";

  return (
    <section aria-labelledby="recommended-routine-title" className="relative">
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-6 sm:p-7 transition-all">
        {/* Top Header / Clinical Context */}
        <div className="flex items-center justify-between gap-3 text-xs text-slate-500 pb-4 border-b border-slate-100 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Recommended Routine
            </span>
            <span className="text-slate-300">·</span>
            <span className="font-medium text-slate-700">
              {clinicalLabel}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Video className="size-3 text-slate-400" />
            <span>Camera form feedback</span>
          </div>
        </div>

        {/* Content Body & CTA Layout */}
        <div className="mt-5 flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          {/* Left: Exercise Identity & Clinical Rationale */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-3.5">
              <div className="size-10 rounded-xl bg-slate-100/80 flex items-center justify-center shrink-0 text-slate-700">
                {getIcon()}
              </div>
              <div className="flex-1 min-w-0">
                <h2
                  id="recommended-routine-title"
                  className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight"
                >
                  {exercise.name}
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed mt-1 max-w-xl">
                  {exercise.description}
                </p>
              </div>
            </div>

            {/* Supportive Clinical Note (Calm, structured, readable) */}
            {clinicalRationale && (
              <div className="mt-4 pl-3.5 border-l-2 border-slate-300 py-0.5 text-xs text-slate-600 leading-relaxed max-w-xl">
                <span className="font-semibold text-slate-800">Clinical note: </span>
                <span>{clinicalRationale}</span>
              </div>
            )}

            {/* Structured Typographic Metadata (No pill soup) */}
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-5 flex-wrap">
              <span className="font-semibold text-slate-900">
                {displayReps} reps · {displaySets} sets
              </span>
              <span className="text-slate-300">·</span>
              <span>{exercise.difficulty || "Beginner"}</span>
              {exercise.primaryJoint && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="capitalize">{exercise.primaryJoint} joint</span>
                </>
              )}
            </div>
          </div>

          {/* Right: Primary Action CTA */}
          <div className="shrink-0 flex flex-col items-stretch md:items-end justify-center pt-2 md:pt-0">
            <Link
              href={`/exercise/${exercise.id}/setup`}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-medium text-sm shadow-xs transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-800/40"
            >
              <span>Start Guided Session</span>
              <ArrowRight className="size-4" />
            </Link>
            <span className="text-[11px] text-slate-400 mt-2 text-center md:text-right">
              Approx. 5–8 mins · Guided tempo
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
