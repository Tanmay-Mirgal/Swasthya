/* eslint-disable react-hooks/set-state-in-effect */
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
          <p className="text-sm text-slate-500">No session record found.</p>
          <a
            href="/exercise"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
          >
            Start an Exercise
          </a>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell hideNav>
      <div className="pt-4 h-full flex flex-col flex-1">
        <SessionSummary session={session} />
      </div>
    </AppShell>
  );
}
