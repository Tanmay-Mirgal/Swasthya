"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Dumbbell,
  BarChart2,
  Users,
  Sparkles,
  Stethoscope,
  Play,
} from "lucide-react";
import { SignInButton, SignUpButton, UserButton, useAuth } from "@clerk/react";
import { cn } from "@/lib/utils";

export default function DesktopNavbar() {
  const pathname = usePathname();
  const { isLoaded, isSignedIn } = useAuth();

  // Hide on camera / full exercise pages if needed
  if (pathname.includes("/live")) {
    return null;
  }

  const navLinks = [
    {
      label: "Dashboard",
      href: "/",
      icon: Activity,
      exact: true,
    },
    {
      label: "Exercises",
      href: "/exercise",
      icon: Dumbbell,
      exact: false,
    },
    {
      label: "Progress",
      href: "/progress",
      icon: BarChart2,
      exact: false,
    },
    {
      label: "Find Therapists",
      href: "/discover",
      icon: Users,
      exact: false,
    },
    {
      label: "Therapist Portal",
      href: "/therapist",
      icon: Stethoscope,
      exact: false,
    },
  ];

  return (
    <header className="hidden md:block sticky top-0 z-50 w-full bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-xs transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Brand Logo & Platform Badge */}
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-xl"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-sm shadow-blue-500/25 group-hover:scale-105 transition-transform duration-200">
                <Activity className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-bold tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
                    RehabLens
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60">
                    AI Platform
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-medium -mt-0.5">
                  Smart Rehabilitation & Vision
                </span>
              </div>
            </Link>

            {/* Nav Items */}
            <nav className="flex items-center gap-1 ml-4">
              {navLinks.map((item) => {
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150",
                      isActive
                        ? "bg-slate-100 text-slate-900 shadow-2xs font-semibold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-4 h-4 transition-colors",
                        isActive ? "text-blue-600 stroke-[2.5]" : "text-slate-400"
                      )}
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Area: Quick Action + Profile Auth */}
          <div className="flex items-center gap-3">
            {/* Quick Session Start Button */}
            <Link
              href="/exercise"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs shadow-blue-500/20 transition-all hover:shadow-sm"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Start Session</span>
            </Link>

            <div className="h-5 w-px bg-slate-200 mx-1" />

            {/* Auth Buttons */}
            {isLoaded && !isSignedIn && (
              <div className="flex items-center gap-2">
                <SignInButton mode="modal">
                  <button className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors cursor-pointer">
                    Sign In
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="px-3.5 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-2xs transition-colors cursor-pointer">
                    Sign Up
                  </button>
                </SignUpButton>
              </div>
            )}

            {isLoaded && isSignedIn && (
              <div className="flex items-center pl-1">
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: "w-8 h-8 rounded-full border border-slate-200",
                    },
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
