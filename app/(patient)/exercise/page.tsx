/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import RecommendedHero from "@/components/exercise/RecommendedHero";
import ExerciseRow from "@/components/exercise/ExerciseRow";
import ExerciseFilterTabs, { ExerciseFilterType } from "@/components/exercise/ExerciseFilterTabs";
import { getAllExercises, ExtendedExerciseConfig } from "@/lib/exercises/registry";
import { Search, X } from "lucide-react";
import { useAuth } from "@clerk/react";

export default function ExerciseSelectionPage() {
  const exercises = getAllExercises();
  
  const [filter, setFilter] = useState<ExerciseFilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { getToken, isSignedIn } = useAuth();

  // Dynamic clinical recommendation state
  const [recommendation, setRecommendation] = useState<any>(null);
  const [patientConcerns, setPatientConcerns] = useState<string[]>([]);
  const [, setIsLoadingRecs] = useState(false);

  useEffect(() => {
    async function loadRecommendations() {
      try {
        setIsLoadingRecs(true);
        const headers: Record<string, string> = {};
        if (isSignedIn) {
          const token = await getToken();
          if (token) headers["Authorization"] = `Bearer ${token}`;
        }
        const res = await fetch("/api/patient/recommendations", { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setRecommendation(json.data.primary);
            setPatientConcerns(json.data.patientConcerns || []);
          }
        }
      } catch (e) {
        console.error("Error fetching clinical recommendations:", e);
      } finally {
        setIsLoadingRecs(false);
      }
    }
    loadRecommendations();
  }, [isSignedIn, getToken]);

  const filteredExercises = exercises.filter((ex) => {
    const matchesFilter = filter === "all" || ex.bodySegment === filter;
    const matchesSearch =
      searchQuery === "" ||
      ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ex.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ex.primaryJoint?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const filters: { id: ExerciseFilterType; label: string; count: number }[] = [
    { id: "all", label: "All", count: exercises.length },
    {
      id: "upper",
      label: "Upper Body",
      count: exercises.filter((e) => e.bodySegment === "upper").length,
    },
    {
      id: "lower",
      label: "Lower Body",
      count: exercises.filter((e) => e.bodySegment === "lower").length,
    },
    {
      id: "neck",
      label: "Neck & Spine",
      count: exercises.filter((e) => e.bodySegment === "neck").length,
    },
  ];

  // Determine featured exercise from clinical recommendation algorithm
  const featuredExercise: ExtendedExerciseConfig =
    recommendation?.exercise ||
    exercises.find((ex) => ex.isAvailable) ||
    exercises[0];

  const isBrowsingAll = filter === "all" && searchQuery === "";

  return (
    <AppShell title="Exercises" hideHeader>
      <div className="max-w-4xl mx-auto w-full space-y-7 pb-12 pt-2 px-1 sm:px-0">
        
        {/* ── 1. PAGE HEADER & SEARCH ──────────────────────────────────── */}
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pt-1">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
              Exercises
            </h1>
            <p className="text-sm text-slate-500 mt-1 max-w-md">
              Targeted movement routines for your rehabilitation and recovery plan.
            </p>
          </div>

          {/* Clean discovery search bar */}
          <div className="w-full sm:w-72 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              aria-label="Search exercises"
              placeholder="Search exercise or joint..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-8 rounded-lg bg-white border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </header>

        {/* ── 2. HERO: CLINICAL GUIDANCE RECOMMENDATION ────────────────── */}
        {isBrowsingAll && (
          <RecommendedHero
            exercise={featuredExercise}
            matchedConcern={patientConcerns[0] || recommendation?.matchedConcern}
            matchType={recommendation?.matchType}
            clinicalRationale={recommendation?.clinicalRationale}
            targetSets={recommendation?.targetSets}
            targetReps={recommendation?.targetReps}
          />
        )}

        {/* ── 3. CURATED EXERCISE DIRECTORY ───────────────────────────── */}
        <section aria-label="Exercise Directory" className="space-y-4">
          {/* Header row with directory title & category filter tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {searchQuery ? "Search Results" : "All Exercises"}
            </h2>

            <ExerciseFilterTabs
              filters={filters}
              activeFilter={filter}
              onSelectFilter={setFilter}
            />
          </div>

          {/* Scannable Exercise List */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.03)] divide-y divide-slate-100 overflow-hidden">
            {filteredExercises.map((ex) => {
              // Exclude featured hero exercise only when on 'all' view with no active search
              if (isBrowsingAll && ex.id === featuredExercise.id) {
                return null;
              }

              return <ExerciseRow key={ex.id} exercise={ex} />;
            })}

            {/* Empty Search / Filter State */}
            {filteredExercises.length === 0 && (
              <div className="py-12 px-6 flex flex-col items-center justify-center text-center">
                <p className="text-sm font-medium text-slate-800">
                  No exercises found
                </p>
                <p className="text-xs text-slate-500 max-w-xs mt-1">
                  We couldn&apos;t find an exercise matching &ldquo;{searchQuery}&rdquo;.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setFilter("all");
                    setSearchQuery("");
                  }}
                  className="mt-3 text-xs font-semibold text-slate-700 hover:text-slate-900 underline underline-offset-4 cursor-pointer"
                >
                  Reset filters and show all
                </button>
              </div>
            )}
          </div>
        </section>

      </div>
    </AppShell>
  );
}
