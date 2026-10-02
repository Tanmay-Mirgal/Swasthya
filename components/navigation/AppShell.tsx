"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, Sparkles, Activity } from "lucide-react";
import BottomNav from "./BottomNav";

interface AppShellProps {
  children: ReactNode;
  title?: string;
  showBackNav?: boolean;
  backHref?: string;
  hideNav?: boolean;
  rightAction?: ReactNode;
}

export default function AppShell({
  children,
  title,
  showBackNav = false,
  backHref = "/",
  hideNav = false,
  rightAction,
}: AppShellProps) {
  return (
    <div className="min-h-screen min-h-dvh bg-zinc-950 flex flex-col items-center justify-start text-zinc-100 antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Background Ambient Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-96 bg-emerald-600/10 blur-[120px] pointer-events-none z-0" />

      {/* Centered App Container Shell (Mobile & Desktop Responsive) */}
      <div className="w-full max-w-[440px] min-h-screen min-h-dvh bg-zinc-950/95 border-x border-zinc-800/80 flex flex-col shadow-2xl relative z-10 pb-20">
        {/* Sleek Top Navigation Header */}
        {title && (
          <header
            className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/80 px-4 flex items-center justify-between transition-all"
            style={{
              // Account for Android status bar height using safe-area-inset-top
              paddingTop: "calc(env(safe-area-inset-top, 0px) + 0px)",
              height: "calc(env(safe-area-inset-top, 0px) + 56px)",
            }}
          >
            {showBackNav ? (
              <Link
                href={backHref}
                className="text-zinc-400 hover:text-white p-1.5 -ml-1.5 rounded-xl hover:bg-zinc-800/60 transition-colors flex items-center gap-1 text-xs font-semibold"
              >
                <ChevronLeft className="w-4 h-4 text-emerald-400" />
                <span>Back</span>
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                  <Activity className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="text-xs font-bold tracking-tight text-white flex items-center gap-1">
                  RehabLens <span className="text-[9px] font-black text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-1.5 py-0.2 rounded-full uppercase">AI</span>
                </span>
              </div>
            )}

            <h1 className="text-sm font-bold tracking-tight text-white truncate max-w-[180px]">
              {title}
            </h1>

            {rightAction ? (
              <div className="flex items-center">{rightAction}</div>
            ) : (
              <div className="w-8 flex justify-end">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="System Active" />
              </div>
            )}
          </header>
        )}

        {/* Screen Main Content */}
        <main className="flex-1 flex flex-col p-4 space-y-4">{children}</main>

        {/* Bottom Navigation */}
        {!hideNav && <BottomNav />}
      </div>
    </div>
  );
}

