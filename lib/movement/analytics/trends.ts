/**
 * lib/movement/analytics/trends.ts
 *
 * Trends across sessions, from stored data only. Quality figures use only sessions the
 * movement engine judged rep by rep; older sessions still count toward consistency and
 * range but are never given a form score. Nothing here interprets a trend: it reports
 * what the numbers did.
 */
import { correctionRateOf, formAccuracyOf } from "@/lib/rehab/chunkQuality";

export interface TrendInput {
  id: string;
  /** ISO timestamp. */
  date: string;
  exerciseId: string;
  exerciseName: string;
  completedReps: number;
  targetReps: number;
  rom: number;
  unit?: "deg" | "pct";
  judged: boolean;
  validReps?: number;
  invalidReps?: number;
  partialReps?: number;
  correctionAttempts?: number;
  correctionsSucceeded?: number;
  avgConfidence?: number;
  avgRepSeconds?: number;
  errors?: { code: string; label?: string; reps: number }[];
}

export interface TrendPoint {
  id: string;
  date: string;
  completionPercent: number;
  validShare?: number;
  rom?: number;
  correctionRate?: number;
  avgConfidence?: number;
  avgRepSeconds?: number;
  partialReps?: number;
}

export interface RepeatedError {
  code: string;
  label?: string;
  /** Judged sessions this error appeared in. */
  sessions: number;
  of: number;
  reps: number;
}

export interface ExerciseTrend {
  exerciseId: string;
  name: string;
  unit: "deg" | "pct";
  /** Oldest first. */
  points: TrendPoint[];
  judgedSessions: number;
  /** Change in valid share from the first to the latest judged session in view, in points. */
  validShareChange?: number;
  repeated: RepeatedError[];
  /** Distinct calendar days with at least one session in the last 28 days. */
  activeDays28: number;
}

const DAY = 86_400_000;

export function buildTrends(sessions: TrendInput[], opts: { now?: Date; lastSessions?: number } = {}): ExerciseTrend[] {
  const now = (opts.now ?? new Date()).getTime();
  const keep = opts.lastSessions ?? 12;
  const byExercise = new Map<string, TrendInput[]>();
  for (const s of sessions) byExercise.set(s.exerciseId, [...(byExercise.get(s.exerciseId) ?? []), s]);

  const out: ExerciseTrend[] = [];
  for (const [exerciseId, all] of byExercise) {
    const sorted = [...all].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const recent = sorted.slice(-keep);
    const points: TrendPoint[] = recent.map((s) => ({
      id: s.id,
      date: s.date,
      completionPercent: s.targetReps > 0 ? Math.round((100 * s.completedReps) / s.targetReps) : 0,
      validShare: s.judged ? formAccuracyOf(s.validReps, s.invalidReps) : undefined,
      rom: s.rom > 0 ? Math.round(s.rom) : undefined,
      correctionRate: s.judged ? correctionRateOf(s.correctionAttempts, s.correctionsSucceeded) : undefined,
      avgConfidence: s.judged ? s.avgConfidence : undefined,
      avgRepSeconds: s.avgRepSeconds && s.avgRepSeconds > 0 ? Math.round(s.avgRepSeconds * 10) / 10 : undefined,
      partialReps: s.judged ? s.partialReps : undefined,
    }));

    const judged = recent.filter((s) => s.judged);
    const shares = points.filter((p) => p.validShare !== undefined);
    const validShareChange = shares.length >= 2 ? (shares[shares.length - 1].validShare as number) - (shares[0].validShare as number) : undefined;

    const seen = new Map<string, RepeatedError>();
    for (const s of judged) {
      for (const e of s.errors ?? []) {
        const cur = seen.get(e.code);
        seen.set(e.code, { code: e.code, label: e.label ?? cur?.label, sessions: (cur?.sessions ?? 0) + 1, of: judged.length, reps: (cur?.reps ?? 0) + e.reps });
      }
    }
    const repeated = [...seen.values()].filter((r) => r.sessions >= 3 && r.sessions / judged.length >= 0.4).sort((a, b) => b.sessions - a.sessions || b.reps - a.reps);

    const days = new Set(sorted.filter((s) => now - new Date(s.date).getTime() <= 28 * DAY).map((s) => new Date(s.date).toDateString()));
    out.push({ exerciseId, name: sorted[sorted.length - 1].exerciseName, unit: sorted[sorted.length - 1].unit ?? "deg", points, judgedSessions: judged.length, validShareChange, repeated, activeDays28: days.size });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
