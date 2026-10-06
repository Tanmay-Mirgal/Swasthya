import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Authorship, SectionHeading, StatusMark, TickRow } from "@/components/ui";
import { formatDateKey } from "@/lib/rehab/dates";
import { issueLabel } from "@/lib/rehab/issueLabels";
import type { WeeklyReportData } from "./types";

function Fact({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className="font-mono text-2xl font-bold tabular text-slate-900">{value}</dd>
      {note && <dd className="text-xs text-slate-600">{note}</dd>}
    </div>
  );
}

export function QualityChange({ change }: { change?: number | null }) {
  if (change === null || change === undefined) return <span className="text-slate-600">No earlier week to compare</span>;
  if (change === 0) return <span className="inline-flex items-center gap-1 font-semibold text-slate-800"><Minus className="size-4" aria-hidden="true" /> No change</span>;
  const up = change > 0;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
      <Icon className="size-4" aria-hidden="true" /> {up ? "Up" : "Down"} {Math.abs(change)} {Math.abs(change) === 1 ? "point" : "points"} on last week
    </span>
  );
}

const DISCOMFORT_LABEL = { mild: "Mild", moderate: "Moderate", severe: "Severe" } as const;

/** A weekly report, from stored data only. Automated measurements are labelled as such. */
export default function ReportView({ report }: { report: WeeklyReportData }) {
  return (
    <div className="space-y-8">
      <section aria-label="Summary">
        <SectionHeading title="Sets and adherence" description={`${formatDateKey(report.weekStart, { day: "numeric", month: "short" })} to ${formatDateKey(report.weekEnd, { day: "numeric", month: "short" })}, from the sets the patient completed.`} />
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          <Fact label="Adherence" value={report.adherencePercent === null ? "None due" : `${report.adherencePercent}%`} note="sets done of sets due" />
          <Fact label="Sets" value={`${report.setsCompleted} of ${report.setsPrescribed}`} />
          <Fact label="Reps" value={`${report.repsCompleted} of ${report.repsPrescribed}`} />
          <Fact label="Days complete" value={`${report.daysCompleted} of ${report.daysDue}`} note={report.daysMissed > 0 ? `${report.daysMissed} ${report.daysMissed === 1 ? "day" : "days"} with nothing logged` : "No missed days"} />
        </dl>
      </section>

      <section aria-label="Exercises">
        <SectionHeading title="By exercise" />
        {report.exercises.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No exercises were due this week.</p>
        ) : (
          <>
          <ul className="mt-3 border-t border-slate-900 sm:hidden">
            {report.exercises.map((e) => (
              <li key={e.exerciseKey} className="border-b border-slate-300 py-3">
                <p className="font-bold text-slate-900">{e.name}</p>
                <TickRow total={Math.min(e.setsPrescribed, 30)} done={Math.min(e.setsCompleted, 30)} size={12} wrapAt={30} label={`${e.setsCompleted} of ${e.setsPrescribed} sets`} className="mt-1.5" />
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div><dt className="text-slate-600">Sets</dt><dd className="tabular font-semibold text-slate-900">{e.setsCompleted} of {e.setsPrescribed}</dd></div>
                  <div><dt className="text-slate-600">Reps</dt><dd className="tabular font-semibold text-slate-900">{e.repsCompleted} of {e.repsPrescribed}</dd></div>
                  <div><dt className="text-slate-600">Range of motion</dt><dd className="tabular font-semibold text-slate-900">{e.averageRom ? `${e.averageRom}${e.romUnit === "pct" ? "%" : "°"}` : "Not measured"}</dd></div>
                  <div><dt className="text-slate-600">Form score</dt><dd className="tabular font-semibold text-slate-900">{e.averageFormScore !== undefined ? `${e.averageFormScore}%` : "Not measured"}</dd></div>
                </dl>
              </li>
            ))}
          </ul>
          <div className="relative mt-3 hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[34rem] border-t border-slate-900 text-sm">
              <caption className="sr-only">Sets, reps, range of motion and form score by exercise</caption>
              <thead>
                <tr className="text-left text-slate-600">
                  <th scope="col" className="py-2 pr-3 font-semibold">Exercise</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Sets</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Reps</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Range of motion</th>
                  <th scope="col" className="py-2 font-semibold">Form score</th>
                </tr>
              </thead>
              <tbody>
                {report.exercises.map((e) => (
                  <tr key={e.exerciseKey} className="border-t border-slate-300 align-top">
                    <th scope="row" className="py-3 pr-3 text-left font-bold text-slate-900">{e.name}</th>
                    <td className="py-3 pr-3 tabular">
                      <TickRow total={Math.min(e.setsPrescribed, 30)} done={Math.min(e.setsCompleted, 30)} size={12} wrapAt={30} label={`${e.setsCompleted} of ${e.setsPrescribed} sets`} />
                      <span className="mt-1 block text-slate-700">{e.setsCompleted} of {e.setsPrescribed}</span>
                    </td>
                    <td className="py-3 pr-3 tabular text-slate-800">{e.repsCompleted} of {e.repsPrescribed}</td>
                    <td className="py-3 pr-3 tabular text-slate-800">{e.averageRom ? `${e.averageRom}${e.romUnit === "pct" ? "%" : "°"}` : "Not measured"}</td>
                    <td className="py-3 tabular text-slate-800">{e.averageFormScore !== undefined ? `${e.averageFormScore}%` : "Not measured"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>

      <section aria-label="Movement measured by the camera">
        <SectionHeading title="Movement quality" action={<Authorship by="automated" />} description="Counted on the patient’s device. This is guidance, not a clinical assessment." />
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
          <Fact label={report.formBasis === "legacy" ? "Form score (older, pace-based)" : "Reps that met the form checks"} value={report.averageFormScore !== undefined ? `${report.averageFormScore}%` : "Not measured"} />
          <Fact label="Average range of motion" value={report.averageRom ? `${report.averageRom}°` : "Not measured"} />
          <div className="col-span-2 min-w-0 sm:col-span-1">
            <dt className="text-sm text-slate-600">Compared with last week</dt>
            <dd className="mt-1 text-base"><QualityChange change={report.qualityChange} /></dd>
          </div>
        </dl>
        {report.quality && (
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            <Fact label="Met the form checks" value={String(report.quality.validReps)} />
            <Fact label="Counted with a note" value={String(report.quality.invalidReps)} />
            <Fact label="Partial attempts" value={String(report.quality.partialReps)} />
            <Fact
              label="Suggestions that worked"
              value={report.quality.correctionAttempts ? `${report.quality.correctionsSucceeded} of ${report.quality.correctionAttempts}` : "None needed"}
            />
          </dl>
        )}
        {report.quality && report.quality.repeatedErrors.length > 0 && (
          <div className="mt-5">
            <h3 className="text-sm font-bold text-slate-900">Repeated in the most reps</h3>
            <ol className="mt-1 border-t border-slate-300">
              {report.quality.repeatedErrors.map((f, i) => (
                <li key={f.code} className="flex items-baseline justify-between gap-3 border-b border-slate-300 py-2 text-sm">
                  <span className="text-slate-900"><span className="tabular text-slate-500">{i + 1}.</span> {f.label ?? issueLabel(f.code)}</span>
                  <span className="tabular text-slate-700">{f.reps} {f.reps === 1 ? "rep" : "reps"}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        <div className="mt-5">
          <h3 className="text-sm font-bold text-slate-900">Most common feedback</h3>
          {report.commonFeedback.length === 0 ? (
            <p className="mt-1 text-sm text-slate-600">No movement feedback was recorded this week.</p>
          ) : (
            <ol className="mt-1 border-t border-slate-300">
              {report.commonFeedback.map((f, i) => (
                <li key={f.code} className="flex items-baseline justify-between gap-3 border-b border-slate-300 py-2 text-sm">
                  <span className="text-slate-900"><span className="tabular text-slate-500">{i + 1}.</span> {f.label ?? issueLabel(f.code)}</span>
                  <span className="tabular text-slate-700">{f.count} {f.count === 1 ? "time" : "times"}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <section aria-label="Reported discomfort">
        <SectionHeading title="Discomfort the patient reported" description="In their own words, only when they chose to say." />
        {report.discomfortReports.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">Nothing was reported this week.</p>
        ) : (
          <ul className="mt-3 border-t border-slate-300">
            {report.discomfortReports.map((d, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 py-2 text-sm">
                <span className="text-slate-900">{d.exerciseName}, {formatDateKey(d.day, { weekday: "short", day: "numeric", month: "short" })}</span>
                <StatusMark kind={d.level === "mild" ? "info" : "attention"}>{DISCOMFORT_LABEL[d.level]}</StatusMark>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
