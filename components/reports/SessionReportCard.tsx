"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { Bot, Loader2 } from "lucide-react";
import { Button, Notice } from "@/components/ui";
import type { ReportContent } from "@/lib/movement/analytics/sessionReport";

export interface ReportView {
  sessionId: string;
  source: "ai" | "deterministic";
  generatedAt: string;
  content: ReportContent;
  disclosure: string;
}

type State = { kind: "loading" } | { kind: "ready"; report: ReportView } | { kind: "error"; message: string };

/**
 * The performance summary of one exercise-day. It is built on the server from the stored
 * session only, labelled for what it is (an automatic or AI-written summary, never a
 * diagnosis), and sits apart from anything the therapist wrote.
 */
export default function SessionReportCard({ sessionId, audience }: { sessionId: string; audience: "patient" | "therapist" }) {
  const { getToken } = useAuth();
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const token = await getToken();
      const res = await fetch("/api/reports/session", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ sessionId }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "load");
      setState({ kind: "ready", report: json.data as ReportView });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error && e.message !== "load" ? e.message : "We couldn’t prepare this summary." });
    }
  }, [getToken, sessionId]);

  useEffect(() => {
    // Loading starts when the card appears.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (state.kind === "loading") {
    return (
      <div role="status" className="flex items-center gap-2 py-3 text-sm text-slate-700">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Preparing your session summary…
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <Notice tone="warning" title="Summary not available" action={<Button size="sm" variant="secondary" onClick={() => void load()}>Try again</Button>}>
        {state.message} Your reps and measurements are saved.
      </Notice>
    );
  }

  return <ReportBody report={state.report} audience={audience} />;
}

export function ReportBody({ report, audience }: { report: ReportView; audience: "patient" | "therapist" }) {
  const c = report.content;
  const list = (items: string[]) => (
    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-800">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );

  return (
    <article aria-label="Session summary" className="space-y-4">
      <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
        <Bot className="size-3.5" aria-hidden="true" /> {report.disclosure}
      </p>
      <p className="max-w-prose text-base font-semibold leading-snug text-slate-900">{c.summary}</p>
      {c.wentWell.length > 0 && (
        <section>
          <h4 className="text-sm font-bold text-slate-900">What went well</h4>
          {list(c.wentWell)}
        </section>
      )}
      {c.toImprove.length > 0 && (
        <section>
          <h4 className="text-sm font-bold text-slate-900">To work on</h4>
          {list(c.toImprove)}
        </section>
      )}
      {(c.mostCommonError || c.acrossSets || c.correctionSuccess) && (
        <dl className="divide-y divide-slate-200 border-y border-slate-200 text-sm">
          {c.mostCommonError && (
            <div className="py-2">
              <dt className="font-semibold text-slate-900">Most common flag</dt>
              <dd className="text-slate-800">{c.mostCommonError}</dd>
            </div>
          )}
          {c.acrossSets && (
            <div className="py-2">
              <dt className="font-semibold text-slate-900">Across the sets</dt>
              <dd className="text-slate-800">{c.acrossSets}</dd>
            </div>
          )}
          {c.correctionSuccess && (
            <div className="py-2">
              <dt className="font-semibold text-slate-900">Suggestions that worked</dt>
              <dd className="text-slate-800">{c.correctionSuccess}</dd>
            </div>
          )}
        </dl>
      )}
      <section>
        <h4 className="text-sm font-bold text-slate-900">Suggested focus next session</h4>
        <p className="mt-1 text-sm text-slate-800">{c.nextFocus}</p>
      </section>
      {audience === "therapist" && c.therapistSummary && (
        <section className="border-t border-slate-300 pt-3">
          <h4 className="text-sm font-bold text-slate-900">For the therapist</h4>
          <p className="mt-1 max-w-prose text-sm text-slate-800">{c.therapistSummary}</p>
          <p className="mt-1 text-xs text-slate-600">Reviewing the movement and deciding what it means is your role. This summary only restates measured data.</p>
        </section>
      )}
    </article>
  );
}


/** A "Session summary" disclosure that only asks the server for the report once it is opened. */
export function SessionReportDisclosure({ sessionId, audience }: { sessionId: string; audience: "patient" | "therapist" }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="mt-1.5" onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer text-sm font-semibold text-emerald-700 underline underline-offset-4">Session summary</summary>
      <div className="mt-2">{open && <SessionReportCard sessionId={sessionId} audience={audience} />}</div>
    </details>
  );
}
