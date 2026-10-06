"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/react";
import { cn } from "@/lib/utils";
import { useNavBadges } from "@/hooks/useNavBadges";
import { getNavItems, navHiddenFor } from "./navConfig";

/** Phone navigation: bottom bar, thumb reach, labelled icons, real counts. */
export default function BottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const { user } = useUser();
  const badges = useNavBadges();

  if (navHiddenFor(pathname)) return null;

  const isTherapist = user?.publicMetadata?.role === "therapist" || pathname.startsWith("/therapist");
  const items = getNavItems(isTherapist, badges);

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-900 bg-[var(--paper)] md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="mx-auto flex max-w-xl items-stretch">
        {items.map((item) => {
          const active = item.isActive(pathname, tab);
          const Icon = item.icon;
          return (
            <li key={item.key} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold",
                  active ? "text-slate-900" : "text-slate-600"
                )}
              >
                {active && <span aria-hidden="true" className="absolute inset-x-3 top-0 h-[3px] bg-emerald-600" />}
                <span className="relative">
                  <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 1.9} aria-hidden="true" />
                  {item.badge ? (
                    <span className="absolute -right-3 -top-1.5 min-w-4 rounded bg-amber-300 px-1 text-center text-xs font-bold leading-4 tabular text-[var(--ink)]">
                      {item.badge}
                      <span className="sr-only"> {item.badgeLabel}</span>
                    </span>
                  ) : null}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
