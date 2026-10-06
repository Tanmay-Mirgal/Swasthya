/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import SessionSummary from "@/components/session/SessionSummary";
import { Button, EmptyState } from "@/components/ui";
import { getLatestSession, getSessionHistory } from "@/lib/session/sessionStore";
import { SessionRecord } from "@/lib/exercises/types";

export default function SessionSummaryPage() {
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [previous, setPrevious] = useState<SessionRecord | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let current: SessionRecord | null = null;
    try {
      const stored = sessionStorage.getItem("last_completed_session");
      if (stored) current = JSON.parse(stored) as SessionRecord;
    } catch {
      /* fall back to the newest saved session */
    }
    current = current ?? getLatestSession();
    setSession(current);
    if (current) {
      const history = getSessionHistory();
      setPrevious(history.find((s) => s.exerciseId === current!.exerciseId && s.id !== current!.id) ?? null);
    }
    setReady(true);
  }, []);

  return (
    <AppShell title="Session summary" showBackNav backHref="/progress">
      {!ready ? null : session ? (
        <SessionSummary session={session} previous={previous} />
      ) : (
        <div className="mx-auto w-full max-w-xl pt-4">
          <EmptyState
            title="No session to show"
            action={
              <Button asChild size="sm">
                <Link href="/exercise">Start an exercise</Link>
              </Button>
            }
          >
            Once you finish a tracked exercise, its summary appears here.
          </EmptyState>
        </div>
      )}
    </AppShell>
  );
}
