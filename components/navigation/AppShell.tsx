import { ReactNode } from "react";
import BottomNav from "./BottomNav";

interface AppShellProps {
  children: ReactNode;
  title?: string;
  showBackNav?: boolean;
  backHref?: string;
  hideNav?: boolean;
}

export default function AppShell({
  children,
  title,
  showBackNav = false,
  backHref = "/",
  hideNav = false,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 flex flex-col items-center justify-start text-zinc-900 dark:text-zinc-100 antialiased selection:bg-emerald-500 selection:text-white">
      {/* Centered Mobile Frame Shell */}
      <div className="w-full max-w-[430px] min-h-screen bg-white dark:bg-zinc-900 border-x border-zinc-200 dark:border-zinc-800 flex flex-col shadow-2xl relative pb-20">
        {/* Optional Header */}
        {title && (
          <header className="sticky top-0 z-40 bg-white/90 dark:bg-zinc-900/90 backdrop-blur border-b border-zinc-200 dark:border-zinc-800 px-4 h-14 flex items-center justify-between">
            {showBackNav ? (
              <a
                href={backHref}
                className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 p-1 rounded-lg flex items-center gap-1 text-sm font-medium"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </a>
            ) : (
              <div className="w-8" />
            )}
            <h1 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {title}
            </h1>
            <div className="w-8" />
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
