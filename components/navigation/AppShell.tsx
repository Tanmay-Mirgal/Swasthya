"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { SignInButton, SignUpButton, UserButton, useAuth } from "@clerk/react";
import BottomNav from "./BottomNav";
import { cn } from "@/lib/utils";

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
  const { isLoaded, isSignedIn } = useAuth();

  return (
    <div className="min-h-screen min-h-dvh bg-slate-50 flex flex-col items-center justify-start text-slate-900 antialiased">
      
      {/* Centered App Container Shell (Mobile & Desktop Responsive) */}
      <div className="w-full max-w-[440px] min-h-screen min-h-dvh bg-slate-50 sm:border-x sm:border-slate-200 flex flex-col relative z-10 pb-20">
        
        <header
          className={cn(
            "sticky top-0 z-40 bg-slate-50/80 backdrop-blur-md border-b border-slate-200 px-4 flex items-center justify-between transition-all",
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

        {/* Screen Main Content */}
        <main className="flex-1 flex flex-col p-4">{children}</main>

        {/* Bottom Navigation */}
        {!hideNav && <BottomNav />}
      </div>
    </div>
  );
}
