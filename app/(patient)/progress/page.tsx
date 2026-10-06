/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/react";
import AppShell from "@/components/layout/AppShell";
import ProgressView, { type ProgressSession } from "@/components/patient/ProgressView";
import Link from "next/link";
import { Button, Notice, SectionHeading, StatusMark } from "@/components/ui";
import { formatDateKey } from "@/lib/rehab/dates";
import { getSessionHistory } from "@/lib/session/sessionStore";

interface DbSession {
  _id: string;
  exerciseId: string;
  exerciseName: string;
  date: string;
  completedReps: number;
  targetReps: number;
  rom?: number;
  durationSeconds?: number;
  romUnit?: "deg" | "pct";
  engineVersion?: number;
  validReps?: number;
  invalidReps?: number;
  partialReps?: number;
  correctionAttempts?: number;
  correctionsSucceeded?: number;
  avgConfidence?: number;
  avgRepSeconds?: number;
  errorList?: { code: string; label?: string; reps: number }[];
}

/** Account sessions first; sessions that only exist on this device are added (matched by exercise and time). */
function mergeSessions(db: DbSession[], local: ReturnType<typeof getSessionHistory>): ProgressSession[] {
  const toKey = (exerciseId: string, date: string) => `${exerciseId}|${Math.round(new Date(date).getTime() / 5000)}`;
  const out: ProgressSession[] = db.map((s) => ({
    id: s._id,
    exerciseId: s.exerciseId,
    exerciseName: s.exerciseName,
    date: new Date(s.date).toISOString(),
    completedReps: s.completedReps,
    targetReps: s.targetReps,
    rom: s.rom ?? 0,
    durationSeconds: s.durationSeconds,
    unit: s.romUnit,
    judged: (s.engineVersion ?? 0) >= 2 && s.validReps !== undefined,
    validReps: s.validReps,
    invalidReps: s.invalidReps,
    partialReps: s.partialReps,
    correctionAttempts: s.correctionAttempts,
    correctionsSucceeded: s.correctionsSucceeded,
    avgConfidence: s.avgConfidence,
    avgRepSeconds: s.avgRepSeconds,
    errors: s.errorList,
  }));
  const seen = new Set(out.map((s) => toKey(s.exerciseId, s.date)));
  for (const s of local) {
    if (seen.has(toKey(s.exerciseId, s.date))) continue;
    out.push({
      id: s.id,
      exerciseId: s.exerciseId,
      exerciseName: s.exerciseName,
      date: s.date,
      completedReps: s.completedReps,
      targetReps: s.targetReps,
      rom: s.rom,
      durationSeconds: s.durationSeconds,
      unit: s.unit,
      judged: (s.engine ?? 0) >= 2 && s.validReps !== undefined,
      validReps: s.validReps,
      invalidReps: s.invalidReps,
      partialReps: s.partialReps,
      correctionAttempts: s.correctionAttempts,
      correctionsSucceeded: s.correctionsSucceeded,
      avgConfidence: s.avgConfidence,
      avgRepSeconds: s.averageTempo,
      errors: Object.entries(s.errors ?? {}).map(([code, e]) => ({ code, reps: e.count })),
    });
  }
  return out;
}

interface ReportRow {
  id: string;
  weekNumber: number;
  dueDate: string;
  status: string;
  adherencePercent: number | null;
  reviewed: boolean;
}

export default function ProgressPage() {
  const router = useRouter();
  const { user } = useUser();
  const { getToken, isSignedIn } = useAuth();
  const [sessions, setSessions] = useState<ProgressSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [reports, setReports] = useState<ReportRow[]>([]);

  useEffect(() => {
    if (user?.publicMetadata?.role === "therapist") {
      router.replace("/therapist");
      return;
    }
    if (!isSignedIn) return;
    const local = getSessionHistory();
    setSessions(mergeSessions([], local));

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const token = await getToken();
        if (!token) return;
        const [res, rep] = await Promise.all([
          fetch("/api/patient/session", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/patient/weekly-reviews", { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
        ]);
        const repJson = rep && rep.ok ? await rep.json().catch(() => null) : null;
        if (!cancelled && repJson?.success) setReports(repJson.data);
        const json = await res.json();
        if (cancelled) return;
        if (res.ok && json.success) {
          setSessions(mergeSessions(json.data.sessions ?? [], local));
          setError(null);
        } else {
          setError("We couldn’t load your saved sessions, so only sessions from this device are shown.");
        }
      } catch {
        if (!cancelled) setError("We couldn’t reach Swasthya, so only sessions from this device are shown.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, router, isSignedIn, getToken, attempt]);

  return (
    <AppShell title="Progress" maxWidth="wide">
      {error && (
        <Notice
          className="mb-5"
          tone="warning"
          title="Showing what’s on this device"
          action={<Button size="sm" variant="secondary" onClick={() => setAttempt((n) => n + 1)}>Try again</Button>}
        >
          {error}
        </Notice>
      )}
      <ProgressView sessions={sessions} loading={loading && sessions.length === 0} />
      {reports.length > 0 && (
        <section aria-label="Weekly reports" className="mt-10 max-w-3xl">
          <SectionHeading title="Weekly reports" description="Your week, from the sets you completed, and your therapist’s note once they have reviewed it." />
          <ul className="mt-3 border-t border-slate-900">
            {reports.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 py-3">
                <div>
                  <p className="font-bold text-slate-900">Week {r.weekNumber}</p>
                  <p className="text-sm text-slate-600">{formatDateKey(r.dueDate, { day: "numeric", month: "short" })}{r.adherencePercent !== null ? ` · ${r.adherencePercent}% of sets` : ""}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusMark kind={r.reviewed ? "done" : "pending"}>{r.reviewed ? "Reviewed" : r.status === "recording_due" ? "Recording due" : "With your therapist"}</StatusMark>
                  <Button asChild size="sm" variant="outline"><Link href={`/reviews/${r.id}`}>Open<span className="sr-only"> week {r.weekNumber}</span></Link></Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </AppShell>
  );
}
