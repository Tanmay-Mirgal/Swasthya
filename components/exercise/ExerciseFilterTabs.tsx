"use client";

import { cn } from "@/lib/utils";

export type ExerciseFilterType = "all" | "upper" | "lower" | "neck";

interface FilterOption {
  id: ExerciseFilterType;
  label: string;
  count: number;
}

interface ExerciseFilterTabsProps {
  filters: FilterOption[];
  activeFilter: ExerciseFilterType;
  onSelectFilter: (filter: ExerciseFilterType) => void;
}

export default function ExerciseFilterTabs({
  filters,
  activeFilter,
  onSelectFilter,
}: ExerciseFilterTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Filter exercises by anatomical segment"
      className="flex items-center gap-1 border-b border-slate-200/80 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0"
    >
      {filters.map((f) => {
        const isSelected = activeFilter === f.id;
        return (
          <button
            key={f.id}
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelectFilter(f.id)}
            className={cn(
              "px-3.5 py-2.5 text-xs transition-colors relative cursor-pointer whitespace-nowrap flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/10 rounded-t",
              isSelected
                ? "text-slate-900 font-semibold border-b-2 border-slate-900 -mb-px"
                : "text-slate-500 hover:text-slate-800 font-medium border-b-2 border-transparent -mb-px"
            )}
          >
            <span>{f.label}</span>
            <span
              className={cn(
                "text-[11px] font-normal transition-colors",
                isSelected ? "text-slate-700" : "text-slate-400"
              )}
            >
              ({f.count})
            </span>
          </button>
        );
      })}
    </div>
  );
}
