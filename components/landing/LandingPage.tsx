import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import LandingNav from "./LandingNav";
import { Authorship, StatusMark, TickBox } from "@/components/ui";
import { cn } from "@/lib/utils";

/** A row of boxes where the first `done` are ticked, drawn on in sequence (the page's one authored motion). */
function DrawnRow({ total, done, size = 20, startMs = 0 }: { total: number; done: number; size?: number; startMs?: number }) {
  return (
    <div className="flex flex-wrap gap-1" role="img" aria-label={`${done} of ${total} reps ticked`}>
      {Array.from({ length: total }, (_, i) => (
        <TickBox key={i} state={i < done ? "done" : "todo"} size={size} animate={i < done} className={cn(i < done && `[--tick-delay:${startMs + i * 70}ms]`)} />
      ))}
    </div>
  );
}

function ExampleLabel({ children = "Example, with made-up values" }: { children?: string }) {
  return <p className="text-xs font-semibold text-slate-600">{children}</p>;
}

/** The hero artifact: a handed-out rehabilitation sheet. */
function HeroSheet() {
  return (
    <figure aria-label="Example rehabilitation sheet" className="min-w-0">
      <div className="border border-slate-900 bg-white p-5 shadow-[0_28px_48px_-28px_rgba(26,31,29,0.35)] sm:p-7">
        <div className="flex items-baseline justify-between gap-4 border-b-2 border-slate-900 pb-3">
          <p className="text-lg font-bold tracking-tight">Rehabilitation plan</p>
          <p className="text-sm font-semibold text-slate-600">Day 4 of 30</p>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 text-sm">
          <div className="border-b border-slate-300 pb-1.5"><dt className="text-slate-600">For</dt><dd className="hand !text-[1.0625rem]">Your name</dd></div>
          <div className="border-b border-slate-300 pb-1.5"><dt className="text-slate-600">Prescribed by</dt><dd className="hand !text-[1.0625rem]">Your therapist</dd></div>
        </dl>

        <ol className="mt-1">
          <li className="border-b border-slate-300 py-5">
            <div className="flex gap-4">
              <span className="mt-0.5 w-5 shrink-0 text-right font-mono text-lg font-semibold text-slate-500" aria-hidden="true">1</span>
              <Image src="/exercise-guides/seated-knee-extension.jpg" alt="" width={72} height={72} className="size-[72px] shrink-0 rounded-md border border-slate-300 object-cover grayscale-[35%]" />
              <div className="min-w-0">
                <h3 className="text-lg font-bold leading-snug">Seated Knee Extension</h3>
                <p className="text-sm text-slate-600">Lower body · <span className="font-mono font-semibold tabular text-slate-800">3 sets × 15 reps</span></p>
                <p className="mt-2 text-sm text-slate-800"><span className="font-semibold">Set 2:</span> <span className="tabular">8 of 15</span> reps. Rest, then <span className="tabular">7</span> to go.</p>
              </div>
            </div>
            {/* Smaller boxes on phones so a 15-rep set stays on one line. */}
            <div className="mt-3 space-y-1 pl-9 sm:hidden">
              <DrawnRow total={15} done={15} size={12} startMs={500} />
              <DrawnRow total={15} done={8} size={12} startMs={1700} />
              <DrawnRow total={15} done={0} size={12} />
            </div>
            <div className="mt-3 hidden space-y-1 pl-9 sm:block">
              <DrawnRow total={15} done={15} size={16} startMs={500} />
              <DrawnRow total={15} done={8} size={16} startMs={1700} />
              <DrawnRow total={15} done={0} size={16} />
            </div>
          </li>
          <li className="flex gap-4 border-b border-slate-300 py-5">
            <span className="mt-0.5 w-5 shrink-0 text-right font-mono text-lg font-semibold text-slate-500" aria-hidden="true">2</span>
            <Image src="/exercise-guides/neck-rotation.jpg" alt="" width={72} height={72} className="size-[72px] shrink-0 rounded-md border border-slate-300 object-cover grayscale-[35%]" />
            <div className="min-w-0">
              <h3 className="text-lg font-bold leading-snug">Neck Rotation</h3>
              <p className="text-sm text-slate-600">Neck and spine · <span className="font-mono font-semibold tabular text-slate-800">2 sets × 10 reps</span></p>
              <div className="mt-2"><StatusMark kind="pending">Not started</StatusMark></div>
            </div>
          </li>
        </ol>

        <p className="hand mt-4">“Slow on the way down. Stop if it pinches and message me.”</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <Authorship by="therapist" />
          <span className="font-semibold text-slate-600">Weekly review: day 6</span>
        </div>
      </div>
      <figcaption className="mt-3"><ExampleLabel>Example sheet. The boxes tick themselves as the camera counts reps; the note in pen is written by the therapist.</ExampleLabel></figcaption>
    </figure>
  );
}

