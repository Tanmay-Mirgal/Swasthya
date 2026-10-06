"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { Calendar, MessageSquare } from "lucide-react";
import { Button, Dialog, EmptyState, Field, Input, Notice, PageLoading, SectionHeading, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useAuth } from "@clerk/react";
import DoctorAvatar from "@/components/ui/DoctorAvatar";

const SUGGESTED_TIME_SLOTS = [
  { label: "09:30 AM", value: "09:30" },
  { label: "11:00 AM", value: "11:00" },
  { label: "02:00 PM", value: "14:00" },
  { label: "03:30 PM", value: "15:30" },
  { label: "04:30 PM", value: "16:30" },
  { label: "06:00 PM", value: "18:00" },
];

function format24to12(timeStr: string): string {
  if (!timeStr) return "";
  if (timeStr.includes("AM") || timeStr.includes("PM")) return timeStr;
  const parts = timeStr.split(":");
  if (parts.length < 2) return timeStr;
  let h = parseInt(parts[0], 10);
  const m = parts[1];
  if (isNaN(h)) return timeStr;
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  const hStr = h < 10 ? `0${h}` : `${h}`;
  return `${hStr}:${m} ${ampm}`;
}

interface TherapistPublicProfile {
  _id?: string;
  clerkUserId?: string;
  professionalName: string;
  title?: string;
  specialization?: string;
  qualification?: string;
  clinicName?: string;
  avatarUrl?: string;
  rating?: number;
  reviewCount?: number;
  yearsOfExperience?: string;
  consultationFee?: number;
  bio?: string;
  supportedConditions?: string[];
  languages?: string[];
}

