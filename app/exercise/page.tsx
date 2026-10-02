"use client";

import { useState } from "react";
import AppShell from "@/components/navigation/AppShell";
import ExerciseCard from "@/components/exercise/ExerciseCard";
import { getAllExercises } from "@/lib/exercises/registry";
import { cn } from "@/lib/utils";

export default function ExerciseSelectionPage() {
  const exercises = getAllExercises();
  type FilterType = "all" | "upper" | "lower" | "neck";
  const [filter, setFilter] = useState<FilterType>("all");

  const filteredExercises = exercises.filter(
    (ex) => filter === "all" || ex.bodySegment === filter
  );

  const filters: { id: FilterType; label: string }[] = [
    { id: "all", label: "All" },
    { id: "upper", label: "Upper Body" },
    { id: "lower", label: "Lower Body" },
    { id: "neck", label: "Neck" },
  ];

  const featuredExercise = exercises.find((ex) => ex.isAvailable) || exercises[0];

  return (
    <AppShell>
      <div className="flex flex-col space-y-8 pt-4 pb-12 px-2">
        
        {/* Intro */}
        <section>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Choose an exercise
          </h1>
          <p className="text-base text-slate-500 mt-2 leading-relaxed max-w-sm">
            Start a guided session when you&apos;re ready. Follow on-screen tracking for perfect form.
          </p>
        </section>

        {/* Featured Exercise (Only if filter is "all") */}
        {filter === "all" && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 ml-1">
              Recommended
            </h2>
            <div className="group">
              <ExerciseCard exercise={featuredExercise} isFeatured={true} />
            </div>
          </section>
        )}

        {/* Filter & List */}
        <section>
          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide -mx-2 px-3">
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900",
                  filter === f.id
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col space-y-1">
            {filteredExercises.map((ex) => {
              // If filter is 'all', skip the featured exercise in the list to avoid duplication
              if (filter === "all" && ex.id === featuredExercise.id) {
                return null;
              }
              
              return (
                <ExerciseCard
                  key={ex.id}
                  exercise={ex}
                  isFeatured={false}
                  isAvailable={ex.isAvailable}
                />
              );
            })}
            
            {filteredExercises.length === 0 && (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                  <span className="text-slate-400 font-bold text-xl">?</span>
                </div>
                <h3 className="text-slate-900 font-medium mb-1">No exercises found</h3>
                <p className="text-sm text-slate-500">Try selecting a different category.</p>
              </div>
            )}
          </div>
        </section>

      </div>
    </AppShell>
  );
}
