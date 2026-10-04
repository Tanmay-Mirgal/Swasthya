"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/react";
import { Home, Dumbbell, BarChart2, Activity, Users, Stethoscope, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function BottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab");
  const { user } = useUser();

  // Hide bottom nav on live camera, setup, or consultation pages for distraction-free view
  if (pathname.includes("/live") || pathname.includes("/setup") || pathname.includes("/consultation")) {
    return null;
  }

  const isTherapist = user?.publicMetadata?.role === "therapist" || pathname.startsWith("/therapist");

  const patientNavItems = [
    {
      label: "Dashboard",
      href: "/",
      icon: Activity,
    },
    {
      label: "Appointments",
      href: "/appointments",
      icon: Stethoscope,
    },
    {
      label: "Exercises",
      href: "/exercise",
      icon: Dumbbell,
    },
    {
      label: "Profile",
      href: "/profile",
      icon: UserCircle,
    },
  ];

  const therapistNavItems = [
    {
      label: "Dashboard",
      href: "/therapist",
      icon: Activity,
    },
    {
      label: "Patients",
      href: "/therapist?tab=patients",
      icon: Users,
    },
    {
      label: "Appointments",
      href: "/therapist?tab=appointments",
      icon: Stethoscope,
    },
    {
      label: "Profile",
      href: "/therapist?tab=profile",
      icon: UserCircle,
    },
  ];

  const navItems = isTherapist ? therapistNavItems : patientNavItems;

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 w-full max-w-full sm:max-w-[440px] mx-auto bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-[0_-2px_12px_rgba(15,23,42,0.04)]"
      style={{
        paddingBottom: "max(env(safe-area-inset-bottom, 0px), 6px)",
      }}
    >
      <div className="flex items-center justify-around h-16 px-4">
        {navItems.map((item) => {
          const isActive = isTherapist && pathname.startsWith("/therapist")
            ? item.href === "/therapist"
              ? pathname === "/therapist" && !currentTab
              : Boolean(currentTab && item.href.includes(`tab=${currentTab}`))
            : pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center w-16 h-12 rounded-xl transition-all duration-200 relative",
                isActive ? "text-emerald-700" : "text-slate-400 hover:text-slate-600"
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center w-9 h-7 rounded-full mb-0.5 transition-all duration-200",
                  isActive ? "bg-emerald-50 text-emerald-600" : "bg-transparent"
                )}
              >
                <Icon
                  className={cn(
                    "w-5 h-5 transition-transform duration-200",
                    isActive ? "stroke-[2.5px] scale-105" : "stroke-2"
                  )}
                />
              </div>
              <span className={cn(
                "text-[10px] font-medium transition-all duration-200",
                isActive ? "font-bold text-emerald-700" : ""
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
