"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, EmptyState, PageHeader, SectionHeading, Select, Tabs, TickRow } from "@/components/ui";
import RomChart from "@/components/progress/RomChart";
import QualityTrend from "@/components/progress/QualityTrend";
import { buildTrends } from "@/lib/movement/analytics/trends";
import { progressFacts, type HistorySession } from "@/lib/rehab/progressFacts";
import AdherenceGrid from "@/components/progress/AdherenceGrid";
import { dayKey, startOfDay } from "@/components/progress/dates";

export interface ProgressSession {
  id: string;
  exerciseId: string;
  exerciseName: string;
  /** ISO date */
  date: string;
  completedReps: number;
  targetReps: number;
  rom: number;
  durationSeconds?: number;
  /** Unit of `rom`. */
  unit?: "deg" | "pct";
  /** True when the movement engine judged each rep (engine v2 data). */
  judged?: boolean;
  validReps?: number;
  invalidReps?: number;
  partialReps?: number;
  correctionAttempts?: number;
  correctionsSucceeded?: number;
  avgConfidence?: number;
  avgRepSeconds?: number;
  errors?: { code: string; label?: string; reps: number }[];
}

type RangeId = "7" | "30" | "90";
const RANGES = [
  { id: "7", label: "7 days", days: 7 },
  { id: "30", label: "30 days", days: 30 },
  { id: "90", label: "3 months", days: 90 },
] as const;

