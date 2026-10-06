import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Authorship, Button, SectionHeading, TickRow } from "@/components/ui";
import type { SessionRecord } from "@/lib/exercises/types";
import { issueLabel } from "@/lib/rehab/issueLabels";
import SessionReportCard from "@/components/reports/SessionReportCard";
import { correctionRateOf } from "@/lib/rehab/chunkQuality";

interface SessionSummaryProps {
  session: SessionRecord;
  /** The previous saved session of the same exercise, for an honest comparison. */
  previous?: SessionRecord | null;
}

function delta(now: number, before: number, unit = "") {
  const d = Math.round(now - before);
  if (d === 0) return `same as last time`;
  return `${d > 0 ? "+" : "−"}${Math.abs(d)}${unit} vs last time`;
}

export default function SessionSummary({ session, previous }: SessionSummaryProps) {
  const reps = session.completedReps;
  const target = session.targetReps;
  const complete = reps >= target && target > 0;
  const rom = Math.round(session.rom || 0);
  const unit = session.unit === "pct" ? "%" : "°";
  const tempo = session.averageTempo && session.averageTempo > 0 ? (Math.round(session.averageTempo * 10) / 10).toFixed(1) : null;
  const judged = session.validReps !== undefined && session.invalidReps !== undefined;
  const noted = session.invalidReps ?? 0;
  const topErrors = Object.entries(session.errors ?? {})
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3);
  const corrected = correctionRateOf(session.correctionAttempts, session.correctionsSucceeded);
  const when = new Date(session.date);

  const headline =
    reps === 0 ? "This session ended before any reps were counted" : complete ? `You completed all ${reps} reps` : `You completed ${reps} of ${target} reps`;

  const seconds = session.durationSeconds || 0;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{session.exerciseName}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {when.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} ·{" "}
          {when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
          {seconds > 0 && <> · {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</>}
        </p>
      </header>

      <section aria-label="Repetitions" className="border-t-2 border-slate-900 pt-4">
        <p className="text-xl font-bold text-slate-900">{headline}</p>
        <div className="mt-3">
          <TickRow total={target} done={reps} size={22} label={`${reps} of ${target} reps done`} />
        </div>
        {!complete && reps > 0 && (
          <p className="mt-3 max-w-prose text-sm text-slate-700">
            Stopping early is fine. Your reps are saved, and you can pick this exercise up again from Today.
          </p>
        )}
      </section>

      <section aria-label="What the camera measured" className="mt-8">
        <SectionHeading title="What the camera measured" action={<Authorship by="automated" />} />
        <dl className="divide-y divide-slate-200">
          <div className="flex items-baseline justify-between gap-4 py-3">
            <dt>
              <span className="font-semibold text-slate-900">Range of motion</span>
              <span className="block text-sm text-slate-600">How far you moved the joint, from smallest to largest angle.</span>
            </dt>
            <dd className="shrink-0 text-right">
              <span className="font-mono text-2xl font-semibold tabular">{rom > 0 ? `${rom}${unit}` : "—"}</span>
              {previous && previous.rom > 0 && rom > 0 && (previous.unit ?? "deg") === (session.unit ?? "deg") && <span className="block text-xs text-slate-600">{delta(rom, previous.rom, unit)}</span>}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-3">
            <dt>
              <span className="font-semibold text-slate-900">Rep speed</span>
              <span className="block text-sm text-slate-600">Average time for one rep. Slow and steady is the aim.</span>
            </dt>
            <dd className="shrink-0 text-right">
              <span className="font-mono text-2xl font-semibold tabular">{tempo ? `${tempo}s` : "—"}</span>
            </dd>
          </div>
          {judged && (
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt>
                <span className="font-semibold text-slate-900">Reps with good form</span>
                <span className="block text-sm text-slate-600">Every rep counts toward your target. This is how many also met the form checks.</span>
              </dt>
              <dd className="shrink-0 text-right">
                <span className="font-mono text-2xl font-semibold tabular">{session.validReps}</span>
                <span className="block whitespace-nowrap text-xs text-slate-600">{noted === 0 ? "of every rep counted" : `${noted} counted with a note`}</span>
              </dd>
            </div>
          )}
          {judged && topErrors.length > 0 && (
            <div className="py-3">
              <dt className="font-semibold text-slate-900">Things to work on</dt>
              <dd>
                <ul className="mt-1 space-y-0.5 text-sm text-slate-800">
                  {topErrors.map(([code, e]) => (
                    <li key={code}>
                      {issueLabel(code)} <span className="text-slate-600">in {e.count} {e.count === 1 ? "rep" : "reps"}</span>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
          {corrected !== undefined && (
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt>
                <span className="font-semibold text-slate-900">Corrections that worked</span>
                <span className="block text-sm text-slate-600">Times a spoken or on-screen tip was followed by a fix.</span>
              </dt>
              <dd className="shrink-0 text-right">
                <span className="font-mono text-2xl font-semibold tabular">{session.correctionsSucceeded}</span>
                <span className="block whitespace-nowrap text-xs text-slate-600">of {session.correctionAttempts}</span>
              </dd>
            </div>
          )}
        </dl>
        <p className="mt-2 max-w-prose text-xs leading-relaxed text-slate-600">
          These are movement measurements from your camera, not a medical assessment. Your physiotherapist decides what they mean for your recovery.
        </p>
      </section>

      {session.serverId && judged && (
        <section aria-label="Session summary" className="mt-8">
          <SectionHeading title="Session summary" description="Made from what the camera recorded." />
          <div className="mt-3">
            <SessionReportCard sessionId={session.serverId} audience="patient" />
          </div>
        </section>
      )}

      <div className="mt-8 flex flex-col gap-2 sm:flex-row">
        <Button asChild size="lg" className="sm:min-w-44">
          <Link href="/">Back to today</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/progress">
            See your progress <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
