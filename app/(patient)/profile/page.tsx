/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useUser, useClerk, useAuth } from "@clerk/react";
import AppShell from "@/components/layout/AppShell";
import { Button, EmptyState, PageHeader, SectionHeading, Switch, useToast } from "@/components/ui";
import { getAggregateStats } from "@/lib/session/sessionStore";
import { getVoiceCoachPreference, setVoiceCoachPreference } from "@/lib/preferences";

interface ProfileDashboardData {
  profile?: { concerns?: string[] };
  therapist?: { professionalName: string; clerkUserId: string; specialization?: string };
  stats?: { totalSessions: number; totalReps: number; avgRom: number };
}

interface MedicationRecord {
  prescriptionId: string;
  prescribedBy?: string;
  prescribedAt: string;
  status: string;
  medicines: { name: string; dosage?: string; frequency?: string; duration?: string; instructions?: string }[];
}

export default function ProfilePage() {
  const router = useRouter();
  const { user } = useUser();
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const toast = useToast();
  const [emailReminders, setEmailReminders] = useState<boolean | null>(null);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [medications, setMedications] = useState<MedicationRecord[] | null>(null);

  const [voice, setVoice] = useState(true);
  const [data, setData] = useState<ProfileDashboardData | null>(null);
  const [stats, setStats] = useState({ totalSessions: 0, totalReps: 0, avgRom: 0 });

  useEffect(() => {
    if (user?.publicMetadata?.role === "therapist") {
      router.replace("/therapist?tab=profile");
      return;
    }
    setVoice(getVoiceCoachPreference());
    setStats(getAggregateStats());
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const headers = { Authorization: `Bearer ${token}` };
        const [notif, meds] = await Promise.all([
          fetch("/api/patient/notifications", { headers }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch("/api/patient/medications", { headers }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        ]);
        if (!cancelled && notif?.success) {
          setEmailReminders(notif.data.emailReminders);
          setTimezone(notif.data.timezone);
        }
        if (!cancelled && meds?.success) setMedications(meds.data);
        const res = await fetch("/api/patient/dashboard", { headers });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && json.success && json.data) {
          setData(json.data);
          if (json.data.stats && json.data.stats.totalSessions > 0) setStats(json.data.stats);
        }
      } catch {
        /* the page still shows what is stored on this device */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, router, getToken]);

  const concerns = data?.profile?.concerns ?? [];
  const therapist = data?.therapist;

  return (
    <AppShell title="Profile" maxWidth="default">
      <div className="mx-auto w-full max-w-2xl">
        <PageHeader title="Profile" />

        <div className="flex items-center gap-4 border-t-2 border-slate-900 pt-4">
          {user?.imageUrl ? (
            <Image src={user.imageUrl} alt="" width={64} height={64} unoptimized className="size-16 rounded-full border border-slate-300 object-cover" />
          ) : (
            <div aria-hidden="true" className="size-16 rounded-full border border-slate-300 bg-slate-100" />
          )}
          <div className="min-w-0">
            <p className="truncate text-xl font-bold text-slate-900">{user?.fullName || user?.firstName || "Your account"}</p>
            <p className="truncate text-sm text-slate-600">{user?.primaryEmailAddress?.emailAddress}</p>
          </div>
        </div>

        <section aria-label="Your totals" className="mt-8">
          <SectionHeading title="Your totals" description="From your saved sessions." />
          <dl className="mt-3 grid grid-cols-3 gap-4">
            <div>
              <dt className="text-sm text-slate-600">Sessions</dt>
              <dd className="font-mono text-2xl font-semibold tabular">{stats.totalSessions}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-600">Reps</dt>
              <dd className="font-mono text-2xl font-semibold tabular">{stats.totalReps}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-600">Average range</dt>
              <dd className="font-mono text-2xl font-semibold tabular">{stats.totalSessions > 0 ? `${stats.avgRom}°` : "—"}</dd>
            </div>
          </dl>
        </section>

        <section aria-label="Recovery focus" className="mt-8">
          <SectionHeading title="What you’re recovering from" />
          {concerns.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">You haven’t chosen any areas yet.</p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {concerns.map((c) => (
                <li key={c} className="rounded border border-slate-300 px-2 py-0.5 text-sm font-medium">{c}</li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Your physiotherapist" className="mt-8">
          <SectionHeading title="Your physiotherapist" />
          {therapist ? (
            <div className="mt-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">{therapist.professionalName}</p>
                {therapist.specialization && <p className="text-sm text-slate-600">{therapist.specialization}</p>}
              </div>
              <Button asChild variant="outline" size="sm"><Link href={`/therapist-profile/${therapist.clerkUserId}`}>View profile</Link></Button>
            </div>
          ) : (
            <EmptyState className="mt-3" title="No physiotherapist yet" action={<Button asChild size="sm"><Link href="/discover">Find a physiotherapist</Link></Button>}>
              Connect with one to get a prescribed exercise sheet.
            </EmptyState>
          )}
        </section>

        <section aria-label="Preferences" className="mt-8">
          <SectionHeading title="Preferences" />
          <div className="mt-4">
            <Switch
              id="voice-coach"
              label="Voice coach"
              description="Speaks each form tip during an exercise. Saved on this device."
              checked={voice}
              onChange={(next) => {
                setVoice(next);
                setVoiceCoachPreference(next);
              }}
            />
          </div>
          {emailReminders !== null && (
            <div className="mt-5">
              <Switch
                id="email-reminders"
                label="Email reminders"
                description={`A daily reminder when exercises are due and a note on weekly review days. Changes to your plan are always emailed.${timezone ? ` Your day starts in ${timezone.replace(/_/g, " ")}.` : ""}`}
                checked={emailReminders}
                onChange={async (next) => {
                  setEmailReminders(next);
                  try {
                    const token = await getToken();
                    const res = await fetch("/api/patient/notifications", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ emailReminders: next }) });
                    if (!res.ok) throw new Error("save");
                  } catch {
                    setEmailReminders(!next);
                    toast("We couldn’t save that. Please try again.", "danger");
                  }
                }}
              />
            </div>
          )}
        </section>

        <section aria-label="Medication" id="medications" className="mt-8 scroll-mt-20">
          <SectionHeading title="Medication from your therapist" description="Exactly as your therapist recorded it. Swasthya never suggests or changes medication." />
          {medications === null ? null : medications.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">Your therapist hasn’t recorded any medication for you.</p>
          ) : (
            <div className="mt-3 space-y-5">
              {medications.map((rec) => (
                <div key={rec.prescriptionId}>
                  <p className="text-sm text-slate-600">
                    {rec.prescribedBy ? `${rec.prescribedBy}, ` : ""}
                    {new Date(rec.prescribedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                    {rec.status === "completed" || rec.status === "cancelled" ? " · earlier plan" : ""}
                  </p>
                  <ul className="mt-1 border-t border-slate-900">
                    {rec.medicines.map((m, i) => (
                      <li key={i} className="border-b border-slate-300 py-2.5 text-sm">
                        <p className="font-semibold text-slate-900">{m.name}</p>
                        <p className="text-slate-700">{[m.dosage, m.frequency, m.duration].filter(Boolean).join(" · ")}</p>
                        {m.instructions && <p className="text-slate-600">{m.instructions}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="text-xs text-slate-600">Ask your therapist or pharmacist if you are unsure about anything here.</p>
            </div>
          )}
        </section>

        <section aria-label="Privacy" className="mt-8">
          <SectionHeading title="Privacy" />
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-slate-700">
            Your camera video is analysed on this device and is not uploaded. The only exception is a short clip you choose to record when your therapist asks for one at a weekly review; only you and your therapist can watch it, and you can delete it before it is reviewed. Swasthya saves the results of each session, such as reps and range of motion, to your account.
          </p>
        </section>

        <div className="mt-10 border-t border-slate-300 pt-6">
          <Button
            variant="outline"
            onClick={async () => {
              await signOut();
              router.push("/");
            }}
          >
            <LogOut className="size-4" aria-hidden="true" /> Sign out
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
