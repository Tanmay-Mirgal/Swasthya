import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

/** Shared frame for Clerk sign-in / sign-up: brand panel on large screens, form always first on phones. */
export default function AuthFrame({ children, heading, body }: { children: ReactNode; heading: string; body: string }) {
  return (
    <div className="grid min-h-dvh w-full bg-[var(--paper)] lg:grid-cols-[minmax(0,26rem)_1fr]">
      <aside data-on-dark className="on-dark hidden flex-col justify-between bg-emerald-900 p-10 text-emerald-50 lg:flex">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/swasthya-logo-icon.png" alt="" width={40} height={40} className="size-10 rounded-md bg-white p-0.5 object-contain" />
          <span className="text-xl font-bold tracking-tight">Swasthya</span>
        </Link>
        <div>
          <p className="max-w-[18ch] text-3xl font-bold leading-tight">{heading}</p>
          <p className="mt-3 max-w-xs text-base leading-relaxed text-emerald-100">{body}</p>
        </div>
        <p className="text-sm text-emerald-200">Movement guidance, not a diagnosis.</p>
      </aside>
      <main className="flex items-center justify-center px-4 py-10">{children}</main>
    </div>
  );
}
