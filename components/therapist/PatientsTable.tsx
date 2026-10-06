"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, MessageSquare, Search, X } from "lucide-react";
import { Button, EmptyState, Input, StatusMark, TickRow } from "@/components/ui";
import { cn } from "@/lib/utils";
import PatientAvatar from "./PatientAvatar";
import { getPatientStatus, patientId, patientName, relativeDay, type TherapistPatientItem } from "./types";

type Filter = "all" | "attention" | "not_started" | "active";
type SortKey = "name" | "last" | "week";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "attention", label: "Needs attention" },
  { id: "not_started", label: "Not started" },
  { id: "active", label: "Active" },
];

function SortHead({ k, sort, onSort, children }: { k: SortKey; sort: { key: SortKey; dir: "asc" | "desc" }; onSort: (k: SortKey) => void; children: React.ReactNode }) {
  return (
    <th scope="col" aria-sort={sort.key === k ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className="py-2 pr-4 text-left font-semibold">
      <button type="button" onClick={() => onSort(k)} className="inline-flex items-center gap-1 hover:underline">
        {children}
        {sort.key === k && (sort.dir === "asc" ? <ArrowUp className="size-3.5" aria-hidden="true" /> : <ArrowDown className="size-3.5" aria-hidden="true" />)}
      </button>
    </th>
  );
}

/** Scan-first patient list: sortable columns on desktop, a stacked list on phones. */
export default function PatientsTable({ patients }: { patients: TherapistPatientItem[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "last", dir: "asc" });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return patients
      .map((p) => ({ p, status: getPatientStatus(p) }))
      .filter(({ p, status }) => {
        const matchesQuery = !q || patientName(p).toLowerCase().includes(q) || (p.profile?.concerns ?? []).join(" ").toLowerCase().includes(q);
        const matchesFilter =
          filter === "all" ||
          (filter === "attention" && status.needsAttention) ||
          (filter === "not_started" && status.kind === "not_started") ||
          (filter === "active" && status.kind === "active");
        return matchesQuery && matchesFilter;
      })
      .sort((a, b) => {
        const dir = sort.dir === "asc" ? 1 : -1;
        if (sort.key === "name") return patientName(a.p).localeCompare(patientName(b.p)) * dir;
        if (sort.key === "week") return ((a.p.activity?.activeDaysLast7 ?? 0) - (b.p.activity?.activeDaysLast7 ?? 0)) * dir;
        // "last": longest since last session first when ascending; never-started patients lead
        const ta = a.p.activity?.lastSessionAt ? new Date(a.p.activity.lastSessionAt).getTime() : 0;
        const tb = b.p.activity?.lastSessionAt ? new Date(b.p.activity.lastSessionAt).getTime() : 0;
        return (ta - tb) * dir;
      });
  }, [patients, query, filter, sort]);

  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <Input type="search" aria-label="Search patients" placeholder="Search by name or concern" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9 pr-9" />
          {query && (
            <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-600 hover:bg-slate-100"><X className="size-3.5" /></button>
          )}
        </div>
        <div role="group" aria-label="Filter patients" className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}
              className={cn("rounded-md border px-2.5 py-1 text-sm font-semibold", filter === f.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-800 hover:border-slate-500")}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState className="mt-5" title={patients.length === 0 ? "No patients yet" : "No patient matches"}>
          {patients.length === 0 ? "Patients appear here after you accept their appointment request." : "Try a different search or filter."}
        </EmptyState>
      ) : (
        <>
          <table className="mt-5 hidden w-full text-sm md:table">
            <caption className="sr-only">Patients</caption>
            <thead>
              <tr className="border-b-2 border-slate-900">
                <SortHead k="name" sort={sort} onSort={toggleSort}>Patient</SortHead>
                <th scope="col" className="py-2 pr-4 text-left font-semibold">Plan</th>
                <SortHead k="last" sort={sort} onSort={toggleSort}>Last session</SortHead>
                <SortHead k="week" sort={sort} onSort={toggleSort}>Last 7 days</SortHead>
                <th scope="col" className="py-2 pr-4 text-left font-semibold">Status</th>
                <th scope="col" className="py-2 text-right font-semibold"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, status }) => {
                const id = patientId(p);
                const unread = p.activity?.unreadMessages ?? 0;
                return (
                  <tr key={id} className="border-b border-slate-300 align-top">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <PatientAvatar name={patientName(p)} src={p.user?.imageUrl} />
                        <div className="min-w-0">
                          <Link href={`/therapist/patient/${id}`} className="font-semibold text-slate-900 underline-offset-4 hover:underline">{patientName(p)}</Link>
                          {(p.profile?.concerns?.length ?? 0) > 0 && <p className="max-w-[16rem] truncate text-slate-600">{p.profile!.concerns!.join(", ")}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 tabular text-slate-800">{p.exerciseAssignments?.length ?? 0} {(p.exerciseAssignments?.length ?? 0) === 1 ? "exercise" : "exercises"}</td>
                    <td className="py-3 pr-4 text-slate-800">{relativeDay(p.activity?.lastSessionAt)}</td>
                    <td className="py-3 pr-4"><TickRow total={7} done={p.activity?.activeDaysLast7 ?? 0} size={14} label={`${p.activity?.activeDaysLast7 ?? 0} of the last 7 days with a session`} /></td>
                    <td className="py-3 pr-4">
                      <StatusMark kind={status.kind === "active" ? "done" : status.needsAttention ? "attention" : "pending"}>{status.label}</StatusMark>
                      <p className="text-slate-600">{status.reason}</p>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button asChild size="sm" variant={unread ? "highlight" : "outline"}>
                          <Link href={`/chat/${id}`}><MessageSquare className="size-3.5" aria-hidden="true" /> Message{unread ? <span className="tabular"> ({unread})</span> : null}</Link>
                        </Button>
                        <Button asChild size="sm" variant="outline"><Link href={`/therapist/patient/${id}`}>Open</Link></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <ul className="mt-4 md:hidden">
            {rows.map(({ p, status }) => {
              const id = patientId(p);
              const unread = p.activity?.unreadMessages ?? 0;
              return (
                <li key={id} className="border-b border-slate-300 py-4">
                  <div className="flex items-start gap-3">
                    <PatientAvatar name={patientName(p)} src={p.user?.imageUrl} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/therapist/patient/${id}`} className="font-semibold text-slate-900">{patientName(p)}</Link>
                      <div className="mt-0.5"><StatusMark kind={status.kind === "active" ? "done" : status.needsAttention ? "attention" : "pending"}>{status.label}</StatusMark></div>
                      <p className="mt-0.5 text-sm text-slate-600">{status.reason}{(p.exerciseAssignments?.length ?? 0) > 0 ? ` · ${p.exerciseAssignments!.length} ${p.exerciseAssignments!.length === 1 ? "exercise" : "exercises"} prescribed` : ""}</p>
                      <div className="mt-2"><TickRow total={7} done={p.activity?.activeDaysLast7 ?? 0} size={14} label={`${p.activity?.activeDaysLast7 ?? 0} of the last 7 days with a session`} /></div>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2 pl-[52px]">
                    <Button asChild size="sm" variant={unread ? "highlight" : "outline"}><Link href={`/chat/${id}`}>Message{unread ? ` (${unread})` : ""}</Link></Button>
                    <Button asChild size="sm" variant="outline"><Link href={`/therapist/patient/${id}`}>Open</Link></Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