const STEPS = [
  { title: "Your therapist creates your plan", body: "After your consultation they choose your exercises, the sets and reps, how many days it runs, and a weekly review day. You can see it in the app straight away." },
  { title: "You do your exercises at home", body: "Today shows what is due. Prop up your phone or laptop and start. If a set is too long to do in one go, pause and rest part-way: your reps add up to the set your therapist chose." },
  { title: "Your movement is analysed on your device", body: "The camera counts your repetitions and gives movement guidance as you go. The analysis runs in your browser, and your video is not uploaded." },
  { title: "Your progress goes to your therapist", body: "They see your completed sets, a weekly report, and a short recording on review day when they ask for one. They can read it, message you and change your plan." },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh w-full bg-[var(--paper)] text-slate-900">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:font-semibold">Skip to content</a>
      <LandingNav />

      <main id="main">
        {/* Hero */}
        <section aria-labelledby="hero" id="product" className="mx-auto w-full max-w-6xl scroll-mt-20 px-5 pb-16 pt-10 sm:px-8 lg:pb-24 lg:pt-16">
          <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,29rem)] lg:gap-16">
            <div>
              <h1 id="hero" className="max-w-[20ch] text-4xl font-bold leading-[1.07] tracking-tight sm:text-5xl lg:text-[3.5rem]">
                Rehabilitation guidance at home, with your therapist still in the loop.
              </h1>
              <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-slate-700">
                Your physiotherapist prescribes your exercises. Swasthya uses your camera to count repetitions and tell you what to adjust, tracks your progress, and
                shows your therapist how each week went, so they can change your plan when it needs changing.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/onboarding" className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-emerald-600 px-6 text-base font-semibold text-white hover:bg-emerald-700">
                  Get started <ArrowRight className="size-5" aria-hidden="true" />
                </Link>
                <Link href="/sign-in" className="inline-flex h-12 items-center justify-center rounded-md border border-slate-900 bg-white px-6 text-base font-semibold text-slate-900 hover:bg-slate-100">
                  I already have an account
                </Link>
              </div>
              <p className="mt-6 max-w-[34rem] text-sm leading-relaxed text-slate-600">Swasthya gives movement guidance. It does not diagnose, and it does not replace your physiotherapist or doctor.</p>
            </div>
            <HeroSheet />
          </div>
        </section>

        {/* How it works */}
        <section aria-labelledby="how-title" id="how" className="scroll-mt-20 border-t-2 border-slate-900">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:gap-16 lg:py-24">
            <div>
              <h2 id="how-title" className="text-3xl font-bold tracking-tight">How it works</h2>
              <p className="mt-3 max-w-xs text-base leading-relaxed text-slate-700">One plan, followed at home, reviewed by the person who wrote it.</p>
            </div>
            <ol>
              {STEPS.map((s, i) => (
                <li key={s.title} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 border-b border-slate-300 py-6 first:pt-0 sm:grid-cols-[3.5rem_minmax(0,1fr)]">
                  <span className="font-mono text-3xl font-semibold leading-none text-slate-400 tabular" aria-hidden="true">{i + 1}</span>
                  <div>
                    <h3 className="text-xl font-bold leading-snug"><span className="sr-only">Step {i + 1}: </span>{s.title}</h3>
                    <p className="mt-1.5 max-w-[38rem] text-base leading-relaxed text-slate-700">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* For patients */}
        <section aria-labelledby="patients-title" id="patients" className="scroll-mt-20 border-t border-slate-300 bg-slate-50">
          <div className="mx-auto grid w-full max-w-6xl items-start gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)] lg:gap-16 lg:py-24">
            <div>
              <h2 id="patients-title" className="text-3xl font-bold tracking-tight">For patients: today is one list</h2>
              <p className="mt-4 max-w-[34rem] text-base leading-relaxed text-slate-700">
                Open Swasthya and see what your therapist prescribed for today: the exercises, the sets and reps, and what you have already done. Nothing on the screen is made up. If your therapist changes the plan, it changes here.
              </p>
              <ul className="mt-6 max-w-[34rem] space-y-3 text-base leading-relaxed text-slate-800">
                <li><span className="font-semibold">Rest when you need to.</span> Split a set of 15 into 8 and 7 if that is what you can do. The target your therapist set never changes.</li>
                <li><span className="font-semibold">Clear guidance while you move.</span> The camera tells you when it cannot see you well, and what to do about it, instead of just failing.</li>
                <li><span className="font-semibold">A reminder, not a nag.</span> One email on days you have exercises, and a note on your weekly review day. Turn reminders off whenever you like.</li>
                <li><span className="font-semibold">Your own words.</span> Say how an exercise felt. Your therapist sees it in your weekly report.</li>
              </ul>
            </div>
            <figure aria-label="Example of today's plan" className="min-w-0">
              <div className="border border-slate-900 bg-white p-5">
                <div className="flex items-baseline justify-between gap-3 border-b-2 border-slate-900 pb-2">
                  <p className="text-lg font-bold">Today’s exercises</p>
                  <p className="text-sm text-slate-600">Day 4 of 30 · 1 of 3 left</p>
                </div>
                <ul>
                  <li className="flex items-center gap-3 border-b border-slate-300 py-3"><span className="w-5 text-right font-mono text-slate-500" aria-hidden="true">1</span><span className="flex-1 font-bold">Seated Bicep Curl</span><StatusMark kind="done">Done</StatusMark></li>
                  <li className="flex items-center gap-3 border-b border-slate-300 py-3"><span className="w-5 text-right font-mono text-slate-500" aria-hidden="true">2</span><span className="flex-1 font-bold">Neck Rotation</span><StatusMark kind="done">Done</StatusMark></li>
                  <li className="border-b border-slate-300 py-4">
                    <div className="flex items-baseline gap-3"><span className="w-5 text-right font-mono text-slate-500" aria-hidden="true">3</span><span className="flex-1 text-lg font-bold">Seated Knee Extension</span><StatusMark kind="partial">1 of 3 sets</StatusMark></div>
                    <p className="mt-2 pl-8 text-sm text-slate-800"><span className="font-semibold">Set 2:</span> <span className="tabular">8 of 15</span> reps done, <span className="tabular">7</span> to go.</p>
                    <div className="mt-3 pl-8">
                      <span className="inline-flex h-11 items-center rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white">Continue set 2 (7 reps left)</span>
                    </div>
                  </li>
                </ul>
                <div className="mt-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">This week</p>
                    <ol className="mt-2 flex gap-2" aria-label="Example week: 3 days done, today partly done">
                      {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                        <li key={i} className="flex flex-col items-center gap-1"><TickBox state={i < 3 ? "done" : i === 3 ? "partial" : "todo"} size={22} /><span className={cn("text-xs tabular", i === 3 ? "font-bold text-slate-900" : "text-slate-500")}>{d}</span></li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>
              <figcaption className="mt-3"><ExampleLabel /></figcaption>
            </figure>
          </div>
        </section>

        {/* For therapists */}
        <section aria-labelledby="therapists-title" id="therapists" className="scroll-mt-20 border-t border-slate-300">
          <div className="mx-auto grid w-full max-w-6xl items-start gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[minmax(0,34rem)_minmax(0,1fr)] lg:gap-16 lg:py-24">
            <figure aria-label="Example of the weekly review list" className="order-2 min-w-0 lg:order-1">
              <div className="border border-slate-900 bg-white p-5">
                <p className="text-lg font-bold">Weekly reviews</p>
                <table className="mt-2 w-full border-t-2 border-slate-900 text-sm">
                  <caption className="sr-only">Example weekly review list with made-up values</caption>
                  <thead><tr className="text-left text-slate-600"><th scope="col" className="py-2 pr-3 font-semibold">Patient</th><th scope="col" className="py-2 pr-3 font-semibold">Sets done</th><th scope="col" className="py-2 font-semibold">Recording</th></tr></thead>
                  <tbody>
                    <tr className="border-t border-slate-300"><th scope="row" className="py-3 pr-3 text-left font-bold">Patient A<span className="block text-xs font-normal text-slate-600">Week 3</span></th><td className="py-3 pr-3 tabular">34 of 36</td><td className="py-3"><StatusMark kind="done">Recorded</StatusMark></td></tr>
                    <tr className="border-t border-slate-300"><th scope="row" className="py-3 pr-3 text-left font-bold">Patient B<span className="block text-xs font-normal text-slate-600">Week 1</span></th><td className="py-3 pr-3 tabular">9 of 24</td><td className="py-3"><StatusMark kind="attention">Waiting</StatusMark></td></tr>
                    <tr className="border-t border-slate-300"><th scope="row" className="py-3 pr-3 text-left font-bold">Patient C<span className="block text-xs font-normal text-slate-600">Week 2</span></th><td className="py-3 pr-3 tabular">20 of 20</td><td className="py-3"><span className="text-slate-600">Not asked</span></td></tr>
                  </tbody>
                </table>
                <div className="mt-4 border-t border-slate-300 pt-3">
                  <Authorship by="automated" />
                  <p className="mt-1 text-sm text-slate-800">Most common feedback: range of motion below target.</p>
                  <div className="mt-3"><Authorship by="therapist" name="you" /><p className="hand mt-1">“Good week. Let’s add a third set.”</p></div>
                </div>
              </div>
              <figcaption className="mt-3"><ExampleLabel /></figcaption>
            </figure>
            <div className="order-1 lg:order-2">
              <h2 id="therapists-title" className="text-3xl font-bold tracking-tight">For therapists: see the week without being in the room</h2>
              <p className="mt-4 max-w-[34rem] text-base leading-relaxed text-slate-700">
                Write the plan once, after the consultation. Swasthya turns what your patient actually does into a factual weekly report, and you decide what it means.
              </p>
              <ul className="mt-6 max-w-[34rem] space-y-3 text-base leading-relaxed text-slate-800">
                <li><span className="font-semibold">A plan you control.</span> Exercises, sets, reps, days, review day, notes, and an optional medication record in your own words. Changes create a new version; the old one is kept.</li>
                <li><span className="font-semibold">Weekly reports from stored data only.</span> Adherence, completed sets, camera-measured range and form scores, and the feedback the camera raised most. It never states a diagnosis.</li>
                <li><span className="font-semibold">Automated and human are kept apart.</span> Camera figures are labelled automated. Your assessment and notes are labelled as yours, and you can override anything.</li>
                <li><span className="font-semibold">A recording when you ask for one.</span> One short clip on review day, private to you and the patient.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Privacy and accessibility */}
        <section aria-labelledby="trust-title" className="border-t-2 border-slate-900">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
            <h2 id="trust-title" className="text-3xl font-bold tracking-tight">Privacy, limits and access</h2>
            <div className="mt-8 grid gap-x-16 gap-y-10 md:grid-cols-2">
              <div>
                <h3 className="text-xl font-bold">What happens to your video</h3>
                <ul className="mt-3 space-y-2.5 text-base leading-relaxed text-slate-800">
                  <li>Movement is analysed in your browser. Video is not uploaded for tracking.</li>
                  <li>The one exception is a short clip you choose to record when your therapist asks for one at a weekly review. It is stored privately and only you and your therapist can watch it. You can delete it before it is reviewed.</li>
                  <li>Camera access is requested only when you start an exercise.</li>
                </ul>
                <h3 className="mt-8 text-xl font-bold">What Swasthya is not</h3>
                <p className="mt-3 max-w-[34rem] text-base leading-relaxed text-slate-800">
                  It does not diagnose, treat or promise a recovery. Feedback is movement guidance. Medication is shown only if your therapist recorded it themselves, exactly as they wrote it. If something hurts more than expected, stop and contact your therapist.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-bold">Built to be usable</h3>
                <ul className="mt-3 space-y-2.5 text-base leading-relaxed text-slate-800">
                  <li>Large touch targets and readable type, on a phone propped up across the room or a laptop.</li>
                  <li>Everything works with a keyboard, and the screen respects reduced-motion settings.</li>
                  <li>Status is never colour alone: every state has a shape and a word.</li>
                  <li>You can pause and rest at any point in a set.</li>
                  <li>If a camera does not work for you, tell your therapist. They can see your plan, message you, and change what you are asked to do.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section aria-labelledby="cta-title" className="bg-emerald-900 text-[var(--paper)]">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-5 py-16 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:py-20">
            <div>
              <h2 id="cta-title" className="max-w-[24ch] text-3xl font-bold leading-tight tracking-tight sm:text-4xl">Start your rehabilitation plan</h2>
              <p className="mt-3 max-w-[34rem] text-base leading-relaxed text-emerald-100">Create an account as a patient or as a therapist. It takes a few minutes, and you choose your role first.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row" data-on-dark>
              <Link href="/onboarding" className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-amber-300 px-6 text-base font-semibold text-[var(--ink)] hover:bg-amber-200">Get started <ArrowRight className="size-5" aria-hidden="true" /></Link>
              <Link href="/sign-in" className="inline-flex h-12 items-center justify-center rounded-md border border-emerald-200 px-6 text-base font-semibold text-white hover:bg-emerald-800">I already have an account</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-300">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-slate-600 sm:px-8 md:flex-row md:items-center md:justify-between">
          <p><span className="font-bold text-slate-900">Swasthya</span> · movement guidance for rehabilitation, with your therapist in charge.</p>
          <nav aria-label="Footer" className="flex gap-5 font-semibold text-slate-800">
            <Link href="/sign-in" className="underline-offset-4 hover:underline">Sign in</Link>
            <Link href="/onboarding" className="underline-offset-4 hover:underline">Get started</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
