import Link from "next/link";
import Image from "next/image";
import { CalendarClock, Camera, MessageSquare, Pill, Play, Video } from "lucide-react";
import { Button, DayTicks, EmptyState, Notice, SectionHeading, SetsGrid, StatusMark, TickRow } from "@/components/ui";
import type { PlanSnapshot } from "@/lib/rehab/sessionService";
import { getPrescribableExercise } from "@/lib/rehab/exerciseCatalog";
import { exerciseGuideImage } from "@/lib/exercises/presentation";
import { formatDateKey } from "@/lib/rehab/dates";
import { cn } from "@/lib/utils";

export interface PatientHomeProps {
  firstName?: string;
  dateLabel: string;
  greeting: string;
  plan: PlanSnapshot;
  liveConsultation?: { id: string; doctorName: string; issue?: string } | null;
  therapist?: { name: string; specialization?: string; chatHref: string; profileHref: string; unread: number } | null;
  pendingReferral?: { therapistName?: string } | null;
  lastSession?: { exerciseName: string; dateLabel: string; reps: number; targetReps: number; rom?: number; durationLabel?: string } | null;
}

/** The link that starts (or resumes) a prescribed exercise. The live page reads set progress from the server. */
export function startHref(exerciseId: string, planId: string, exerciseKey: string, reviewId?: string) {
  const q = new URLSearchParams({ plan: planId, ex: exerciseKey });
  if (reviewId) q.set("review", reviewId);
  return `/exercise/${exerciseId}/setup?${q.toString()}`;
}

