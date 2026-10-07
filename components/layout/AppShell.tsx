"use client";

import { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft } from "lucide-react";
import { SignInButton, SignUpButton, UserButton, useAuth } from "@clerk/react";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import SideRail from "./SideRail";
import BottomNav from "./BottomNav";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: ReactNode;
  title?: string;
  showBackNav?: boolean;
  backHref?: string;
  hideNav?: boolean;
  hideHeader?: boolean;
  hideBottomNav?: boolean;
  rightAction?: ReactNode;
  maxWidth?: "default" | "full" | "wide";
  fullBleed?: boolean;
  className?: string;
}

/**
 * Shared frame: green rail on desktop, labelled bottom bar on phones, a quiet top bar with the
 * page title and account on phones. Content width is predictable: 64rem default, 80rem wide.
 */
export default function AppShell({
  children,
  title,
  showBackNav = false,
  backHref = "/",
  hideNav = false,
  hideHeader = false,
  hideBottomNav = false,
  rightAction,
  maxWidth = "default",
  fullBleed = false,
  className,
}: AppShellProps) {
  const { isLoaded, isSignedIn } = useAuth();

  const width = maxWidth === "full" ? "max-w-none" : maxWidth === "wide" ? "max-w-[80rem]" : "max-w-5xl";

  return (
    <div
      className={cn(
        "w-full bg-(--paper) text-slate-900",
        fullBleed ? "h-dvh overflow-hidden flex flex-col" : "min-h-dvh",
      )}
    >
      {!hideNav && <SideRail />}

      <div
        className={cn(
          "flex flex-1 flex-col",
          fullBleed ? "h-dvh overflow-hidden" : "min-h-dvh",
          !hideNav && "md:pl-60",
        )}
      >
        {!hideHeader && (
          <header
            className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-slate-300 bg-(--paper) px-3 md:hidden"
            style={{
              paddingTop: "env(safe-area-inset-top, 0px)",
              height: "calc(env(safe-area-inset-top, 0px) + 56px)",
            }}
          >
            {showBackNav ? (
              <Link
                href={backHref}
                aria-label="Back"
                className="-ml-1 flex size-10 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"
              >
                <ChevronLeft className="size-5" />
              </Link>
            ) : (
              <Link
                href="/"
                className="flex items-center gap-2 pr-1"
                aria-label="Swasthya home"
              >
                <Image
                  src="/swasthya-logo-icon.png"
                  alt=""
                  width={28}
                  height={28}
                  className="size-7 object-contain"
                />
              </Link>
            )}
            {title ? (
              <h1 className="min-w-0 flex-1 truncate text-base font-bold">
                {title}
              </h1>
            ) : (
              <span className="flex-1 text-base font-bold">Swasthya</span>
            )}
            <div className="flex items-center gap-2">
              {rightAction}
              <LanguageSwitcher />
              {isLoaded && !isSignedIn && (
                <>
                  <SignInButton mode="modal">
                    <button className="px-2 text-sm font-semibold text-slate-700">
                      Sign in
                    </button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                    <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white">
                      Sign up
                    </button>
                  </SignUpButton>
                </>
              )}
              {isLoaded && isSignedIn && <UserButton />}
            </div>
          </header>
        )}

        <main
          id="main"
          className={cn(
            fullBleed
              ? "flex w-full min-w-0 flex-1 flex-col overflow-hidden p-0 max-w-none"
              : cn(
                  "mx-auto flex w-full min-w-0 flex-1 flex-col px-4 py-5 sm:px-6 md:px-8 md:py-8",
                  width,
                  !hideNav && "pb-24 md:pb-8",
                ),
            className,
          )}
        >
          {showBackNav && !fullBleed && (
            <div className="mb-5 hidden items-center gap-3 md:flex">
              <Link
                href={backHref}
                className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700 underline-offset-4 hover:underline"
              >
                <ChevronLeft className="size-4" aria-hidden="true" /> Back
              </Link>
              {title && (
                <h1 className="border-l border-slate-300 pl-3 text-lg font-bold">
                  {title}
                </h1>
              )}
            </div>
          )}
          {children}
        </main>

        {!hideNav && !hideBottomNav && <BottomNav />}
      </div>
    </div>
  );
}
