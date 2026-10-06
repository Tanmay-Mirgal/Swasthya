/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/react";
import AppShell from "@/components/layout/AppShell";
import LandingPage from "@/components/landing/LandingPage";
import PatientHome from "@/components/patient/PatientHome";
import { Button, Notice, PageLoading } from "@/components/ui";
import { useNavBadges } from "@/hooks/useNavBadges";
import { useRealtime } from "@/lib/realtime/client";
import { RealtimeEvent } from "@/lib/realtime/protocol";
import type { PlanSnapshot } from "@/lib/rehab/sessionService";

interface DashboardData {
  assignment?: { status: string };
  therapist?: { professionalName: string; clerkUserId: string; specialization?: string };
  pendingRequest?: { therapistId?: string } | null;
  requestedTherapist?: { professionalName: string } | null;
  activeConsultation?: { _id: string; issue: string } | null;
  consultationDoctor?: { professionalName: string } | null;
  sessions?: { exerciseName: string; completedReps: number; targetReps: number; rom?: number; durationSeconds?: number; date: string }[];
}

function greetingFor(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatDuration(seconds?: number) {
  if (!seconds) return undefined;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function HomePage() {
  const router = useRouter();
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const badges = useNavBadges();

  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [plan, setPlan] = useState<PlanSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setIsLoading(false);
      return;
    }
    if (user?.publicMetadata?.role === "therapist") {
      router.replace("/therapist");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const headers = { Authorization: `Bearer ${token}` };
        const tz = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone);
        const [dashRes, planRes] = await Promise.all([fetch("/api/patient/dashboard", { headers }), fetch(`/api/patient/plan?tz=${tz}`, { headers })]);
        const dash = await dashRes.json();
        if (cancelled) return;
        if (dash.isTherapist || dash.redirect === "/therapist") {
          router.replace("/therapist");
          return;
        }
        const planJson = await planRes.json();
        if (!dashRes.ok || !dash.success || !planRes.ok || !planJson.success) {
          setError(dash.error || planJson.error || "We couldn’t load your plan.");
          return;
        }
        setData(dash.data);
        setPlan(planJson.data);
        setError(null);
      } catch {
        if (!cancelled) setError("We couldn’t reach Swasthya. Check your connection and try again.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, isLoaded, user, router, getToken, attempt]);

  // The therapist saving or changing the plan reaches this screen without a reload.
  const { client: realtimeClient } = useRealtime();
  useEffect(() => {
    const off = realtimeClient.on(RealtimeEvent.RECOVERY_PLAN_UPDATED, () => setAttempt((n) => n + 1));
    return () => off();
  }, [realtimeClient]);

  const view = useMemo(() => {
    const now = new Date();
    const last = data?.sessions?.[0];
    return {
      greeting: greetingFor(now.getHours()),
      dateLabel: now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }),
      lastSession: last
        ? {
            exerciseName: last.exerciseName,
            dateLabel: new Date(last.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
            reps: last.completedReps,
            targetReps: last.targetReps,
            rom: last.rom || undefined,
            durationLabel: formatDuration(last.durationSeconds),
          }
        : null,
    };
  }, [data]);

  if (isLoaded && !isSignedIn) {
    return <LandingPage />;
  }

  if (isLoading || (!plan && !error)) {
    return (
      <AppShell title="Today">
        <PageLoading label="Loading your plan" />
      </AppShell>
    );
  }

  if (error || !plan) {
    return (
      <AppShell title="Today">
        <div className="mx-auto w-full max-w-xl pt-6">
          <Notice tone="danger" title="We couldn’t load your plan" action={<Button size="sm" variant="secondary" onClick={() => { setError(null); setIsLoading(true); setAttempt((n) => n + 1); }}>Try again</Button>}>
            {error}
          </Notice>
        </div>
      </AppShell>
    );
  }

  const therapist =
    data?.assignment?.status === "active" && data.therapist
      ? {
          name: data.therapist.professionalName,
          specialization: data.therapist.specialization,
          chatHref: `/chat/${data.therapist.clerkUserId}`,
          profileHref: `/therapist-profile/${data.therapist.clerkUserId}`,
          unread: badges.unreadMessages,
        }
      : null;

  return (
    <AppShell title="Today" maxWidth="wide">
      <PatientHome
        firstName={user?.firstName || undefined}
        dateLabel={view.dateLabel}
        greeting={view.greeting}
        plan={plan}
        liveConsultation={
          data?.activeConsultation
            ? { id: data.activeConsultation._id, doctorName: data.consultationDoctor?.professionalName || "your physiotherapist", issue: data.activeConsultation.issue }
            : null
        }
        therapist={therapist}
        pendingReferral={data?.pendingRequest ? { therapistName: data.requestedTherapist?.professionalName } : null}
        lastSession={view.lastSession}
      />
    </AppShell>
  );
}