function groupLabel(d: Date): string {
  const today = startOfDay(new Date());
  const diff = Math.round((today.getTime() - startOfDay(d).getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function ProgressView({ sessions, loading }: { sessions: ProgressSession[]; loading?: boolean }) {
  const [range, setRange] = useState<RangeId>("30");
  const [exerciseId, setExerciseId] = useState<string>("");
  const [showAll, setShowAll] = useState(false);

  const days = RANGES.find((r) => r.id === range)!.days;
  const cutoff = useMemo(() => {
    const d = startOfDay(new Date());
    d.setDate(d.getDate() - (days - 1));
    return d;
  }, [days]);

  const inRange = useMemo(
    () => sessions.filter((s) => new Date(s.date) >= cutoff).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [sessions, cutoff]
  );

  const doneKeys = useMemo(() => new Set(inRange.map((s) => dayKey(new Date(s.date)))), [inRange]);
  const totalReps = inRange.reduce((n, s) => n + s.completedReps, 0);

  const exercises = useMemo(() => {
    const map = new Map<string, string>();
    inRange.forEach((s) => map.set(s.exerciseId, s.exerciseName));
    return [...map.entries()];
  }, [inRange]);
  const activeExercise = exercises.some(([id]) => id === exerciseId) ? exerciseId : exercises[0]?.[0] ?? "";

  const romPoints = useMemo(
    () =>
      inRange
        .filter((s) => s.exerciseId === activeExercise && s.rom > 0)
        .map((s) => ({ date: new Date(s.date), rom: Math.round(s.rom) }))
        .sort((a, b) => a.date.getTime() - b.date.getTime()),
    [inRange, activeExercise]
  );

  const trend = useMemo(
    () => buildTrends(inRange.filter((s) => s.exerciseId === activeExercise).map((s) => ({ ...s, judged: Boolean(s.judged) }))).find((t) => t.exerciseId === activeExercise),
    [inRange, activeExercise]
  );
  const unit: "°" | "%" = trend?.unit === "pct" ? "%" : "°";

  // "Best range so far" over every session of this exercise (not just this period), only with enough judged history.
  const bestRange = useMemo(() => {
    const history: HistorySession[] = sessions
      .filter((s) => s.exerciseId === activeExercise)
      .map((s) => ({ dateKey: String(s.date).slice(0, 10), exerciseId: s.exerciseId, judged: Boolean(s.judged), validReps: s.validReps, invalidReps: s.invalidReps, rom: s.rom, romUnit: s.unit ?? "deg" }));
    return progressFacts(null, history).personalBest;
  }, [sessions, activeExercise]);

  const grouped = useMemo(() => {
    const g = new Map<string, ProgressSession[]>();
    inRange.forEach((s) => {
      const k = groupLabel(new Date(s.date));
      g.set(k, [...(g.get(k) ?? []), s]);
    });
    return [...g.entries()];
  }, [inRange]);

  const VISIBLE_DAYS = 5;
  const shownGroups = showAll ? grouped : grouped.slice(0, VISIBLE_DAYS);
  const tabs = RANGES.map((r) => ({ id: r.id, label: r.label }));

  if (!loading && sessions.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <PageHeader title="Progress" description="Your sessions, how often you exercise, and how your movement changes." />
        <EmptyState
          title="No sessions yet"
          action={
            <Button asChild>
              <Link href="/exercise">Start an exercise</Link>
            </Button>
          }
        >
          Finish your first tracked exercise and your history will start building here: the days you exercised, your range of motion over time, and each session.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader title="Progress" description="Your sessions, how often you exercise, and how your movement changes." />
      <Tabs items={tabs} value={range} onChange={(id) => setRange(id as RangeId)} label="Time range" />

      <div role="tabpanel" id={`panel-${range}`} aria-labelledby={`tab-${range}`} className="mt-6 space-y-10">
        <dl className="grid grid-cols-3 divide-x divide-slate-300 rounded-xl border border-slate-300 bg-white">
          {[
            { label: "Sessions", value: inRange.length },
            { label: "Reps", value: totalReps },
            { label: "Days active", value: `${doneKeys.size}/${days}` },
          ].map((stat) => (
            <div key={stat.label} className="px-4 py-3 sm:px-6 sm:py-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">{stat.label}</dt>
              <dd className="mt-1 font-mono text-2xl font-bold tabular text-slate-900 sm:text-3xl">{stat.value}</dd>
            </div>
          ))}
        </dl>

        <div className="grid gap-x-12 gap-y-10 lg:grid-cols-2">
          <section aria-label="Adherence" className="min-w-0">
            <SectionHeading
              title={`${doneKeys.size} of the last ${days} days`}
              description="Days with at least one tracked session. Today is outlined."
            />
            <div className="mt-4">
              <AdherenceGrid days={days} doneKeys={doneKeys} />
            </div>
          </section>

          <section aria-label="Range of motion" className="min-w-0">
            <SectionHeading
              title="Range of motion"
              description="How far you move the joint each session, measured by your camera. Not a clinical measurement."
            />
            {exercises.length > 1 && (
              <div className="mt-3">
                <Select aria-label="Exercise" value={activeExercise} onChange={(e) => setExerciseId(e.target.value)} className="h-9 w-auto">
                  {exercises.map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </Select>
              </div>
            )}
            <div className="mt-3">
              {romPoints.length === 0 ? (
                <EmptyState title="No range-of-motion readings in this period">Readings appear after a session where the camera tracked your full movement.</EmptyState>
              ) : (
                <>
                  <p className="mb-1 text-sm font-semibold text-slate-900">{exercises.find(([id]) => id === activeExercise)?.[1]}</p>
                  <RomChart points={romPoints} unit={unit} />
                  {bestRange && <p className="mt-2 text-base text-slate-900">Your best range so far: <span className="font-mono font-semibold tabular">{Math.round(bestRange.rom)}{bestRange.unit === "pct" ? "%" : "°"}</span></p>}
                </>
              )}
            </div>
          </section>
        </div>

        {trend && <QualityTrend trend={trend} />}

        <section aria-label="Session history" className="min-w-0">
          <SectionHeading title="Sessions" description={`${inRange.length} in this period, newest first.`} />
          {loading ? (
            <p role="status" className="mt-4 text-sm text-slate-600">Loading your sessions…</p>
          ) : inRange.length === 0 ? (
            <EmptyState className="mt-4" title="No sessions in this period">Pick a longer range, or start an exercise.</EmptyState>
          ) : (
            <div className="mt-4 space-y-6">
              {shownGroups.map(([label, list]) => {
                const dayReps = list.reduce((n, s) => n + s.completedReps, 0);
                return (
                  <div key={label} className="border-t border-slate-900 pt-3 md:grid md:grid-cols-[9rem_minmax(0,1fr)] md:gap-6">
                    <div className="flex items-baseline justify-between gap-3 md:block">
                      <h3 className="text-base font-bold text-slate-900">{label}</h3>
                      <p className="text-sm text-slate-600 md:mt-1">
                        <span className="font-mono font-semibold tabular text-slate-900">{list.length}</span> {list.length === 1 ? "session" : "sessions"} ·{" "}
                        <span className="font-mono font-semibold tabular text-slate-900">{dayReps}</span> reps
                      </p>
                    </div>
                    <ul className="mt-3 grid gap-3 sm:grid-cols-2 md:mt-0 xl:grid-cols-3">
                      {list.map((s) => {
                        const complete = s.completedReps >= s.targetReps;
                        const stats = [
                          { label: "Reps", value: `${s.completedReps}/${s.targetReps}` },
                          { label: "Range", value: s.rom > 0 ? `${Math.round(s.rom)}${s.unit === "pct" ? "%" : "°"}` : "—" },
                          { label: "Time", value: s.durationSeconds ? `${Math.floor(s.durationSeconds / 60)}:${String(s.durationSeconds % 60).padStart(2, "0")}` : "—" },
                        ];
                        return (
                          <li key={s.id} className="rounded-xl border border-slate-300 bg-white p-4">
                            <div className="flex items-start justify-between gap-3">
                              <p className="font-semibold leading-snug text-slate-900">{s.exerciseName}</p>
                              <time className="shrink-0 text-xs text-slate-600" dateTime={s.date}>
                                {new Date(s.date).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                              </time>
                            </div>
                            <div className="mt-2.5 min-h-[14px]">
                              {s.targetReps <= 20 ? <TickRow total={s.targetReps} done={s.completedReps} size={14} /> : null}
                            </div>
                            <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-200 pt-3">
                              {stats.map((st) => (
                                <div key={st.label}>
                                  <dt className="text-xs text-slate-600">{st.label}</dt>
                                  <dd className="font-mono text-sm font-semibold tabular text-slate-900">{st.value}</dd>
                                </div>
                              ))}
                            </dl>
                            {(s.judged && s.validReps !== undefined) || !complete ? (
                              <p className="mt-2.5 text-xs text-slate-700">
                                {s.judged && s.validReps !== undefined && (
                                  <span><span className="font-mono font-semibold tabular">{s.validReps}</span> clean {s.validReps === 1 ? "rep" : "reps"}</span>
                                )}
                                {s.judged && s.validReps !== undefined && !complete && " · "}
                                {!complete && <span>Stopped early</span>}
                              </p>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
              {grouped.length > VISIBLE_DAYS && (
                <div className="flex justify-center">
                  <Button variant="outline" onClick={() => setShowAll((v) => !v)}>
                    {showAll ? "Show fewer days" : `Show ${grouped.length - VISIBLE_DAYS} earlier ${grouped.length - VISIBLE_DAYS === 1 ? "day" : "days"}`}
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
