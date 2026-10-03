"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { SignInButton, SignUpButton, UserButton, useAuth } from "@clerk/react";
import DesktopNavbar from "./DesktopNavbar";
import BottomNav from "./BottomNav";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: ReactNode;
  title?: string;
  showBackNav?: boolean;
  backHref?: string;
  hideNav?: boolean;
  hideHeader?: boolean;
  rightAction?: ReactNode;
  maxWidth?: "default" | "full" | "wide";
}

export default function AppShell({
  children,
  title,
  showBackNav = false,
  backHref = "/",
  hideNav = false,
  hideHeader = false,
  rightAction,
  maxWidth = "default",
}: AppShellProps) {
  const { isLoaded, isSignedIn } = useAuth();

  const getMaxWidthClass = () => {
    switch (maxWidth) {
      case "full":
        return "md:max-w-none md:px-6";
      case "wide":
        return "md:max-w-7xl md:px-6";
      case "default":
      default:
        return "md:max-w-6xl";
    }
  };

  return (
    <div className="min-h-screen min-h-dvh bg-slate-50 flex flex-col items-center justify-start text-slate-900 antialiased">
      {/* Desktop Platform Top Navbar (Hidden on mobile) */}
      {!hideNav && <DesktopNavbar />}

      {/* App Container Shell: Exact 440px on mobile, expands on desktop */}
      <div className={cn(
        "w-full max-w-[440px] min-h-screen min-h-dvh bg-slate-50 sm:border-x md:border-x-0 sm:border-slate-200 flex flex-col relative z-10 pb-20 md:pb-8",
        getMaxWidthClass()
      )}>
        
        {/* Mobile Header: Exact original on mobile, hidden on desktop */}
        {!hideHeader && (
          <header
            className={cn(
              "md:hidden sticky top-0 z-40 bg-slate-50/80 backdrop-blur-md border-b border-slate-200 px-4 flex items-center justify-between transition-all",
              !title && !showBackNav && !rightAction && hideNav && "hidden"
            )}
            style={{
              paddingTop: "calc(env(safe-area-inset-top, 0px) + 0px)",
              height: "calc(env(safe-area-inset-top, 0px) + 56px)",
            }}
          >
            <div className="flex items-center flex-1">
              {showBackNav && (
                <Link
                  href={backHref}
                  className="text-slate-500 hover:text-slate-900 p-2 -ml-2 rounded-xl transition-colors flex items-center justify-center"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Link>
              )}
            </div>

            {title && (
              <h1 className="text-base font-semibold tracking-tight text-slate-900 truncate max-w-[200px] text-center flex-1">
                {title}
              </h1>
            )}

            <div className="flex items-center justify-end flex-1 gap-2">
              {rightAction}
              {isLoaded && !isSignedIn && (
                <>
                  <SignInButton mode="modal">
                    <button className="text-sm font-medium text-slate-700 hover:text-slate-900">Sign in</button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                    <button className="text-sm font-semibold text-blue-600 hover:text-blue-700">Sign up</button>
                  </SignUpButton>
                </>
              )}
              {isLoaded && isSignedIn && (
                <UserButton />
              )}
            </div>
          </header>
        )}

        {/* Screen Main Content */}
        <main className="flex-1 flex flex-col p-4 md:px-8 md:py-6">
          {/* Desktop Back button if needed */}
          {showBackNav && (
            <div className="hidden md:flex items-center mb-6">
              <Link
                href={backHref}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 bg-white hover:bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors shadow-2xs"
              >
                <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                <span>Back</span>
              </Link>
              {title && (
                <div className="ml-4 pl-4 border-l border-slate-200">
                  <h1 className="text-lg font-semibold tracking-tight text-slate-900">
                    {title}
                  </h1>
                </div>
              )}
            </div>
          )}
          {children}
        </main>

        {/* Bottom Navigation (Hidden on desktop via md:hidden inside BottomNav) */}
        {!hideNav && <BottomNav />}
      </div>
    </div>
  );
}
