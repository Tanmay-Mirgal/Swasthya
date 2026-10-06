import { Authorship, EmptyState, SectionHeading } from "@/components/ui";
import type { ExerciseTrend } from "@/lib/movement/analytics/trends";
import { issueLabel } from "@/lib/rehab/issueLabels";

const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/**
 * How well each session went, by the exercise's own form checks: the share of counted reps
 * that met them, how often a suggestion was followed by a fix, and how clearly the camera
 * saw. A plain ruled table, newest first. It reports changes; it never interprets them.
 */
export default function QualityTrend({ trend, className }: { trend: ExerciseTrend; className?: string }) {
  const rows = trend.points.filter((p) => p.validShare !== undefined).slice(-8).reverse();
  const change = trend.validShareChange;
  const first = trend.points.find((p) => p.validShare !== undefined);
  return (
    <section aria-label="Form over time" className={className}>
      <SectionHeading title="Form over time" description="The share of counted reps that met this exercise’s form checks, session by session." action={<Authorship by="automated" />} />
      {rows.length === 0 ? (
        <EmptyState className="mt-3" title="No form checks yet">Sessions recorded from now on will show how many reps met the form checks.</EmptyState>
      ) : (
        <>
          {change !== undefined && first && (
            <p className="mt-3 text-sm text-slate-800">
              {change === 0 ? "No change" : <><span className="font-mono font-semibold tabular">{change > 0 ? "Up" : "Down"} {Math.abs(change)}</span> points</>} since {fmt(first.date)}.
            </p>
          )}
          <div className="relative mt-2 overflow-x-auto">
            <table className="w-full min-w-[26rem] text-sm">
              <caption className="sr-only">Form checks by session for {trend.name}</caption>
              <thead>
                <tr className="border-b border-slate-900 text-left text-slate-600">
                  <th scope="col" className="py-2 pr-3 font-semibold">Session</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Met the checks</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Suggestions that worked</th>
                  <th scope="col" className="py-2 font-semibold">Camera view</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-slate-200">
                    <td className="py-2 pr-3 text-slate-800">{fmt(p.date)}</td>
                    <td className="py-2 pr-3">
                      <span className="flex items-center gap-2">
                        <span aria-hidden="true" className="h-2 w-20 overflow-hidden rounded-[2px] bg-slate-200">
                          <span className="block h-full bg-emerald-700" style={{ width: `${p.validShare}%` }} />
                        </span>
                        <span className="font-mono font-semibold tabular text-slate-900">{p.validShare}%</span>
                      </span>
                    </td>
                    <td className="py-2 pr-3 tabular text-slate-800">{p.correctionRate !== undefined ? `${p.correctionRate}%` : "None needed"}</td>
                    <td className="py-2 tabular text-slate-800">{p.avgConfidence !== undefined ? (p.avgConfidence >= 0.8 ? "Clear" : p.avgConfidence >= 0.6 ? "Fair" : "Unclear") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {trend.repeated.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-bold text-slate-900">Came up again and again</h3>
              <ul className="mt-1 text-sm text-slate-800">
                {trend.repeated.map((r) => (
                  <li key={r.code} className="border-t border-slate-200 py-1.5">
                    <span className="bg-amber-100 px-1 font-semibold text-amber-950">{r.label ?? issueLabel(r.code)}</span> in {r.sessions} of {r.of} sessions ({r.reps} reps)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      <p className="mt-3 text-xs text-slate-600">Practised on <span className="tabular font-semibold">{trend.activeDays28}</span> of the last 28 days.</p>
    </section>
  );
}
