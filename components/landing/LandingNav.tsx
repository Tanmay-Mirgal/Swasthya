"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";

const LINKS = [
  { href: "#product", label: "Product" },
  { href: "#patients", label: "For patients" },
  { href: "#therapists", label: "For therapists" },
  { href: "#how", label: "How it works" },
];

/** Top bar. Links jump within the page; the menu collapses on phones. */
export default function LandingNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-slate-300 bg-[var(--paper)]">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-5 sm:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded" aria-label="Swasthya home">
          <Image src="/swasthya-logo-icon.png" alt="" width={34} height={34} className="size-[34px] object-contain" priority />
          <span translate="no" className="text-lg font-bold tracking-tight">Swasthya</span>
        </Link>

        <nav aria-label="Page" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900">{l.label}</a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher />
          <Link href="/sign-in" className="hidden rounded-md px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 sm:inline-flex">Sign in</Link>
          <Link href="/onboarding" className="inline-flex h-10 items-center rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700">Get started</Link>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="landing-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="inline-flex size-10 items-center justify-center rounded-md text-slate-800 hover:bg-slate-100 md:hidden"
          >
            {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="landing-menu" aria-label="Page" className="border-t border-slate-300 bg-[var(--paper)] px-5 pb-4 pt-2 md:hidden">
          <ul>
            {LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={() => setOpen(false)} className="block border-b border-slate-300 py-3 text-base font-semibold text-slate-900">{l.label}</a>
              </li>
            ))}
            <li><Link href="/sign-in" className="block py-3 text-base font-semibold text-slate-900">Sign in</Link></li>
          </ul>
        </nav>
      )}
    </header>
  );
}
