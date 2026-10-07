"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { SignInButton, SignUpButton, UserButton, useAuth, useUser } from "@clerk/react";
import { PanelLeftClose, PanelLeftOpen, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavBadges } from "@/hooks/useNavBadges";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import { getNavItems, navHiddenFor, PROFILE_HREF } from "./navConfig";

/** Desktop navigation: a green rail down the left edge, open by default and collapsible to icons. Hidden below md (bottom bar takes over). */
export default function SideRail() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const badges = useNavBadges();
  const [collapsed, setCollapsed] = useSidebarCollapsed();

  if (navHiddenFor(pathname)) return null;

  const isTherapist = user?.publicMetadata?.role === "therapist" || pathname.startsWith("/therapist");
  const items = getNavItems(isTherapist, badges);

  return (
    <aside
      id="sidebar"
      data-on-dark
      data-collapsed={collapsed}
      className={cn(
        "on-dark fixed inset-y-0 left-0 z-40 hidden flex-col overflow-x-hidden bg-emerald-900 text-emerald-50 transition-[width] duration-200 motion-reduce:transition-none md:flex",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div className={cn("flex pt-6", collapsed ? "flex-col items-center gap-3 pb-4" : "items-center gap-3 px-5 pb-5")}>
        <Link href={isTherapist ? "/therapist" : "/"} aria-label={collapsed ? "Swasthya home" : undefined} className="flex min-w-0 flex-1 items-center gap-3">
          <Image src="/swasthya-logo-icon.png" alt="" width={36} height={36} className="size-9 shrink-0 rounded-md bg-white p-0.5 object-contain" />
          {!collapsed && <span translate="no" className="text-lg font-bold tracking-tight">Swasthya</span>}
        </Link>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          aria-controls="sidebar"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-emerald-100 hover:bg-emerald-800"
        >
          {collapsed ? <PanelLeftOpen className="size-5" aria-hidden="true" /> : <PanelLeftClose className="size-5" aria-hidden="true" />}
        </button>
      </div>

      <nav aria-label="Main" className={cn("flex-1 overflow-y-auto", collapsed ? "px-2" : "px-3")}>
        <ul className="flex flex-col gap-0.5">
          {items.map((item) => {
            const active = item.isActive(pathname, tab);
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "relative flex items-center rounded-lg py-2.5 text-sm font-semibold transition-colors",
                    collapsed ? "justify-center px-0" : "gap-3 px-3",
                    active ? "bg-[var(--paper)] text-slate-900" : "text-emerald-100 hover:bg-emerald-800"
                  )}
                >
                  <Icon className="size-[18px] shrink-0" strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
                  <span className={collapsed ? "sr-only" : "flex-1"}>{item.label}</span>
                  {item.badge ? (
                    <span className={cn("rounded bg-amber-300 px-1.5 text-xs font-bold tabular text-[var(--ink)]", collapsed && "absolute right-0.5 top-0.5 px-1 text-[10px] leading-4")}>
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

      <div className={cn("border-t border-emerald-800 py-4", collapsed ? "flex flex-col items-center px-2" : "px-4")}>
        {!collapsed && <LanguageSwitcher variant="dark" className="mb-3 w-full [&>select]:w-full" />}
        {!collapsed && isLoaded && !isSignedIn && (
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
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{user?.fullName || user?.firstName || "Account"}</p>
                {!isTherapist && (
                  <Link href={PROFILE_HREF} className="inline-flex items-center gap-1 text-xs text-emerald-200 underline-offset-2 hover:underline">
                    <UserRound className="size-3" aria-hidden="true" /> Your profile
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
