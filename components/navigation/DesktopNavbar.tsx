"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Activity,
  Dumbbell,
  BarChart2,
  Users,
  Sparkles,
  Stethoscope,
  Play,
  UserCircle,
} from "lucide-react";
import { SignInButton, SignUpButton, UserButton, useAuth, useUser } from "@clerk/react";
import { cn } from "@/lib/utils";

export default function DesktopNavbar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab");
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  // Hide on camera / full exercise pages if needed
  if (pathname.includes("/live")) {
    return null;
  }

  const isTherapist = user?.publicMetadata?.role === "therapist" || pathname.startsWith("/therapist");

  const patientNavLinks = [
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
  ];

  const therapistNavLinks = [
    {
      label: "Dashboard",
      href: "/therapist",
      icon: Activity,
      exact: true,
    },
    {
      label: "Patients List",
      href: "/therapist?tab=patients",
      icon: Users,
      exact: false,
    },
    {
      label: "Appointments",
      href: "/therapist?tab=appointments",
      icon: Stethoscope,
      exact: false,
    },
    {
      label: "Practice Profile",
      href: "/therapist?tab=profile",
      icon: UserCircle,
      exact: false,
    },
  ];

  const navLinks = isTherapist ? therapistNavLinks : patientNavLinks;

  return (
    <header className="hidden md:block sticky top-0 z-50 w-full bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-xs transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Brand Logo & Platform Badge */}
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded-xl"
            >
              <div className="size-9 shrink-0 transition-transform duration-200 group-hover:scale-105">
                <img src="/swasthya-logo-icon.png" alt="Swasthya" className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-extrabold tracking-tight text-slate-900 group-hover:text-emerald-700 transition-colors">
                    Swasthya
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                    AI Health
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-medium -mt-0.5">
                  Precision Recovery & Computer Vision
                </span>
              </div>
            </Link>

            {/* Nav Items */}
            <nav className="flex items-center gap-1 ml-4">
              {navLinks.map((item) => {
                const isActive = isTherapist && pathname.startsWith("/therapist")
                  ? item.href === "/therapist"
                    ? pathname === "/therapist" && !currentTab
                    : Boolean(currentTab && item.href.includes(`tab=${currentTab}`))
                  : item.exact
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
                        ? "bg-emerald-50 text-emerald-800 shadow-2xs font-semibold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-4 h-4 transition-colors",
                        isActive ? "text-emerald-700 stroke-[2.5]" : "text-slate-400"
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
            {/* Quick Action Button: Therapist vs Patient */}
            {!isTherapist ? (
              <Link
                href="/exercise"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all hover:shadow-sm"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Start Session</span>
              </Link>
            ) : (
              <Link
                href="/therapist?tab=appointments"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs transition-all hover:shadow-sm"
              >
                <Stethoscope className="w-3.5 h-3.5" />
                <span>Appointments</span>
              </Link>
            )}

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
