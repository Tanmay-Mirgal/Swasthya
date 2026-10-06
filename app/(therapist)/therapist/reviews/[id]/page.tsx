/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/react";
import AppShell from "@/components/layout/AppShell";
import { Button, Field, Notice, PageHeader, PageLoading, SectionHeading, StatusMark, Textarea, useToast } from "@/components/ui";
import ReportView from "@/components/review/ReportView";
import RecordingPlayer from "@/components/review/RecordingPlayer";
import type { ReviewDetail } from "@/components/review/types";
import { formatDateKey } from "@/lib/rehab/dates";

export default function TherapistReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { getToken } = useAuth();
  const toast = useToast();
  const [review, setReview] = useState<ReviewDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<"save" | "review" | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`/api/weekly-reviews/${id}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "load");
      setReview(json.data);
      setNotes(json.data.therapistNotes ?? "");
      setError(null);
    } catch (e) {
      setError(e instanceof Error && e.message !== "load" ? e.message : "We couldn’t load this review. Check your connection and try again.");
    }
  }, [getToken, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(markReviewed: boolean) {
    setBusy(markReviewed ? "review" : "save");
    try {
      const token = await getToken();
      const res = await fetch(`/api/weekly-reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ notes, markReviewed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "save");
      toast(markReviewed ? "Marked as reviewed. The patient has your note." : "Note saved.", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error && e.message !== "save" ? e.message : "We couldn’t save that. Please try again.", "danger");
    } finally {
      setBusy(null);
    }
  }

  const back = "/therapist?tab=reviews";
  if (error) {
    return (
      <AppShell title="Weekly review" showBackNav backHref={back}>
        <Notice tone="danger" title="We couldn’t open this review" action={<Button size="sm" variant="secondary" onClick={() => void load()}>Try again</Button>}>{error}</Notice>
      </AppShell>
    );
  }
  if (!review) {
    return (
      <AppShell title="Weekly review" showBackNav backHref={back}>
        <PageLoading label="Loading the review" />
      </AppShell>
    );
  }

  const reviewed = review.status === "reviewed";
  return (
    <AppShell title={`${review.patientName}, week ${review.weekNumber}`} showBackNav backHref={back} maxWidth="wide">
      <PageHeader
        title={`${review.patientName}: week ${review.weekNumber}`}
        description={`Review day ${formatDateKey(review.dueDate, { weekday: "long", day: "numeric", month: "long" })}${review.prescription ? ` · plan version ${review.prescription.version}` : ""}`}
        actions={reviewed ? <StatusMark kind="done">Reviewed</StatusMark> : review.status === "report_ready" ? <StatusMark kind="attention">Ready for you</StatusMark> : <StatusMark kind="pending">Waiting for the patient</StatusMark>}
      />

      <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="min-w-0 space-y-10">
          {review.report ? (
            <ReportView report={review.report} />
          ) : (
            <Notice tone="info" title="The report isn’t ready yet">It is built the morning after the review day, from the sets your patient completes. You can still read their other sessions from their page.</Notice>
          )}
        </div>

        <aside className="min-w-0 space-y-8 lg:sticky lg:top-6 lg:self-start" aria-label="Recording and your review">
          <section aria-label="Recording">
            <SectionHeading title="Recording" />
            <div className="mt-3">
              {!review.recordingRequired ? (
                <p className="text-sm text-slate-700">You didn’t ask for a recording this week.</p>
              ) : review.recordingId ? (
                <RecordingPlayer recordingId={review.recordingId} label={`${review.patientName}, week ${review.weekNumber} recording`} />
              ) : (
                <Notice tone={review.status === "recording_due" ? "info" : "warning"} title={review.status === "recording_due" ? "Waiting for the recording" : "No recording was made"}>
                  {review.status === "recording_due" ? "It is due today. You will see it here as soon as the patient sends it." : "The patient didn’t send one this week. Their sets and measurements are still in the report."}
                </Notice>
              )}
            </div>
          </section>

          <section aria-label="Your review">
            <SectionHeading title="Your review" description="The patient sees your note with their report." />
            <div className="mt-3 space-y-3">
              <Field label="Note to the patient" htmlFor="review-notes">
                <Textarea id="review-notes" rows={5} maxLength={4000} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={reviewed} />
              </Field>
              {notes.trim() && <p className="hand">“{notes.trim()}”</p>}
              <div className="flex flex-wrap gap-2">
                {!reviewed && <Button variant="outline" onClick={() => void save(false)} disabled={busy !== null}>{busy === "save" ? "Saving…" : "Save note"}</Button>}
                {!reviewed && <Button onClick={() => void save(true)} disabled={busy !== null || !review.report}>{busy === "review" ? "Saving…" : "Mark as reviewed"}</Button>}
              </div>
              {reviewed && review.reviewedAt && <p className="text-sm text-slate-600">Reviewed {new Date(review.reviewedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}.</p>}
            </div>
          </section>

          <section aria-label="Next steps">
            <SectionHeading title="Change the plan" />
            <p className="mt-2 text-sm text-slate-700">If this week shows the plan needs to change, make a new version. The current one stays in their history.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild variant="secondary"><Link href={`/therapist/patient/${review.patientId}/prescribe`}>Revise the plan</Link></Button>
              <Button asChild variant="ghost"><Link href={`/therapist/patient/${review.patientId}`}>Open patient</Link></Button>
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
