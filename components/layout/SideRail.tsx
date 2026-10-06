"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { SignInButton, SignUpButton, UserButton, useAuth, useUser } from "@clerk/react";
import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavBadges } from "@/hooks/useNavBadges";
import { getNavItems, navHiddenFor, PROFILE_HREF } from "./navConfig";

/** Desktop navigation: a green rail down the left edge. Hidden below md (bottom bar takes over). */
export default function SideRail() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const badges = useNavBadges();

  if (navHiddenFor(pathname)) return null;

  const isTherapist = user?.publicMetadata?.role === "therapist" || pathname.startsWith("/therapist");
  const items = getNavItems(isTherapist, badges);

  return (
    <aside data-on-dark className="on-dark fixed inset-y-0 left-0 z-40 hidden w-60 flex-col bg-emerald-900 text-emerald-50 md:flex">
      <Link href={isTherapist ? "/therapist" : "/"} className="flex items-center gap-3 px-5 pb-5 pt-6">
        <Image src="/swasthya-logo-icon.png" alt="" width={36} height={36} className="size-9 rounded-md bg-white p-0.5 object-contain" />
        <span className="text-lg font-bold tracking-tight">Swasthya</span>
      </Link>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3">
        <ul className="flex flex-col gap-0.5">
          {items.map((item) => {
            const active = item.isActive(pathname, tab);
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                    active ? "bg-[var(--paper)] text-slate-900" : "text-emerald-100 hover:bg-emerald-800"
                  )}
                >
                  <Icon className="size-[18px] shrink-0" strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge ? (
                    <span className="rounded bg-amber-300 px-1.5 text-xs font-bold tabular text-[var(--ink)]">
                      {item.badge}
                      <span className="sr-only"> {item.badgeLabel}</span>
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-emerald-800 px-4 py-4">
        {isLoaded && !isSignedIn && (
          <div className="flex flex-col gap-2">
            <SignInButton mode="modal">
              <button className="rounded-lg border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-50 hover:bg-emerald-800">Sign in</button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="rounded-lg bg-[var(--paper)] px-3 py-2 text-sm font-semibold text-slate-900">Sign up</button>
            </SignUpButton>
          </div>
        )}
        {isLoaded && isSignedIn && (
          <div className="flex items-center gap-3">
            <UserButton appearance={{ elements: { avatarBox: "size-9" } }} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user?.fullName || user?.firstName || "Account"}</p>
              {!isTherapist && (
                <Link href={PROFILE_HREF} className="inline-flex items-center gap-1 text-xs text-emerald-200 underline-offset-2 hover:underline">
                  <UserRound className="size-3" aria-hidden="true" /> Your profile
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
