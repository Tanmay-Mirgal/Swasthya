"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ChevronDown, Plus, Search, Check } from "lucide-react";
import { Button, EmptyState, Input, Select } from "@/components/ui";
import { getPrescribableExercises, searchCatalog, type CatalogExercise } from "@/lib/rehab/exerciseCatalog";
import { cn } from "@/lib/utils";

interface Props {
  /** Exercise ids already in the plan; they show as added and cannot be added twice. */
  selectedIds: string[];
  onAdd: (exercise: CatalogExercise) => void;
}

/**
 * Searchable list of the exercises the camera can track. Each row can open a preview
 * (description, steps, camera placement) before it is added.
 */
export function ExercisePicker({ selectedIds, onAdd }: Props) {
  const all = useMemo(() => getPrescribableExercises(), []);
  const [text, setText] = useState("");
  const [bodyArea, setBodyArea] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const areas = useMemo(() => [...new Set(all.map((e) => e.bodyArea))].sort(), [all]);
  const levels = useMemo(() => [...new Set(all.map((e) => e.difficulty))].sort(), [all]);
  const results = useMemo(() => searchCatalog(all, { text, bodyArea, difficulty }), [all, text, bodyArea, difficulty]);
  const filtered = Boolean(text || bodyArea || difficulty);

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem_11rem]">
        <div className="relative">
          <label htmlFor="ex-search" className="sr-only">Search exercises</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <Input id="ex-search" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search, for example knee" className="pl-9" autoComplete="off" />
        </div>
        <div>
          <label htmlFor="ex-area" className="sr-only">Body area</label>
          <Select id="ex-area" value={bodyArea} onChange={(e) => setBodyArea(e.target.value)}>
            <option value="">All body areas</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </Select>
        </div>
        <div>
          <label htmlFor="ex-level" className="sr-only">Difficulty</label>
          <Select id="ex-level" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            <option value="">Any difficulty</option>
            {levels.map((l) => <option key={l} value={l}>{l}</option>)}
          </Select>
        </div>
      </div>

      <p className="mt-2 text-sm text-slate-600" role="status" aria-live="polite">
        {results.length} of {all.length} {all.length === 1 ? "exercise" : "exercises"}
        {filtered ? "" : " the camera can track"}
      </p>

      {results.length === 0 ? (
        <EmptyState
          title="No exercise matches"
          action={<Button variant="outline" size="sm" onClick={() => { setText(""); setBodyArea(""); setDifficulty(""); }}>Clear search</Button>}
        >
          Only exercises the camera can count and check are listed.
        </EmptyState>
      ) : (
        <ul className="mt-1 border-t border-slate-900">
          {results.map((ex) => {
            const added = selectedIds.includes(ex.id);
            const expanded = open === ex.id;
            return (
              <li key={ex.id} className="border-b border-slate-300">
                <div className="flex items-center gap-3 py-3">
                  {ex.guideImage ? (
                    <Image src={ex.guideImage} alt="" width={56} height={56} className="size-14 shrink-0 rounded-md border border-slate-300 object-cover grayscale-[35%]" />
                  ) : (
                    <span aria-hidden="true" className="size-14 shrink-0 rounded-md border border-dashed border-slate-300" />
                  )}
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : ex.id)}
                    aria-expanded={expanded}
                    aria-controls={`ex-detail-${ex.id}`}
                    className="min-w-0 flex-1 rounded text-left"
                  >
                    <span className="block font-bold text-slate-900">{ex.name}</span>
                    <span className="block text-sm text-slate-600">{ex.bodyArea} · {ex.difficulty} · {ex.category}</span>
                    <span className="mt-0.5 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">
                      Preview <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} aria-hidden="true" />
                    </span>
                  </button>
                  {added ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-emerald-700"><Check className="size-4" aria-hidden="true" /> In plan</span>
                  ) : (
                    <Button type="button" size="sm" variant="outline" onClick={() => onAdd(ex)} aria-label={`Add ${ex.name} to the plan`}>
                      <Plus className="size-4" aria-hidden="true" /> Add
                    </Button>
                  )}
                </div>
                {expanded && (
                  <div id={`ex-detail-${ex.id}`} className="mb-3 ml-[4.25rem] max-w-prose space-y-2 text-sm text-slate-700">
                    <p>{ex.description}</p>
                    <ol className="list-decimal space-y-0.5 pl-5">{ex.instructions.map((s, i) => <li key={i}>{s}</li>)}</ol>
                    <p><span className="font-semibold text-slate-900">Camera:</span> {ex.cameraNote}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
