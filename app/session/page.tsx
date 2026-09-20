"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/navigation/AppShell";
import SessionSummary from "@/components/session/SessionSummary";
import { getLatestSession } from "@/lib/session/sessionStore";
import { SessionRecord } from "@/lib/exercises/types";

export default function SessionSummaryPage() {
  const [session, setSession] = useState<SessionRecord | null>(null);

  useEffect(() => {
    // Try reading from sessionStorage (just completed) or fall back to latest in localStorage
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("last_completed_session");
      if (stored) {
        try {
          setSession(JSON.parse(stored));
          return;
        } catch {
          // fallback
        }
      }
    }
    setSession(getLatestSession());
  }, []);

  if (!session) {
    return (
      <AppShell title="Session Summary">
        <div className="flex flex-col items-center justify-center flex-1 py-12 text-center space-y-4">
          <p className="text-sm text-zinc-400">No session record found.</p>
          <a
            href="/exercise"
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold"
          >
            Start an Exercise
          </a>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Session Summary">
      <div className="pt-2">
        <SessionSummary session={session} />
      </div>
    </AppShell>
  );
}
