/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import AppShell from "@/components/layout/AppShell";
import { Button, Notice, PageHeader, PageLoading, SectionHeading, StatusMark } from "@/components/ui";
import ReportView from "@/components/review/ReportView";
import RecordingPlayer from "@/components/review/RecordingPlayer";
import type { ReviewDetail } from "@/components/review/types";
import { formatDateKey } from "@/lib/rehab/dates";

/** The patient's own weekly report: the same facts their therapist sees, plus the therapist's note once reviewed. */
export default function PatientReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { getToken } = useAuth();
  const [review, setReview] = useState<ReviewDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`/api/weekly-reviews/${id}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "load");
      setReview(json.data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error && e.message !== "load" ? e.message : "We couldn’t load this report. Check your connection and try again.");
    }
  }, [getToken, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <AppShell title="Weekly report" showBackNav backHref="/progress">
        <Notice tone="danger" title="We couldn’t open this report" action={<Button size="sm" variant="secondary" onClick={() => void load()}>Try again</Button>}>{error}</Notice>
      </AppShell>
    );
  }
  if (!review) {
    return (
      <AppShell title="Weekly report" showBackNav backHref="/progress">
        <PageLoading label="Loading your report" />
      </AppShell>
    );
  }

  return (
    <AppShell title={`Week ${review.weekNumber}`} showBackNav backHref="/progress" maxWidth="wide">
      <PageHeader
        title={`Week ${review.weekNumber} report`}
        description={`Review day ${formatDateKey(review.dueDate, { weekday: "long", day: "numeric", month: "long" })}`}
        actions={review.status === "reviewed" ? <StatusMark kind="done">Reviewed by your therapist</StatusMark> : <StatusMark kind="pending">Waiting for your therapist</StatusMark>}
      />
      <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="min-w-0">
          {review.report ? <ReportView report={review.report} /> : <Notice tone="info" title="Your report isn’t ready yet">It is built the morning after your review day, from the sets you completed.</Notice>}
        </div>
        <aside className="min-w-0 space-y-8" aria-label="Recording and your therapist’s note">
          {review.therapistNotes && (
            <section aria-label="Your therapist’s note">
              <SectionHeading title="From your therapist" />
              <p className="hand mt-3">“{review.therapistNotes}”</p>
            </section>
          )}
          {review.recordingRequired && (
            <section aria-label="Your recording">
              <SectionHeading title="Your recording" />
              <div className="mt-3">
                {review.recordingId ? <RecordingPlayer recordingId={review.recordingId} label={`Your week ${review.weekNumber} recording`} /> : <p className="text-sm text-slate-700">No recording was sent for this week.</p>}
              </div>
            </section>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
