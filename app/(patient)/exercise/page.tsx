"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import ExerciseCard from "@/components/exercise/ExerciseCard";
import { getAllExercises, ExtendedExerciseConfig } from "@/lib/exercises/registry";
import { Search, Sparkles, Filter, Activity, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@clerk/react";

export default function ExerciseSelectionPage() {
  const exercises = getAllExercises();
  type FilterType = "all" | "upper" | "lower" | "neck";
  
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { getToken, isSignedIn } = useAuth();

  // Dynamic clinical recommendation state
  const [recommendation, setRecommendation] = useState<any>(null);
  const [patientConcerns, setPatientConcerns] = useState<string[]>([]);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);

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
  }, [isSignedIn]);

  const filteredExercises = exercises.filter((ex) => {
    const matchesFilter = filter === "all" || ex.bodySegment === filter;
    const matchesSearch =
      searchQuery === "" ||
      ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ex.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ex.primaryJoint?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const filters: { id: FilterType; label: string; count: number }[] = [
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

  return (
    <AppShell title="Exercises" hideHeader>
      <div className="flex flex-col space-y-6 pt-3 pb-12 px-2 sm:px-0 bg-[#F8FAFC]">
        
        {/* ── 1. HEADER SECTION ────────────────────────────────────────── */}
        <section className="pt-1">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                Clinical Library
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1.5">
                Choose an Exercise
              </h1>
            </div>
            <div className="size-10 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-emerald-700">
              <Activity className="size-5" />
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed max-w-sm">
            AI computer vision tracks joint kinematics and guides recovery in real time.
          </p>
        </section>

        {/* ── 2. SEARCH INPUT ──────────────────────────────────────────── */}
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search exercises, joints, or routines..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-white border border-slate-200/90 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* ── 3. RECOMMENDED HERO ROUTINE (Dynamically driven by Clinical AI) ── */}
        {filter === "all" && searchQuery === "" && (
          <section>
            <div className="flex items-center justify-between mb-2.5 px-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Recommended For You
              </h2>
              {patientConcerns.length > 0 && (
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/50">
                  Target: {patientConcerns[0]}
                </span>
              )}
            </div>

            <ExerciseCard
              exercise={featuredExercise}
              isFeatured={true}
              matchedConcern={recommendation?.matchedConcern}
              matchType={recommendation?.matchType}
              clinicalRationale={recommendation?.clinicalRationale}
              confidencePercent={recommendation?.confidencePercent}
              targetSets={recommendation?.targetSets}
              targetReps={recommendation?.targetReps}
            />
          </section>
        )}

        {/* ── 4. CATEGORY FILTER PILLS (Touch-friendly Smooth Scrollable Tabs) ── */}
        <section className="space-y-4">
          <div className="w-full overflow-hidden">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-0.5 scrollbar-none -mx-4 px-4 sm:-mx-2 sm:px-2 overscroll-x-contain touch-pan-x">
              {filters.map((f) => {
                const isSelected = filter === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    className={cn(
                      "shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs",
                      isSelected
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <span>{f.label}</span>
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                        isSelected
                          ? "bg-white/25 text-white"
                          : "bg-slate-100 text-slate-500"
                      )}
                    >
                      {f.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── 5. EXERCISE CARDS LIST ─────────────────────────────────── */}
          <div className="flex flex-col space-y-3">
            {filteredExercises.map((ex) => {
              // If on 'all' without search, skip the featured card from the list below
              if (filter === "all" && searchQuery === "" && ex.id === featuredExercise.id) {
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

            {/* Empty Search / Filter State */}
            {filteredExercises.length === 0 && (
              <div className="py-12 bg-white rounded-2xl border border-slate-200/80 p-6 flex flex-col items-center justify-center text-center shadow-xs">
                <div className="size-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-3 text-emerald-600">
                  <Search className="size-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">
                  No routines found
                </h3>
                <p className="text-xs text-slate-500 max-w-xs mb-3">
                  No exercise matching &quot;{searchQuery}&quot; in this category.
                </p>
                <button
                  onClick={() => {
                    setFilter("all");
                    setSearchQuery("");
                  }}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline underline-offset-4 cursor-pointer"
                >
                  Reset filters
                </button>
              </div>
            )}
          </div>
        </section>

      </div>
    </AppShell>
  );
}
