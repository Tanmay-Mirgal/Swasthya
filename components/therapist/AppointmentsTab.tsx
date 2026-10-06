"use client";

import Link from "next/link";
import { useState } from "react";
import { ClipboardList, MessageSquare, Video } from "lucide-react";
import { Button, EmptyState, StatusMark, Tabs } from "@/components/ui";
import PatientAvatar from "./PatientAvatar";
import type { TherapistConsultationItem } from "./types";

type Filter = "all" | "today" | "completed";

export default function AppointmentsTab({ consultations }: { consultations: TherapistConsultationItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 86_400_000);
  const todayCount = consultations.filter((c) => {
    const d = new Date(c.scheduledAt || c.createdAt);
    return d >= start && d < end;
  }).length;
  const completedCount = consultations.filter((c) => c.status === "COMPLETED").length;

  const shown = consultations.filter((c) => {
    if (filter === "today") {
      const d = new Date(c.scheduledAt || c.createdAt);
      return d >= start && d < end;
    }
    if (filter === "completed") return c.status === "COMPLETED";
    return true;
  });

  return (
    <div>
      <Tabs
        label="Appointment filter"
        value={filter}
        onChange={(id) => setFilter(id as Filter)}
        items={[
          { id: "all", label: `All (${consultations.length})` },
          { id: "today", label: `Today (${todayCount})` },
          { id: "completed", label: `Completed (${completedCount})` },
        ]}
      />
      <div role="tabpanel" id={`panel-${filter}`} aria-labelledby={`tab-${filter}`}>
        {shown.length === 0 ? (
          <EmptyState className="mt-5" title="No appointments in this view">Appointments you accept from patient requests appear here.</EmptyState>
        ) : (
          <ul>
            {shown.map((c) => {
              const done = c.status === "COMPLETED";
              const d = new Date(c.scheduledAt || c.createdAt);
              return (
                <li key={c._id} className="flex flex-col gap-3 border-b border-slate-300 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <PatientAvatar name={c.patientName} src={c.patientImage} />
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{c.patientName}</p>
                      <p className="text-sm text-slate-700">
                        <time dateTime={d.toISOString()}>{d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {c.requestedTime || d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time> · {c.duration || 30} minutes
                      </p>
                      {c.issue && <p className="truncate text-sm text-slate-600">{c.issue}</p>}
                      <div className="mt-1">
                        {done ? <StatusMark kind="done">Completed</StatusMark> : c.canJoin ? <StatusMark kind="attention">Room open now</StatusMark> : <StatusMark kind="pending">Upcoming</StatusMark>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild variant="outline"><Link href={`/chat/${c.patientId}`}><MessageSquare className="size-4" aria-hidden="true" /> Message</Link></Button>
                    {c.canJoin && !done ? (
                      <Button asChild><Link href={`/consultation/${c._id}`}><Video className="size-4" aria-hidden="true" /> Enter</Link></Button>
                    ) : (
                      <Button asChild variant="outline"><Link href={`/consultation/${c._id}`}>{done ? <><ClipboardList className="size-4" aria-hidden="true" /> Summary</> : "Details"}</Link></Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
