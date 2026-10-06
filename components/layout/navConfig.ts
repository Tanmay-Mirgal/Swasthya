import {
  CalendarDays,
  ClipboardCheck,
  Dumbbell,
  Home,
  LineChart,
  MessageSquare,
  UserRound,
  Users,
  LayoutList,
  type LucideIcon,
} from "lucide-react";
import type { NavBadges } from "@/hooks/useNavBadges";

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Count shown as a highlighter badge. */
  badge?: number;
  /** Words for screen readers after the label when a badge is present. */
  badgeLabel?: string;
  isActive: (pathname: string, tab: string | null) => boolean;
}

const starts = (pathname: string, base: string) => pathname === base || pathname.startsWith(base + "/");

/** One role-aware navigation model shared by the desktop rail and the mobile bottom bar. */
export function getNavItems(isTherapist: boolean, badges: NavBadges): NavItem[] {
  if (isTherapist) {
    return [
      { key: "overview", label: "Overview", href: "/therapist", icon: LayoutList, isActive: (p, t) => p === "/therapist" && !t },
      {
        key: "patients",
        label: "Patients",
        href: "/therapist?tab=patients",
        icon: Users,
        badge: badges.unreadMessages || undefined,
        badgeLabel: "unread messages",
        isActive: (p, t) => (p === "/therapist" && t === "patients") || p.startsWith("/therapist/patient"),
      },
      {
        key: "reviews",
        label: "Weekly reviews",
        href: "/therapist?tab=reviews",
        icon: ClipboardCheck,
        badge: badges.reviewsReady || undefined,
        badgeLabel: "weekly reports to review",
        isActive: (p, t) => (p === "/therapist" && t === "reviews") || p.startsWith("/therapist/reviews"),
      },
      {
        key: "appointments",
        label: "Appointments",
        href: "/therapist?tab=appointments",
        icon: CalendarDays,
        badge: badges.pendingRequests || undefined,
        badgeLabel: "requests waiting",
        isActive: (p, t) => p === "/therapist" && t === "appointments",
      },
      { key: "practice", label: "Practice profile", href: "/therapist?tab=profile", icon: UserRound, isActive: (p, t) => p === "/therapist" && t === "profile" },
    ];
  }

  const items: NavItem[] = [
    { key: "today", label: "Today", href: "/", icon: Home, isActive: (p) => p === "/" },
    { key: "exercises", label: "Exercises", href: "/exercise", icon: Dumbbell, isActive: (p) => starts(p, "/exercise") },
    { key: "progress", label: "Progress", href: "/progress", icon: LineChart, isActive: (p) => starts(p, "/progress") || starts(p, "/session") },
  ];
  if (badges.messagesHref) {
    items.push({
      key: "messages",
      label: "Messages",
      href: badges.messagesHref,
      icon: MessageSquare,
      badge: badges.unreadMessages || undefined,
      badgeLabel: "unread messages",
      isActive: (p) => p.startsWith("/chat"),
    });
  }
  items.push({
    key: "appointments",
    label: "Appointments",
    href: "/appointments",
    icon: CalendarDays,
    badge: badges.liveConsultationId ? 1 : undefined,
    badgeLabel: "consultation open now",
    isActive: (p) => starts(p, "/appointments") || starts(p, "/discover") || starts(p, "/therapist-profile"),
  });
  return items;
}

export const PROFILE_HREF = "/profile";

/** Routes where navigation is replaced by a focused, full-screen task. */
export function navHiddenFor(pathname: string): boolean {
  return pathname.includes("/live") || pathname.includes("/setup") || pathname.startsWith("/consultation");
}
