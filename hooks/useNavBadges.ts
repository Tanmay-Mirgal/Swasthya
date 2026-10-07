"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useAuth } from "@clerk/react";
import { useRealtime } from "@/lib/realtime/client";
import { RealtimeEvent } from "@/lib/realtime/protocol";

export interface NavBadges {
  role: "patient" | "doctor" | null;
  unreadMessages: number;
  /** Active patients assigned to the therapist (therapists only). */
  patientCount: number;
  pendingRequests: number;
  /** Weekly reports waiting for the therapist (therapists only). */
  reviewsReady: number;
  messagesHref: string | null;
  liveConsultationId: string | null;
}

const EMPTY: NavBadges = { role: null, unreadMessages: 0, patientCount: 0, pendingRequests: 0, reviewsReady: 0, messagesHref: null, liveConsultationId: null };

const STORAGE_KEY = "swasthya:nav-badges";
/** Ignore a mount-triggered refresh when the data is this fresh (every page remounts the navigation). */
const FRESH_MS = 5_000;

/**
 * Navigation state lives outside React. Every page renders its own AppShell, so the rail and bottom bar
 * remount on each navigation; keeping the last known badges here stops items such as Messages from
 * disappearing until the next fetch returns. Keyed by user so an account switch never shows stale items.
 */
const store: { userId: string | null; badges: NavBadges; fetchedAt: number } = { userId: null, badges: EMPTY, fetchedAt: 0 };
const listeners = new Set<() => void>();
let inFlight: Promise<void> | null = null;

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => store.badges;
const getServerSnapshot = () => EMPTY;

/** Switch the store to a user, restoring their last badges from this tab's session if we have them. */
function adoptUser(userId: string | null) {
  if (store.userId === userId) return;
  store.userId = userId;
  store.fetchedAt = 0;
  store.badges = EMPTY;
  if (userId) {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      const saved = raw ? (JSON.parse(raw) as { userId?: string; badges?: NavBadges }) : null;
      if (saved?.userId === userId && saved.badges) store.badges = saved.badges;
    } catch {
      /* storage can be unavailable; start empty */
    }
  }
  emit();
}

/** Real counts for navigation (unread messages, pending requests). Refreshes when a chat event arrives. */
export function useNavBadges(): NavBadges {
  const { getToken, isSignedIn, userId } = useAuth();
  const { client } = useRealtime();
  const badges = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const getTokenRef = useRef(getToken);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getTokenRef.current = getToken;
  });

  const load = useCallback(async () => {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      try {
        const forUser = store.userId;
        const token = await getTokenRef.current();
        if (!token) return;
        const res = await fetch("/api/nav/badges", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (!json.success || store.userId !== forUser) return;
        store.badges = json.data;
        store.fetchedAt = Date.now();
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ userId: forUser, badges: json.data }));
        } catch {
          /* best-effort cache */
        }
        emit();
      } catch {
        /* badges are best-effort; navigation still works without them */
      }
    })().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }, []);

  useEffect(() => {
    if (!isSignedIn || !userId) {
      adoptUser(null);
      return;
    }
    adoptUser(userId);

    // Load straight away when we have nothing (or only stale data); events are debounced.
    if (Date.now() - store.fetchedAt > FRESH_MS) void load();
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void load(), 400);
    };
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
  }, [client, isSignedIn, userId, load]);

  return badges;
}
