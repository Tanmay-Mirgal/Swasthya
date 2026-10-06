import Link from "next/link";
import { Check, MessageSquare, Video, X } from "lucide-react";
import { Button, EmptyState, SectionHeading, StatusMark } from "@/components/ui";
import PatientAvatar from "./PatientAvatar";
import {
  getPatientStatus,
  patientId,
  patientName,
  relativeDay,
  type TherapistConsultationItem,
  type TherapistPatientItem,
  type TherapistPendingRequestItem,
} from "./types";

interface OverviewTabProps {
  patients: TherapistPatientItem[];
  consultations: TherapistConsultationItem[];
  pendingRequests: TherapistPendingRequestItem[];
  onRequestAction: (requestId: string, action: "accept" | "decline") => Promise<void>;
  busyRequestId: string | null;
  onShowAll: (tab: "patients" | "appointments") => void;
}

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/** Hierarchy: who needs you now → today's work → recent activity. No equal-weight metric tiles. */
export default function OverviewTab({ patients, consultations, pendingRequests, onRequestAction, busyRequestId, onShowAll }: OverviewTabProps) {
  const flagged = patients.map((p) => ({ p, status: getPatientStatus(p) })).filter((x) => x.status.needsAttention || (x.p.activity?.unreadMessages ?? 0) > 0);
  const liveNow = consultations.filter((c) => c.canJoin && c.status !== "COMPLETED");
  const today = startOfToday();
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const todays = consultations.filter((c) => {
    const d = new Date(c.scheduledAt || c.createdAt);
    return d >= today && d < tomorrow && c.status !== "COMPLETED";
  });
  const recent = [...patients]
    .filter((p) => p.activity?.lastSessionAt)
    .sort((a, b) => new Date(b.activity!.lastSessionAt!).getTime() - new Date(a.activity!.lastSessionAt!).getTime())
    .slice(0, 5);
  const needsYou = pendingRequests.length + liveNow.length + flagged.length;

  return (
    <div className="space-y-10">
      <p className="text-base text-slate-700">
        <span className="font-semibold tabular text-slate-900">{patients.length}</span> {patients.length === 1 ? "patient" : "patients"} under your care.
      </p>

      <section aria-label="Needs your attention">
        <SectionHeading title="Needs your attention" description={needsYou === 0 ? undefined : `${needsYou} ${needsYou === 1 ? "item" : "items"}`} />
        {needsYou === 0 ? (
          <p className="mt-3 text-sm text-slate-700">Nothing is waiting for you right now.</p>
        ) : (
          <ul>
            {liveNow.map((c) => (
              <li key={`live-${c._id}`} className="flex flex-col gap-3 border-b border-slate-300 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <PatientAvatar name={c.patientName} src={c.patientImage} />
                  <div>
                    <p className="font-semibold text-slate-900">{c.patientName}</p>
                    <p className="text-sm text-slate-700"><StatusMark kind="attention">Consultation room is open</StatusMark></p>
                  </div>
                </div>
                <Button asChild variant="highlight">
                  <Link href={`/consultation/${c._id}`}><Video className="size-4" aria-hidden="true" /> Enter consultation</Link>
                </Button>
              </li>
            ))}

            {pendingRequests.map((req) => {
              const name = req.user?.fullName || "Patient";
              const when = [req.request.requestedDate && new Date(req.request.requestedDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }), req.request.requestedTime].filter(Boolean).join(" · ");
              const busy = busyRequestId === req.request._id;
              return (
                <li key={req.request._id} className="flex flex-col gap-3 border-b border-slate-300 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <PatientAvatar name={name} src={req.user?.imageUrl} />
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{name} <span className="font-normal text-slate-600">requested an appointment</span></p>
                      <p className="text-sm text-slate-700">{when || "No time chosen"}</p>
                      {req.request.patientNote && <p className="truncate text-sm text-slate-600">“{req.request.patientNote}”</p>}
                      {req.profile?.concerns && req.profile.concerns.length > 0 && <p className="text-sm text-slate-600">Concerns: {req.profile.concerns.join(", ")}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button disabled={busy} onClick={() => onRequestAction(req.request._id, "accept")}><Check className="size-4" aria-hidden="true" /> Accept</Button>
                    <Button disabled={busy} variant="outline" onClick={() => onRequestAction(req.request._id, "decline")}><X className="size-4" aria-hidden="true" /> Decline</Button>
                  </div>
                </li>
              );
            })}

            {flagged.map(({ p, status }) => {
              const id = patientId(p);
              const unread = p.activity?.unreadMessages ?? 0;
              return (
                <li key={`flag-${id}`} className="flex flex-col gap-3 border-b border-slate-300 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <PatientAvatar name={patientName(p)} src={p.user?.imageUrl} />
                    <div>
                      <p className="font-semibold text-slate-900">{patientName(p)}</p>
                      <p className="text-sm text-slate-700">
                        {status.needsAttention && <StatusMark kind="attention">{status.reason}</StatusMark>}
                        {status.needsAttention && unread > 0 && " · "}
                        {unread > 0 && <span className="font-semibold">{unread} unread {unread === 1 ? "message" : "messages"}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {unread > 0 && (
                      <Button asChild variant="secondary"><Link href={`/chat/${id}`}><MessageSquare className="size-4" aria-hidden="true" /> Reply</Link></Button>
                    )}
                    <Button asChild variant="outline"><Link href={`/therapist/patient/${id}`}>Open patient</Link></Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-label="Today">
        <SectionHeading title="Today" action={<button type="button" onClick={() => onShowAll("appointments")} className="font-semibold text-emerald-700 underline underline-offset-4">All appointments</button>} />
        {todays.length === 0 ? (
          <p className="mt-3 text-sm text-slate-700">No consultations scheduled for today.</p>
        ) : (
          <ul>
            {todays.map((c) => {
              const d = new Date(c.scheduledAt || c.createdAt);
              return (
                <li key={c._id} className="flex items-center justify-between gap-3 border-b border-slate-300 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">
                      <time dateTime={d.toISOString()} className="tabular">{c.requestedTime || d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time> · {c.patientName}
                    </p>
                    {c.issue && <p className="truncate text-sm text-slate-600">{c.issue} · {c.duration || 30} minutes</p>}
                  </div>
                  <Button asChild size="sm" variant={c.canJoin ? "primary" : "outline"}>
                    <Link href={`/consultation/${c._id}`}>{c.canJoin ? "Enter" : "Details"}</Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-label="Recent activity">
        <SectionHeading title="Recent activity" action={<button type="button" onClick={() => onShowAll("patients")} className="font-semibold text-emerald-700 underline underline-offset-4">All patients</button>} />
        {recent.length === 0 ? (
          <EmptyState className="mt-3" title="No tracked sessions yet">When your patients finish exercises, their latest sessions appear here.</EmptyState>
        ) : (
          <ul>
            {recent.map((p) => (
              <li key={patientId(p)} className="flex items-center justify-between gap-3 border-b border-slate-300 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <PatientAvatar name={patientName(p)} src={p.user?.imageUrl} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{patientName(p)}</p>
                    <p className="text-sm text-slate-600">Last session {relativeDay(p.activity?.lastSessionAt).replace(/^(Today|Yesterday)/, (m) => m.toLowerCase()).replace(/^(\d+ days ago)/, "$1")} · {p.activity?.sessionsLast7Days ?? 0} in the last 7 days</p>
                  </div>
                </div>
                <Button asChild size="sm" variant="outline"><Link href={`/therapist/patient/${patientId(p)}`}>Review</Link></Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
