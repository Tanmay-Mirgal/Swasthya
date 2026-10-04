"use client";

import Link from "next/link";
import { ExtendedExerciseConfig } from "@/lib/exercises/registry";
import { Dumbbell, Activity, RefreshCcw, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExerciseRowProps {
  exercise: ExtendedExerciseConfig;
}

export default function ExerciseRow({ exercise }: ExerciseRowProps) {
  const getIcon = () => {
    switch (exercise.bodySegment) {
      case "upper":
        return <Dumbbell className="size-4 text-slate-600" />;
      case "lower":
        return <Activity className="size-4 text-slate-600" />;
      case "neck":
        return <RefreshCcw className="size-4 text-slate-600" />;
      default:
        return <Dumbbell className="size-4 text-slate-600" />;
    }
  };

  const isAvailable = exercise.isAvailable;
  const targetReps = exercise.targetReps || 10;

  const rowInner = (
    <div
      className={cn(
        "group px-4 sm:px-6 py-4 flex items-center justify-between gap-4 transition-colors",
        isAvailable
          ? "hover:bg-slate-50/80 cursor-pointer"
          : "opacity-60 bg-slate-50/30 cursor-not-allowed"
      )}
    >
      {/* Icon & Metadata */}
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <div className="size-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-slate-200/80 transition-colors">
          {getIcon()}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 group-hover:text-emerald-900 transition-colors truncate">
              {exercise.name}
            </h3>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
            <span>{exercise.category}</span>
            <span className="text-slate-300">·</span>
            <span>{targetReps} reps</span>
            {exercise.difficulty && (
              <>
                <span className="text-slate-300">·</span>
                <span>{exercise.difficulty}</span>
              </>
            )}
            {exercise.primaryJoint && (
              <>
                <span className="text-slate-300 hidden sm:inline">·</span>
                <span className="capitalize hidden sm:inline">{exercise.primaryJoint}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action CTA */}
      <div className="shrink-0 flex items-center">
        {isAvailable ? (
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 group-hover:text-emerald-900 px-3 py-1.5 rounded-lg border border-slate-200 bg-white group-hover:border-slate-300 group-hover:bg-white shadow-2xs transition-all">
            <span>Start</span>
            <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
          </div>
        ) : (
          <span className="text-xs text-slate-400 font-normal">
            In clinical review
          </span>
        )}
      </div>
    </div>
  );

  if (!isAvailable) {
    return <div className="block">{rowInner}</div>;
  }

  return (
    <Link
      href={`/exercise/${exercise.id}/setup`}
      className="block focus-visible:outline-none focus-visible:bg-slate-50"
    >
      {rowInner}
    </Link>
  );
}
