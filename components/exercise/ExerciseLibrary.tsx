"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { Play, Search, X } from "lucide-react";
import { Button, EmptyState, Input, PageHeader, Tabs, type TabItem } from "@/components/ui";
import type { ExtendedExerciseConfig } from "@/lib/exercises/registry";
import { bodySegmentLabel, exerciseGuideImage, titleCase } from "@/lib/exercises/presentation";

export interface LibrarySuggestion {
  exerciseId: string;
  reason?: string;
  sets?: number;
  reps?: number;
}

interface ExerciseLibraryProps {
  exercises: ExtendedExerciseConfig[];
  suggestion?: LibrarySuggestion | null;
  /** Exercise ids prescribed by a therapist for this patient. */
  prescribedIds?: string[];
}

type Segment = "all" | ExtendedExerciseConfig["bodySegment"];

export default function ExerciseLibrary({ exercises, suggestion, prescribedIds = [] }: ExerciseLibraryProps) {
  const [segment, setSegment] = useState<Segment>("all");
  const [query, setQuery] = useState("");

  const tabs: TabItem[] = useMemo(
    () => [
      { id: "all", label: `All (${exercises.length})` },
      ...(["upper", "lower", "neck"] as const)
        .map((s) => ({ id: s, label: `${bodySegmentLabel(s)} (${exercises.filter((e) => e.bodySegment === s).length})` }))
        .filter((t) => !t.label.endsWith("(0)")),
    ],
    [exercises]
  );

  const q = query.trim().toLowerCase();
  const filtered = exercises.filter((e) => {
    const inSegment = segment === "all" || e.bodySegment === segment;
    const matches = !q || e.name.toLowerCase().includes(q) || e.category.toLowerCase().includes(q) || e.primaryJoint?.toLowerCase().includes(q);
    return inSegment && matches;
  });

  // Suggested exercise leads the list when browsing everything.
  const lead = !q && segment === "all" ? suggestion?.exerciseId : undefined;
  const ordered = lead ? [...filtered].sort((a, b) => (a.id === lead ? -1 : b.id === lead ? 1 : 0)) : filtered;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader title="Exercises" description="Movements your physiotherapist can prescribe. Pick one to set up your camera and begin." />

      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
        <Input
          type="search"
          aria-label="Search exercises"
          placeholder="Search by exercise or joint"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 pr-9"
        />
        {query && (
          <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-600 hover:bg-slate-100">
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <Tabs items={tabs} value={segment} onChange={(id) => setSegment(id as Segment)} label="Body area" />

      <div role="tabpanel" id={`panel-${segment}`} aria-labelledby={`tab-${segment}`}>
        {ordered.length === 0 ? (
          <EmptyState
            className="mt-6"
            title="No exercise matches that search"
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setSegment("all");
                }}
              >
                Show all exercises
              </Button>
            }
          >
            Try a joint name such as knee or shoulder.
          </EmptyState>
        ) : (
          <ul>
            {ordered.map((ex) => {
              const img = exerciseGuideImage(ex.id);
              const isSuggested = ex.id === lead;
              const isPrescribed = prescribedIds.includes(ex.id);
              return (
                <li key={ex.id} className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 border-b border-slate-300 py-5 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                  {img ? (
                    <Image src={img} alt="" width={96} height={96} className="size-20 rounded-md border border-slate-300 object-cover grayscale-[35%] sm:size-24" />
                  ) : (
                    <div aria-hidden="true" className="flex size-20 items-center justify-center rounded-md border border-slate-300 bg-slate-100 text-xs font-semibold text-slate-600 sm:size-24">No photo</div>
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <h3 className="text-lg font-bold leading-snug text-slate-900">{ex.name}</h3>
                      {isPrescribed && <span className="rounded border border-emerald-600 px-1.5 text-xs font-bold text-emerald-800">Prescribed to you</span>}
                    </div>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {bodySegmentLabel(ex.bodySegment)} · {titleCase(ex.primaryJoint)} · {ex.difficulty} · <span className="tabular font-medium text-slate-800">{ex.targetReps} reps</span>
                    </p>
                    <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-slate-700">{ex.description}</p>
                    {isSuggested && (
                      <div className="mt-2">
                        <p className="max-w-prose text-sm text-slate-800">
                          <span className="font-semibold">Suggested for you</span>
                          {suggestion?.reason ? ` — ${suggestion.reason}` : ""}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    {ex.isAvailable ? (
                      <Button asChild variant={isSuggested || isPrescribed ? "primary" : "outline"} className="w-full sm:w-auto">
                        <Link href={`/exercise/${ex.id}/setup`}>
                          <Play className="size-4 fill-current" aria-hidden="true" /> Start
                        </Link>
                      </Button>
                    ) : (
                      <span className="text-sm font-medium text-slate-600">Not available yet</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
