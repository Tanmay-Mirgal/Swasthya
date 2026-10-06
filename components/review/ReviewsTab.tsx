"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, EmptyState, StatusMark, Tabs } from "@/components/ui";
import { formatDateKey } from "@/lib/rehab/dates";
import { QualityChange } from "./ReportView";
import PatientAvatar from "@/components/therapist/PatientAvatar";
import type { ReviewListItem } from "./types";

type Filter = "todo" | "reviewed" | "all";

/** Weekly reviews across all patients: who needs a look first, with real adherence and recording status. */
export default function ReviewsTab({ reviews }: { reviews: ReviewListItem[] }) {
  const [filter, setFilter] = useState<Filter>("todo");
  const counts = useMemo(
    () => ({ todo: reviews.filter((r) => r.status === "report_ready" || r.status === "recording_due").length, reviewed: reviews.filter((r) => r.status === "reviewed").length }),
    [reviews]
  );
  const rows = useMemo(
    () => reviews.filter((r) => (filter === "all" ? true : filter === "reviewed" ? r.status === "reviewed" : r.status !== "reviewed")),
    [reviews, filter]
  );

  return (
    <div>
      <Tabs
        label="Review status"
        value={filter}
        onChange={(id) => setFilter(id as Filter)}
        items={[
          { id: "todo", label: "To review", badge: counts.todo || undefined },
          { id: "reviewed", label: "Reviewed" },
          { id: "all", label: "All" },
        ]}
      />
      <div role="tabpanel" id={`panel-${filter}`} aria-labelledby={`tab-${filter}`}>
      {rows.length === 0 ? (
        <EmptyState className="mt-6" title={reviews.length === 0 ? "No weekly reviews yet" : filter === "todo" ? "Nothing waiting for review" : "Nothing here"}>
          {reviews.length === 0
            ? "When you turn on the weekly review in a patient’s plan, a report appears here after each review day."
            : "New reports appear here the morning after a patient’s review day."}
        </EmptyState>
      ) : (
        <>
        <ul className="mt-4 border-t border-slate-900 md:hidden">
          {rows.map((r) => (
            <li key={r.id} className="border-b border-slate-300 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <PatientAvatar name={r.patientName} src={r.patientImage} className="size-9" />
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-900">{r.patientName}</p>
                    <p className="text-sm text-slate-600">Week {r.weekNumber} · {formatDateKey(r.dueDate)}</p>
                  </div>
                </div>
                <Button asChild size="sm" variant={r.status === "report_ready" ? "primary" : "outline"}>
                  <Link href={`/therapist/reviews/${r.id}`}>{r.status === "reviewed" ? "Open" : "Review"}<span className="sr-only"> {r.patientName}, week {r.weekNumber}</span></Link>
                </Button>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div><dt className="text-slate-600">Adherence</dt><dd className="tabular font-semibold text-slate-900">{r.adherencePercent === null ? "Pending" : `${r.adherencePercent}%`}</dd></div>
                <div><dt className="text-slate-600">Quality</dt><dd>{r.status === "recording_due" ? <span className="text-slate-600">Pending</span> : <QualityChange change={r.qualityChange} />}</dd></div>
                <div><dt className="text-slate-600">Recording</dt><dd>{!r.recordingRequired ? <span className="text-slate-600">Not asked</span> : r.recordingAttached ? <StatusMark kind="done">Recorded</StatusMark> : <StatusMark kind={r.status === "recording_due" ? "attention" : "missed"}>{r.status === "recording_due" ? "Waiting" : "Not recorded"}</StatusMark>}</dd></div>
                <div><dt className="text-slate-600">Report</dt><dd>{r.status === "reviewed" ? <StatusMark kind="done">Reviewed</StatusMark> : r.status === "report_ready" ? <StatusMark kind="attention">Ready</StatusMark> : <StatusMark kind="pending">Waiting for patient</StatusMark>}</dd></div>
              </dl>
            </li>
          ))}
        </ul>
        <div className="relative mt-4 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[46rem] border-t border-slate-900 text-sm">
            <caption className="sr-only">Weekly reviews</caption>
            <thead>
              <tr className="text-left text-slate-600">
                <th scope="col" className="py-2 pr-4 font-semibold">Patient</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Week</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Adherence</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Quality</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Recording</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Report</th>
                <th scope="col" className="py-2 font-semibold"><span className="sr-only">Action</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-300 align-middle">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2.5">
                      <PatientAvatar name={r.patientName} src={r.patientImage} className="size-8" />
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900">{r.patientName}</p>
                        <p className="text-xs text-slate-600">{r.lastReviewedAt ? `Last reviewed ${new Date(r.lastReviewedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}` : "Not reviewed before"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4 tabular">Week {r.weekNumber}<span className="block text-xs text-slate-600">{formatDateKey(r.dueDate)}</span></td>
                  <td className="py-3 pr-4 tabular font-semibold text-slate-900">{r.adherencePercent === null ? <span className="font-normal text-slate-600">Pending</span> : `${r.adherencePercent}%`}</td>
                  <td className="py-3 pr-4">{r.status === "recording_due" ? <span className="text-slate-600">Pending</span> : <QualityChange change={r.qualityChange} />}</td>
                  <td className="py-3 pr-4">
                    {!r.recordingRequired ? <span className="text-slate-600">Not asked</span> : r.recordingAttached ? <StatusMark kind="done">Recorded</StatusMark> : <StatusMark kind={r.status === "recording_due" ? "attention" : "missed"}>{r.status === "recording_due" ? "Waiting" : "Not recorded"}</StatusMark>}
                  </td>
                  <td className="py-3 pr-4">
                    {r.status === "reviewed" ? <StatusMark kind="done">Reviewed</StatusMark> : r.status === "report_ready" ? <StatusMark kind="attention">Ready</StatusMark> : <StatusMark kind="pending">Waiting for patient</StatusMark>}
                  </td>
                  <td className="py-3 text-right">
                    <Button asChild size="sm" variant={r.status === "report_ready" ? "primary" : "outline"}>
                      <Link href={`/therapist/reviews/${r.id}`}>{r.status === "reviewed" ? "Open" : "Review"}<span className="sr-only"> {r.patientName}, week {r.weekNumber}</span></Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
      </div>
    </div>
  );
}