export default function TherapistProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const therapistId = resolvedParams.id;
  const router = useRouter();
  const { getToken } = useAuth();

  const [therapist, setTherapist] = useState<TherapistPublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });
  const [selectedTime, setSelectedTime] = useState<string>("16:30");
  const [patientNote, setPatientNote] = useState<string>("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`/api/therapist/public-profile/${therapistId}/`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const json = await res.json();
        if (cancelled) return;
        if (json.success && json.data) setTherapist(json.data);
        else setError(json.error || "We couldn’t find this physiotherapist.");
      } catch {
        if (!cancelled) setError("We couldn’t load this profile. Check your connection and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [therapistId, getToken]);

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingLoading(true);
    setBookingError(null);

    try {
      const token = await getToken();
      if (!token) {
        setBookingError("Please sign in to request an appointment.");
        setBookingLoading(false);
        return;
      }

      let scheduledAtISO: string | undefined;
      try {
        const [y, m, d] = selectedDate.split("-").map(Number);
        const [hours, minutes] = selectedTime.includes(":") ? selectedTime.split(":").map((n) => parseInt(n, 10)) : [16, 30];
        scheduledAtISO = new Date(y, m - 1, d, hours, minutes, 0).toISOString();
      } catch {
        /* the server falls back to the requested date and time */
      }

      const res = await fetch("/api/patient/appointment-request", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          therapistId,
          requestedDate: selectedDate,
          requestedTime: format24to12(selectedTime),
          scheduledAt: scheduledAtISO,
          patientNote: patientNote.trim() || therapist?.specialization || "Rehabilitation consultation",
        }),
      });

      const json = await res.json();
      if (json.success) {
        setBookingSuccess(true);
        setTimeout(() => {
          setShowBookingModal(false);
          router.push("/appointments");
        }, 1800);
      } else {
        setBookingError(json.error || "We couldn’t send your request. Please try again.");
      }
    } catch {
      setBookingError("We couldn’t reach Swasthya. Check your connection and try again.");
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) {
    return (
      <AppShell title="Physiotherapist" showBackNav backHref="/discover">
        <PageLoading label="Loading profile" />
      </AppShell>
    );
  }

  if (error || !therapist) {
    return (
      <AppShell title="Physiotherapist" showBackNav backHref="/discover">
        <div className="mx-auto w-full max-w-xl pt-4">
          <EmptyState title={error || "Physiotherapist not found"} action={<Button asChild size="sm"><Link href="/discover">Browse physiotherapists</Link></Button>} />
        </div>
      </AppShell>
    );
  }

  const conditions = therapist.supportedConditions ?? [];
  const details: { label: string; value: string }[] = [
    ...(therapist.consultationFee ? [{ label: "Consultation fee", value: `₹${therapist.consultationFee}` }] : []),
    { label: "Length", value: "30 minutes" },
    { label: "Format", value: "Video consultation" },
    ...(therapist.languages && therapist.languages.length ? [{ label: "Languages", value: therapist.languages.join(", ") }] : []),
  ];

  return (
    <AppShell title={therapist.professionalName} showBackNav backHref="/discover">
      <div className="mx-auto w-full max-w-2xl pb-24 md:pb-4">
        <header className="flex items-start gap-4 sm:gap-5">
          <DoctorAvatar src={therapist.avatarUrl} name={therapist.professionalName} size="lg" className="size-20 shrink-0 sm:size-24" />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-slate-900 sm:text-3xl">{therapist.professionalName}</h1>
            {(therapist.title || therapist.specialization) && (
              <p className="mt-1 text-base text-slate-800">{[therapist.title, therapist.specialization].filter(Boolean).join(" · ")}</p>
            )}
            <p className="mt-0.5 text-sm text-slate-600">
              {[therapist.qualification, therapist.yearsOfExperience && `${therapist.yearsOfExperience} experience`, therapist.clinicName].filter(Boolean).join(" · ")}
            </p>
            {therapist.rating ? (
              <p className="mt-1 text-sm text-slate-700">
                Rated <span className="font-mono font-semibold tabular">{therapist.rating}</span> out of 5
                {therapist.reviewCount ? <> from <span className="font-mono tabular">{therapist.reviewCount}</span> reviews</> : null}
              </p>
            ) : null}
          </div>
        </header>

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-t-2 border-slate-900 pt-4 sm:grid-cols-4">
          {details.map((d) => (
            <div key={d.label}>
              <dt className="text-sm text-slate-600">{d.label}</dt>
              <dd className="font-semibold text-slate-900">{d.value}</dd>
            </div>
          ))}
        </dl>

        {conditions.length > 0 && (
          <section aria-label="Conditions treated" className="mt-8">
            <SectionHeading title="Conditions treated" />
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {conditions.map((cond) => (
                <li key={cond} className="rounded border border-slate-300 px-2 py-0.5 text-sm font-medium">{cond}</li>
              ))}
            </ul>
          </section>
        )}

        {therapist.bio && (
          <section aria-label="About" className="mt-8">
            <SectionHeading title="About" />
            <p className="mt-3 max-w-prose text-base leading-relaxed text-slate-800">{therapist.bio}</p>
          </section>
        )}

        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-900 bg-[var(--paper)] md:static md:mt-10 md:border-0 md:bg-transparent"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3 md:px-0 md:py-0">
            <Button size="lg" className="flex-1 md:flex-none" onClick={() => setShowBookingModal(true)}>
              <Calendar className="size-4" aria-hidden="true" /> Request appointment
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={`/chat/${therapist.clerkUserId}`}>
                <MessageSquare className="size-4" aria-hidden="true" /> Message
              </Link>
            </Button>
          </div>
        </div>

        <Dialog
          open={showBookingModal}
          onClose={() => !bookingLoading && setShowBookingModal(false)}
          title="Request an appointment"
          description={`With ${therapist.professionalName}. They will confirm or suggest another time.`}
        >
          {bookingSuccess ? (
            <Notice tone="success" title="Request sent">
              {therapist.professionalName} will review it. You’ll find it under Appointments.
            </Notice>
          ) : (
            <form onSubmit={handleBookAppointment} className="space-y-4">
              {bookingError && <Notice tone="danger" title={bookingError} />}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Preferred date" htmlFor="appt-date">
                  <Input id="appt-date" type="date" min={new Date().toISOString().split("T")[0]} value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} required />
                </Field>
                <Field label="Preferred time" htmlFor="appt-time">
                  <Input id="appt-time" type="time" value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)} required />
                </Field>
              </div>

              <div role="group" aria-label="Common times" className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                {SUGGESTED_TIME_SLOTS.map((slot) => (
                  <button
                    key={slot.value}
                    type="button"
                    aria-pressed={selectedTime === slot.value}
                    onClick={() => setSelectedTime(slot.value)}
                    className={cn(
                      "rounded-md border px-1 py-1.5 text-xs font-semibold",
                      selectedTime === slot.value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-800 hover:border-slate-500"
                    )}
                  >
                    {slot.label}
                  </button>
                ))}
              </div>

              <Field label="What would you like help with?" htmlFor="appt-note" hint="Optional. For example neck stiffness after work.">
                <Textarea id="appt-note" rows={3} value={patientNote} onChange={(e) => setPatientNote(e.target.value)} />
              </Field>

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={() => setShowBookingModal(false)} disabled={bookingLoading}>Cancel</Button>
                <Button type="submit" disabled={bookingLoading}>{bookingLoading ? "Sending…" : "Send request"}</Button>
              </div>
            </form>
          )}
        </Dialog>
      </div>
    </AppShell>
  );
}
