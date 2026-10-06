"use client";

import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/react";
import AppShell from "@/components/layout/AppShell";
import { Notice, PageHeader, PageLoading } from "@/components/ui";
import { PlanBuilder, type ExistingPlan } from "@/components/prescription/PlanBuilder";

interface Loaded {
  name: string;
  plan: ExistingPlan | null;
}

export default function PrescribePage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = use(params);
  const consultationId = useSearchParams().get("consultation") || undefined;
  const { getToken } = useAuth();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await fetch(`/api/therapist/patient/${patientId}`, { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        if (!mounted) return;
        if (!json.success) {
          setError(json.error || "We couldn’t load this patient.");
          return;
        }
        const u = json.data.user;
        setLoaded({ name: `${u?.firstName || ""} ${u?.lastName || ""}`.trim() || "this patient", plan: json.data.plan ?? null });
      } catch {
        if (mounted) setError("We couldn’t reach Swasthya. Check your connection and try again.");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [getToken, patientId]);

  const back = `/therapist/patient/${patientId}`;

  if (error) {
    return (
      <AppShell title="Rehabilitation plan" showBackNav backHref={back}>
        <Notice tone="danger" title="We couldn’t load this patient">{error}</Notice>
      </AppShell>
    );
  }
  if (!loaded) {
    return (
      <AppShell title="Rehabilitation plan" showBackNav backHref={back}>
        <PageLoading label="Loading the patient" />
      </AppShell>
    );
  }

  const revising = Boolean(loaded.plan);
  return (
    <AppShell title="Rehabilitation plan" showBackNav backHref={back} maxWidth="wide">
      <PageHeader
        title={revising ? `Revise the plan for ${loaded.name}` : `Rehabilitation plan for ${loaded.name}`}
        description={revising ? "Changes are saved as a new version. The current plan stays in their history." : "Choose the exercises, set the dose and the schedule. The patient sees it on their sheet as soon as you save."}
      />
      <PlanBuilder patientId={patientId} patientName={loaded.name} consultationId={consultationId} existing={loaded.plan} backHref={back} />
    </AppShell>
  );
}
