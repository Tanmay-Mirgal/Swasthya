"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Dumbbell, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function BottomNav() {
  const pathname = usePathname();

  // Hide bottom nav on live camera / setup pages for distraction-free view
  if (pathname.includes("/live") || pathname.includes("/setup")) {
    return null;
  }

  const navItems = [
    {
      label: "Home",
      href: "/",
      icon: Home,
    },
    {
      label: "Exercises",
      href: "/exercise",
      icon: Dumbbell,
    },
    {
      label: "Progress",
      href: "/progress",
      icon: BarChart2,
    },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 max-w-[440px] mx-auto bg-white/90 backdrop-blur-lg border-t border-slate-200"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="flex items-center justify-around h-20 px-4 pb-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center w-16 h-14 rounded-2xl transition-all duration-300 relative",
                isActive ? "text-slate-900" : "text-slate-400 hover:text-slate-600"
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center w-10 h-8 rounded-full mb-1 transition-all duration-300",
                  isActive ? "bg-slate-100" : "bg-transparent"
                )}
              >
                <Icon
                  className={cn(
                    "w-5 h-5 transition-transform duration-300",
                    isActive ? "stroke-[2.5px] scale-110" : "stroke-2"
                  )}
                />
              </div>
              <span className={cn(
                "text-[10px] font-medium transition-all duration-300",
                isActive ? "font-semibold text-slate-900" : ""
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
