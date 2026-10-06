import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Camera, ClipboardList, Lock, MessageSquare } from "lucide-react";

export const metadata = { title: "How Swasthya works" };

const POINTS = [
  { icon: ClipboardList, title: "What it does", body: "Swasthya gives you a numbered sheet of rehabilitation exercises. As you move, it counts your repetitions and tells you what to adjust." },
  { icon: Camera, title: "How the camera is used", body: "Your phone or laptop camera finds your joints and measures the angles of your movement. This happens on your device." },
  { icon: Lock, title: "Your privacy", body: "Video is not uploaded or stored. Only results, such as reps and range of motion, are saved to your account." },
  { icon: MessageSquare, title: "Your physiotherapist", body: "If you have a physiotherapist on Swasthya, they can prescribe your exercises, see your sessions, and message or video-call you. Swasthya guides movement; it does not diagnose." },
];

/** One short page instead of a carousel: what it is, how the camera works, privacy, therapist role. */
export default function OnboardingPage() {
  return (
    <div className="min-h-dvh w-full bg-[var(--paper)] text-slate-900">
      <header className="mx-auto flex h-16 w-full max-w-3xl items-center px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/swasthya-logo-icon.png" alt="" width={32} height={32} className="size-8 object-contain" />
          <span className="text-lg font-bold tracking-tight">Swasthya</span>
        </Link>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 pb-16 pt-6">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Before you start</h1>
        <p className="mt-2 max-w-prose text-base text-slate-700">Four things worth knowing. It takes a minute to read and a few more to set up your account.</p>

        <dl className="mt-8 divide-y divide-slate-300 border-t-2 border-slate-900">
          {POINTS.map((p) => (
            <div key={p.title} className="flex gap-4 py-5">
              <p.icon className="mt-1 size-5 shrink-0 text-emerald-700" aria-hidden="true" />
              <div>
                <dt className="text-lg font-bold">{p.title}</dt>
                <dd className="mt-1 max-w-prose text-base leading-relaxed text-slate-700">{p.body}</dd>
              </div>
            </div>
          ))}
        </dl>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/sign-up"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 text-base font-semibold text-white hover:bg-emerald-700"
          >
            Create your account <ArrowRight className="size-5" aria-hidden="true" />
          </Link>
          <Link href="/sign-in" className="text-sm font-semibold text-slate-800 underline underline-offset-4">
            I already have an account
          </Link>
        </div>
      </main>
    </div>
  );
}
