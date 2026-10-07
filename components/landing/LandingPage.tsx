import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ShieldCheck, Activity, Stethoscope, Sparkles, Volume2, CheckCircle2 } from "lucide-react";
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

function ExampleLabel({ children = "Interactive live tracking demo with simulated biomechanics" }: { children?: string }) {
  return <p className="text-xs font-medium text-slate-500">{children}</p>;
}

/** The modern hero artifact: an interactive, clinical-grade live rehab session card. */
function HeroSheet() {
  return (
    <figure aria-label="Example rehabilitation session" className="relative min-w-0">
      {/* Decorative ambient backdrop glow */}
      <div className="pointer-events-none absolute -inset-2 -z-10 rounded-3xl bg-gradient-to-tr from-emerald-500/15 via-teal-500/10 to-emerald-300/20 blur-2xl opacity-75" />

      {/* Floating Micro-Badge */}
      <div className="absolute -top-3.5 right-6 z-20 hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-semibold text-emerald-800 shadow-md sm:inline-flex">
        <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
        MediaPipe WASM · 33 3D Pose Landmarks
      </div>

      <div className="relative rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_20px_50px_-12px_rgba(15,23,42,0.12)] sm:p-6 transition-all duration-300 hover:shadow-[0_25px_60px_-12px_rgba(15,23,42,0.16)]">
        {/* Card Header: Session Status & Day Tracker */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100 animate-pulse" />
            <div>
              <p className="text-sm font-bold text-slate-900 leading-tight">Live Rehabilitation Protocol</p>
              <p className="text-xs text-slate-500">Day 4 of 30 · Recovery Stage II</p>
            </div>
          </div>
          <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            8 / 15 Reps Active
          </span>
        </div>

        {/* Patient & Prescribing Clinician info */}
        <div className="mt-3.5 grid grid-cols-2 gap-3 rounded-xl bg-slate-50/80 p-3 text-xs border border-slate-150">
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 block">Patient</span>
            <span className="font-semibold text-slate-800 truncate block">Rahul M. <span className="text-slate-500 font-normal">(Knee Rehab)</span></span>
          </div>
          <div className="min-w-0 border-l border-slate-200 pl-3">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 block">Prescribed By</span>
            <span className="font-semibold text-emerald-900 flex items-center gap-1 truncate">
              Dr. Aarti Sharma, PT
              <CheckCircle2 className="size-3 text-emerald-600 shrink-0 inline" />
            </span>
          </div>
        </div>

        {/* Active Exercise: Seated Knee Extension */}
        <div className="mt-4 rounded-xl border border-emerald-200/70 bg-gradient-to-b from-emerald-50/40 to-white p-4">
          <div className="flex items-start gap-3.5">
            <div className="relative shrink-0">
              <Image
                src="/exercise-guides/seated-knee-extension.jpg"
                alt="Seated knee extension guide"
                width={80}
                height={80}
                className="size-20 rounded-lg border border-emerald-200/80 object-cover shadow-xs"
              />
              <span className="absolute -bottom-1.5 -right-1.5 rounded-md bg-emerald-700 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs">
                Active
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-base font-bold text-slate-900 leading-snug">Seated Knee Extension</h3>
                <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded">Set 2 of 3</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-600">Lower body · Target: 15 reps per set</p>

              {/* Joint angle & alignment meter */}
              <div className="mt-2.5">
                <div className="flex justify-between text-[11px] font-medium text-slate-600 mb-1">
                  <span>Current Joint Angle: <strong className="text-emerald-700 font-bold font-mono">142°</strong></span>
                  <span className="text-slate-500">Target: <strong className="text-slate-800 font-mono">150°</strong></span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/70">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500" style={{ width: "88%" }} />
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Rep Progress Row */}
          <div className="mt-3.5 pt-3 border-t border-emerald-150/50">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-slate-700">Set 2 Progress: <span className="text-emerald-700 font-bold font-mono">8 done</span>, 7 remaining</span>
              <span className="text-[11px] text-emerald-800 font-medium">96% Form Accuracy</span>
            </div>

            {/* Rep indicators */}
            <div className="space-y-1">
              <div className="sm:hidden">
                <DrawnRow total={15} done={15} size={12} startMs={400} />
                <div className="mt-1"><DrawnRow total={15} done={8} size={12} startMs={1500} /></div>
              </div>
              <div className="hidden sm:block">
                <DrawnRow total={15} done={15} size={16} startMs={400} />
                <div className="mt-1"><DrawnRow total={15} done={8} size={16} startMs={1500} /></div>
              </div>
            </div>
          </div>

          {/* Live AI Audio Coaching Prompt */}
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-100/60 px-3 py-2 text-xs text-emerald-950 border border-emerald-200/50">
            <Volume2 className="size-4 shrink-0 text-emerald-700 animate-pulse" />
            <p className="font-medium truncate">
              Voice Coach: <span className="font-semibold">“Hold extension at peak for 1 second. Excellent posture!”</span>
            </p>
          </div>
        </div>

        {/* Next Exercise in Routine */}
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <Image
              src="/exercise-guides/neck-rotation.jpg"
              alt=""
              width={44}
              height={44}
              className="size-11 rounded-lg border border-slate-200 object-cover"
            />
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-slate-900 truncate">Neck Rotation</h4>
              <p className="text-xs text-slate-500">Neck & spine · 2 sets × 10 reps</p>
            </div>
          </div>
          <StatusMark kind="pending" className="shrink-0 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs">Up Next</StatusMark>
        </div>

        {/* Therapist Clinical Note */}
        <div className="mt-3.5 rounded-xl border border-amber-200/70 bg-amber-50/40 p-3.5 text-xs text-slate-800">
          <p className="font-serif italic text-slate-800 text-[13px] leading-relaxed">
            “Slow on the way down. Stop if it pinches and message me directly on chat.”
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-amber-200/40 pt-2 text-[11px] text-slate-500">
            <Authorship by="therapist" name="Dr. Aarti Sharma" />
            <span className="font-medium text-slate-600">Weekly clinical review: Day 6</span>
          </div>
        </div>
      </div>

      {/* Caption */}
      <figcaption className="mt-3 text-center sm:text-left">
        <ExampleLabel>Live browser analysis: MediaPipe tracks skeletal landmarks locally without uploading video.</ExampleLabel>
      </figcaption>
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
    <div className="relative min-h-dvh w-full bg-[var(--paper)] text-slate-900 overflow-x-hidden">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:font-semibold">Skip to content</a>
      <LandingNav />

      {/* Ambient background glow for hero */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[680px] overflow-hidden">
        <div className="absolute -left-[10%] top-[-10%] h-[480px] w-[520px] rounded-full bg-emerald-200/35 blur-[120px]" />
        <div className="absolute right-[-8%] top-[5%] h-[440px] w-[460px] rounded-full bg-teal-200/25 blur-[110px]" />
        <div className="absolute left-[30%] top-[20%] h-[320px] w-[320px] rounded-full bg-emerald-100/40 blur-[90px]" />
      </div>

      <main id="main">
        {/* Hero Section */}
        <section aria-labelledby="hero" id="product" className="relative mx-auto w-full max-w-6xl scroll-mt-20 px-5 pb-16 pt-8 sm:px-8 lg:pb-24 lg:pt-14">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,29rem)] lg:gap-14">
            <div>
              {/* Category Pill Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-3.5 py-1.5 text-xs font-semibold text-emerald-900 shadow-2xs backdrop-blur-sm">
                <Sparkles className="size-3.5 text-emerald-700" />
                <span>AI Computer Vision · Physical Therapy at Home</span>
              </div>

              {/* Main Headline */}
              <h1 id="hero" className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-slate-950 sm:text-5xl lg:text-[3.5rem]">
                Rehabilitation guidance at home,{" "}
                <span className="bg-gradient-to-r from-emerald-800 via-emerald-600 to-teal-700 bg-clip-text text-transparent">
                  with your therapist still in the loop.
                </span>
              </h1>

              {/* Body Text */}
              <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-slate-700 font-normal">
                Your physiotherapist prescribes your exercises. Swasthya uses your camera to count verified repetitions, correct posture angles in real time, and report clinical progress back to your therapist.
              </p>

              {/* CTA Buttons */}
              <div className="mt-8 flex flex-col gap-3.5 sm:flex-row sm:items-center">
                <Link
                  href="/onboarding"
                  className="group inline-flex h-12 items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-7 text-base font-semibold text-white shadow-lg shadow-emerald-700/20 transition-all duration-200 hover:from-emerald-500 hover:to-emerald-600 hover:shadow-xl hover:shadow-emerald-700/30 hover:-translate-y-0.5 active:translate-y-0"
                >
                  Get started free
                  <ArrowRight className="size-4.5 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
                </Link>
                <Link
                  href="/sign-in"
                  className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-300/90 bg-white/90 px-6 text-base font-semibold text-slate-800 shadow-2xs backdrop-blur-sm transition-all duration-200 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-950 hover:-translate-y-0.5 active:translate-y-0"
                >
                  I already have an account
                </Link>
              </div>

              {/* Trust Indicators */}
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-200/80 pt-6 text-xs font-medium text-slate-600">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-emerald-600 shrink-0" />
                  <span>100% On-Device Privacy</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Activity className="size-4 text-emerald-600 shrink-0" />
                  <span>Real-time Biomechanics</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Stethoscope className="size-4 text-emerald-600 shrink-0" />
                  <span>Doctor Supervised</span>
                </div>
              </div>

              {/* Clinical Disclaimer */}
              <p className="mt-4 max-w-[34rem] text-xs leading-relaxed text-slate-500">
                Swasthya provides movement guidance and non-diagnostic biomechanical feedback. It does not replace your physiotherapist or doctor.
              </p>
            </div>

            {/* Hero Artifact */}
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
