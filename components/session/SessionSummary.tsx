import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Authorship, Button, SectionHeading, TickRow } from "@/components/ui";
import type { SessionRecord } from "@/lib/exercises/types";

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
  const tempo = session.averageTempo > 0 ? (Math.round(session.averageTempo * 10) / 10).toFixed(1) : null;
  const hints = session.warningCount;
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
              <span className="font-mono text-2xl font-semibold tabular">{rom}°</span>
              {previous && previous.rom > 0 && rom > 0 && <span className="block text-xs text-slate-600">{delta(rom, previous.rom, "°")}</span>}
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
          <div className="flex items-baseline justify-between gap-4 py-3">
            <dt>
              <span className="font-semibold text-slate-900">Form reminders</span>
              <span className="block text-sm text-slate-600">Times the camera suggested adjusting your position or movement.</span>
            </dt>
            <dd className="shrink-0 text-right">
              <span className="font-mono text-2xl font-semibold tabular">{hints}</span>
              <span className="block whitespace-nowrap text-xs text-slate-600">{hints === 0 ? "none came up" : "to work on"}</span>
            </dd>
          </div>
        </dl>
        <p className="mt-2 max-w-prose text-xs leading-relaxed text-slate-600">
          These are movement measurements from your camera, not a medical assessment. Your physiotherapist decides what they mean for your recovery.
        </p>
      </section>

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