export default function PatientHome({ plan, liveConsultation, therapist, pendingReferral, lastSession, ...props }: PatientHomeProps) {
  const rx = plan.prescription;
  const daily = plan.daily;
  const exercises = daily?.exercises ?? [];
  const nextIndex = exercises.findIndex((e) => e.status !== "complete");
  const remaining = exercises.length - exercises.filter((e) => e.status === "complete").length;
  const review = plan.review;
  const reviewExercise = review?.recordingExerciseKey ? rx?.exercises.find((e) => e.key === review.recordingExerciseKey) : undefined;

  let summary: string;
  if (plan.state === "none") summary = "Your physiotherapist hasn’t prescribed a plan yet.";
  else if (plan.state === "paused") summary = "Your plan is paused.";
  else if (exercises.length === 0) summary = "Today is a rest day.";
  else if (remaining === 0) summary = "Everything on today’s sheet is done.";
  else summary = `${remaining} of ${exercises.length} ${exercises.length === 1 ? "exercise" : "exercises"} left today.`;
  if (daily && plan.state === "active") summary = `Day ${daily.dayNumber} of ${daily.totalDays}. ${summary}`;

  const next = nextIndex >= 0 ? exercises[nextIndex] : null;
  const nextCta = (e: NonNullable<typeof next>) => {
    const set = e.currentSetIndex !== null ? e.sets[e.currentSetIndex] : null;
    const started = e.completedReps > 0;
    return {
      href: startHref(e.exerciseId, rx!.id, e.key),
      label: started && set ? `Continue set ${set.index + 1} (${set.remainingReps} ${set.remainingReps === 1 ? "rep" : "reps"} left)` : "Start set 1",
    };
  };

  return (
    <div className="grid gap-x-10 gap-y-8 pb-20 md:pb-0 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-6">
        {liveConsultation && (
          <Notice
            tone="warning"
            title={`Your consultation with ${liveConsultation.doctorName} is open`}
            action={
              <Button asChild size="sm" variant="highlight">
                <Link href={`/consultation/${liveConsultation.id}`}>
                  <Video className="size-4" aria-hidden="true" /> Join
                </Link>
              </Button>
            }
          >
            {liveConsultation.issue ? `${liveConsultation.issue}. ` : ""}You can join from this device.
          </Notice>
        )}

        <header>
          <p className="text-sm font-medium text-slate-600">{props.dateLabel}</p>
          <h1 className="mt-0.5 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {props.greeting}
            {props.firstName ? `, ${props.firstName}` : ""}
          </h1>
          <p className="mt-1.5 text-base text-slate-700">{summary}</p>
        </header>

        {plan.state === "paused" && (
          <Notice tone="warning" title={`${rx?.doctorName || "Your therapist"} has paused your plan`}>
            You don’t need to do any exercises until they resume it. If you have questions, message them.
          </Notice>
        )}

        {plan.state === "active" && review && (
          review.recordingRequired && !review.recordingDone && reviewExercise ? (
            <Notice
              tone="warning"
              title={`Week ${review.week} review: record ${reviewExercise.name}`}
              action={
                <Button asChild size="sm" variant="highlight">
                  <Link href={startHref(reviewExercise.exerciseId, rx!.id, reviewExercise.key, review.id)}>
                    <Camera className="size-4" aria-hidden="true" /> Record
                  </Link>
                </Button>
              }
            >
              Your therapist asked for a short recording of this exercise today. It is only recorded when you start it, and only they can watch it.
            </Notice>
          ) : review.recordingRequired ? (
            <Notice tone="success" title={`Week ${review.week} review: recording sent`}>Your therapist will see it with your week’s report.</Notice>
          ) : (
            <Notice tone="info" title={`Week ${review.week} review day`}>Do today’s exercises as usual. Your therapist will review your week.</Notice>
          )
        )}

        <section aria-label="Today’s exercises">
          <SectionHeading title="Today’s exercises" />

          {plan.state === "none" ? (
            <EmptyState
              className="mt-3"
              title="No plan yet"
              action={
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm"><Link href="/discover">Find a physiotherapist</Link></Button>
                  <Button asChild size="sm" variant="outline"><Link href="/exercise">Try an exercise</Link></Button>
                </div>
              }
            >
              When a physiotherapist prescribes your exercises they appear here as a numbered sheet with the sets and reps they chose. You can try an exercise from the library in the meantime.
            </EmptyState>
          ) : plan.state === "paused" ? null : exercises.length === 0 ? (
            <EmptyState className="mt-3" title="Nothing due today">
              {plan.upcoming?.[0]
                ? `Your next exercises are on ${formatDateKey(plan.upcoming[0].day, { weekday: "long", day: "numeric", month: "short" })}.`
                : "There are no more exercise days left in this plan."}
            </EmptyState>
          ) : (
            <ol className="mt-1">
              {exercises.map((e, i) => {
                const meta = rx?.exercises.find((x) => x.key === e.key);
                const catalog = getPrescribableExercise(e.exerciseId);
                const img = exerciseGuideImage(e.exerciseId);
                const isNext = i === nextIndex;
                if (e.status === "complete") {
                  return (
                    <li key={e.key} className="flex items-center gap-3 border-b border-slate-300 py-3">
                      <span className="w-6 shrink-0 text-right font-mono text-lg font-semibold text-slate-500" aria-hidden="true">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-base font-bold leading-snug text-slate-900">{e.name}</h3>
                        <p className="text-sm text-slate-600"><span className="tabular">{e.targetSets} sets × {e.targetReps} reps</span></p>
                      </div>
                      <StatusMark kind="done">Done</StatusMark>
                    </li>
                  );
                }
                const cur = e.currentSetIndex !== null ? e.sets[e.currentSetIndex] : null;
                const cta = nextCta(e);
                return (
                  <li key={e.key} className="border-b border-slate-300 py-4">
                    <div className="flex gap-3 sm:gap-4">
                      <span className="mt-0.5 w-6 shrink-0 text-right font-mono text-lg font-semibold text-slate-500 tabular" aria-hidden="true">{i + 1}</span>
                      {img && <Image src={img} alt="" width={72} height={72} className="size-16 shrink-0 rounded-md border border-slate-300 object-cover grayscale-[35%] sm:size-[72px]" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                          <h3 className="text-lg font-bold leading-snug text-slate-900">{e.name}</h3>
                          <StatusMark kind={e.status === "in_progress" ? "partial" : "pending"}>
                            {e.status === "in_progress" ? `${e.completedSets} of ${e.targetSets} sets` : "Not started"}
                          </StatusMark>
                        </div>
                        <p className="mt-0.5 text-sm text-slate-600">
                          {catalog?.bodyArea} · <span className="tabular font-semibold text-slate-800">{e.targetSets} sets × {e.targetReps} reps</span>
                          {meta?.holdSeconds ? <span> · hold {meta.holdSeconds}s</span> : null}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 pl-9 sm:pl-10">
                      {e.targetReps <= 15 ? (
                        <SetsGrid sets={e.targetSets} reps={e.targetReps} completedReps={e.completedReps} size={e.targetReps > 10 ? 16 : 18} />
                      ) : (
                        <TickRow total={e.targetSets} done={e.completedSets} size={20} label={`${e.completedSets} of ${e.targetSets} sets done`} />
                      )}
                      {cur && cur.completedReps > 0 && (
                        <p className="mt-2 text-sm text-slate-800">
                          <span className="font-semibold">Set {cur.index + 1}:</span> <span className="tabular">{cur.completedReps} of {cur.targetReps}</span> reps done, <span className="tabular">{cur.remainingReps}</span> to go.
                        </p>
                      )}
                      {meta?.instructions && <p className="hand mt-3 max-w-prose">“{meta.instructions}” <span className="ml-2 font-sans text-xs font-semibold text-slate-600">— {rx?.doctorName || "your therapist"}</span></p>}
                      {meta?.modifications && <p className="mt-2 max-w-prose text-sm text-slate-700"><span className="font-semibold">For you:</span> {meta.modifications}</p>}
                      <div className="mt-4">
                        <Button asChild size={isNext ? "lg" : "md"} variant={isNext ? "primary" : "outline"}>
                          <Link href={cta.href} className={cn(isNext && "max-md:hidden")}>
                            <Play className="size-4 fill-current" aria-hidden="true" />
                            {cta.label}
                          </Link>
                        </Button>
                        {isNext && <p className="mt-2 text-xs text-slate-600">Uses your camera. Video stays on your device.</p>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {next && (
            <div className="fixed inset-x-0 z-40 border-t border-slate-900 bg-[var(--paper)] px-4 py-2.5 md:hidden" style={{ bottom: "calc(64px + env(safe-area-inset-bottom, 0px))" }}>
              <Button asChild size="lg" className="w-full">
                <Link href={nextCta(next).href}>
                  <Play className="size-4 fill-current" aria-hidden="true" />
                  <span className="truncate">{nextCta(next).label}: {next.name}</span>
                </Link>
              </Button>
            </div>
          )}
        </section>

        {plan.state === "active" && plan.upcoming && plan.upcoming.length > 0 && exercises.length > 0 && (
          <section aria-label="Coming up">
            <SectionHeading title="Coming up" />
            <ul className="mt-2 border-t border-slate-900">
              {plan.upcoming.map((u) => (
                <li key={u.day} className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-slate-300 py-2.5 text-sm">
                  <span className="font-semibold text-slate-900">{formatDateKey(u.day, { weekday: "long", day: "numeric", month: "short" })}</span>
                  <span className="text-slate-600">{u.exercises.join(", ")}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <aside className="min-w-0 space-y-7">
        {rx && (
          <section aria-label="Your plan">
            <SectionHeading title="Your plan" />
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-slate-600">From</dt><dd className="text-right font-semibold text-slate-900">{rx.doctorName || "Your therapist"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-600">Dates</dt><dd className="text-right font-semibold tabular text-slate-900">{formatDateKey(rx.startDate)} to {formatDateKey(rx.endDate)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-600">How often</dt><dd className="text-right font-semibold text-slate-900">{{ daily: "Every day", alternate: "Every other day", weekdays: "Weekdays" }[rx.frequency] ?? rx.frequency}</dd></div>
              {rx.weeklyReview.enabled && <div className="flex justify-between gap-3"><dt className="text-slate-600">Weekly review</dt><dd className="text-right font-semibold text-slate-900">Day {rx.weeklyReview.cycleDay}</dd></div>}
            </dl>
            {rx.instructions && <p className="mt-3 max-w-prose text-sm text-slate-800">{rx.instructions}</p>}
            {rx.doctorNotes && <p className="hand mt-3">“{rx.doctorNotes}”</p>}
            {rx.medicineCount > 0 && (
              <Button asChild size="sm" variant="outline" className="mt-3">
                <Link href="/profile#medications"><Pill className="size-4" aria-hidden="true" /> Medication from your therapist</Link>
              </Button>
            )}
          </section>
        )}

        {plan.state !== "none" && plan.week && (
          <section aria-label="This week">
            <SectionHeading title="This week" description="Ticked from the sets you completed." />
            <DayTicks days={plan.week.map((d) => ({ label: d.label, state: d.state, isToday: d.isToday }))} className="mt-4" />
          </section>
        )}

        <section aria-label="Your physiotherapist">
          <SectionHeading title="Your physiotherapist" />
          {therapist ? (
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-base font-semibold text-slate-900">{therapist.name}</p>
                {therapist.specialization && <p className="text-sm text-slate-600">{therapist.specialization}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="secondary">
                  <Link href={therapist.chatHref}>
                    <MessageSquare className="size-4" aria-hidden="true" />
                    Message
                    {therapist.unread > 0 && (
                      <span className="rounded bg-amber-300 px-1.5 text-xs font-bold tabular">
                        {therapist.unread}
                        <span className="sr-only"> unread</span>
                      </span>
                    )}
                  </Link>
                </Button>
                <Button asChild size="sm" variant="ghost"><Link href={therapist.profileHref}>Profile</Link></Button>
              </div>
            </div>
          ) : pendingReferral ? (
            <Notice className="mt-3" title="Request sent" tone="info">
              {pendingReferral.therapistName ? `${pendingReferral.therapistName} will` : "Your physiotherapist will"} confirm your appointment. You’ll see it under Appointments.
            </Notice>
          ) : (
            <EmptyState className="mt-3" title="No physiotherapist yet" action={<Button asChild size="sm" variant="outline"><Link href="/discover">Find a physiotherapist</Link></Button>}>
              A physiotherapist can prescribe your exercises and see how each session went.
            </EmptyState>
          )}
        </section>

        <section aria-label="Last session">
          <SectionHeading title="Last session" action={<Link href="/progress" className="font-semibold text-emerald-700 underline underline-offset-4">Progress</Link>} />
          {lastSession ? (
            <div className="mt-3">
              <p className="text-base font-semibold text-slate-900">{lastSession.exerciseName}</p>
              <p className="text-sm text-slate-600">
                <CalendarClock className="mr-1 inline size-3.5 align-[-2px]" aria-hidden="true" />
                {lastSession.dateLabel}
              </p>
              <dl className="mt-2 flex gap-6 text-sm">
                <div>
                  <dt className="text-slate-600">Reps</dt>
                  <dd className="font-mono text-lg font-semibold tabular">{lastSession.reps}<span className="text-sm text-slate-500"> / {lastSession.targetReps}</span></dd>
                </div>
                {lastSession.rom ? (
                  <div>
                    <dt className="text-slate-600">Range of motion</dt>
                    <dd className="font-mono text-lg font-semibold tabular">{lastSession.rom}°</dd>
                  </div>
                ) : null}
                {lastSession.durationLabel && (
                  <div>
                    <dt className="text-slate-600">Time</dt>
                    <dd className="font-mono text-lg font-semibold tabular">{lastSession.durationLabel}</dd>
                  </div>
                )}
              </dl>
            </div>
          ) : (
            <EmptyState className="mt-3" title="No sessions yet">Finish your first exercise and your result will show up here.</EmptyState>
          )}
        </section>
      </aside>
    </div>
  );
}
