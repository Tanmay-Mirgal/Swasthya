"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { useRealtime } from "@/lib/realtime/client";
import { RealtimeEvent } from "@/lib/realtime/protocol";

export interface NavBadges {
  role: "patient" | "doctor" | null;
  unreadMessages: number;
  pendingRequests: number;
  /** Weekly reports waiting for the therapist (therapists only). */
  reviewsReady: number;
  messagesHref: string | null;
  liveConsultationId: string | null;
}

const EMPTY: NavBadges = { role: null, unreadMessages: 0, pendingRequests: 0, reviewsReady: 0, messagesHref: null, liveConsultationId: null };

/** Real counts for navigation (unread messages, pending requests). Refreshes when a chat event arrives. */
export function useNavBadges(): NavBadges {
  const { getToken, isSignedIn } = useAuth();
  const { client } = useRealtime();
  const [badges, setBadges] = useState<NavBadges>(EMPTY);
  const getTokenRef = useRef(getToken);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getTokenRef.current = getToken;
  });

  const load = useCallback(async () => {
    try {
      const token = await getTokenRef.current();
      if (!token) return;
      const res = await fetch("/api/nav/badges", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) setBadges(json.data);
    } catch {
      /* badges are best-effort; navigation still works without them */
    }
  }, []);

  useEffect(() => {
    if (!isSignedIn) return;
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void load(), 400);
    };
    refresh();
    const offs = [
      client.on(RealtimeEvent.CHAT_MESSAGE, refresh),
      client.on(RealtimeEvent.MESSAGE_READ, refresh),
      client.onReady(refresh),
    ];
    const interval = setInterval(() => void load(), 90_000);
    return () => {
      offs.forEach((off) => off());
      clearInterval(interval);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [client, isSignedIn, load]);

  return badges;
}
