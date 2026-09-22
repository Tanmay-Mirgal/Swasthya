"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Dumbbell, BarChart2, Shield } from "lucide-react";

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
    <nav className="fixed bottom-0 left-0 right-0 z-50 max-w-[440px] mx-auto px-4 pb-3 pt-1 pointer-events-none">
      <div className="pointer-events-auto bg-zinc-900/90 backdrop-blur-2xl border border-zinc-800/80 rounded-2xl shadow-2xl flex items-center justify-around h-14 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center justify-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 ${
                isActive
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-emerald-400" : "text-zinc-400"}`} />
              <span className={`text-xs font-semibold ${isActive ? "text-white" : "text-zinc-400"}`}>
                {item.label}
              </span>
              {isActive && (
                <span className="absolute -top-1 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
