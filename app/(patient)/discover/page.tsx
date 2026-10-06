"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { Search, X } from "lucide-react";
import { Button, EmptyState, Input, Notice, PageHeader, PageLoading } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useAuth, useUser } from "@clerk/react";
import DoctorAvatar from "@/components/ui/DoctorAvatar";

const SPECIALTY_FILTERS = [
  "All",
  "Neck Pain",
  "Back Pain",
  "Knee",
  "Shoulder",
  "Sports Injury",
  "Posture",
  "Rehabilitation",
];

interface DiscoverTherapistItem {
  _id?: string;
  clerkUserId: string;
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
  supportedConditions?: string[];
  bio?: string;
  isRecommended?: boolean;
  recommendationReason?: string;
  matchScore?: number;
  isOnline?: boolean;
}

interface DiscoverData {
  concerns: string[];
  therapists: DiscoverTherapistItem[];
}

export default function DiscoverTherapistsPage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const router = useRouter();

  const [data, setData] = useState<DiscoverData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("All");

  useEffect(() => {
    if (user?.publicMetadata?.role === "therapist") {
      router.replace("/therapist");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const token = await getToken();
        const res = await fetch("/api/patient/discover/", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const json = await res.json();
        if (cancelled) return;
        if (json.success) {
          setData(json.data);
          setError(null);
        } else {
          setError(json.error || "We couldn’t load physiotherapists.");
        }
      } catch {
        if (!cancelled) setError("We couldn’t reach Swasthya. Check your connection and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, user, router, attempt]);

  const { concerns = [], therapists = [] } = data || {};

  const filteredTherapists = therapists.filter((doc: DiscoverTherapistItem) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      doc.professionalName?.toLowerCase().includes(q) ||
      doc.specialization?.toLowerCase().includes(q) ||
      doc.clinicName?.toLowerCase().includes(q) ||
      (doc.supportedConditions || []).some((c: string) => c.toLowerCase().includes(q));
    const matchesSpecialty =
      selectedSpecialty === "All" ||
      doc.specialization?.toLowerCase().includes(selectedSpecialty.toLowerCase()) ||
      (doc.supportedConditions || []).some((c: string) => c.toLowerCase().includes(selectedSpecialty.toLowerCase()));
    return matchesSearch && matchesSpecialty;
  });

  return (
    <AppShell title="Find a physiotherapist" showBackNav backHref="/appointments">
      <div className="mx-auto w-full max-w-3xl">
        <PageHeader title="Find a physiotherapist" description="Choose someone who treats what you’re recovering from, then request an appointment from their profile." />

        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <Input
            type="search"
            aria-label="Search physiotherapists"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, condition or clinic"
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button type="button" aria-label="Clear search" onClick={() => setSearchQuery("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-600 hover:bg-slate-100">
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div role="group" aria-label="Filter by specialty" className="mt-3 flex flex-wrap gap-1.5">
          {SPECIALTY_FILTERS.map((spec) => (
            <button
              key={spec}
              type="button"
              aria-pressed={selectedSpecialty === spec}
              onClick={() => setSelectedSpecialty(spec)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-sm font-semibold",
                selectedSpecialty === spec ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-800 hover:border-slate-500"
              )}
            >
              {spec}
            </button>
          ))}
        </div>

        {concerns.length > 0 && selectedSpecialty === "All" && !searchQuery && (
          <p className="mt-4 max-w-prose text-sm text-slate-700">
            Matching your concerns: <span className="font-semibold">{concerns.join(", ")}</span>.{" "}
            <Link href="/profile" className="font-semibold text-emerald-700 underline underline-offset-4">Review your profile</Link>
          </p>
        )}

        <div className="mt-6">
          {loading ? (
            <PageLoading label="Finding physiotherapists" />
          ) : error ? (
            <Notice tone="danger" title="We couldn’t load physiotherapists" action={<Button size="sm" variant="secondary" onClick={() => setAttempt((n) => n + 1)}>Try again</Button>}>
              {error}
            </Notice>
          ) : filteredTherapists.length === 0 ? (
            <EmptyState
              title={therapists.length === 0 ? "No physiotherapists are listed yet" : "No physiotherapist matches that search"}
              action={
                therapists.length > 0 ? (
                  <Button size="sm" variant="outline" onClick={() => { setSearchQuery(""); setSelectedSpecialty("All"); }}>
                    Clear search and filters
                  </Button>
                ) : undefined
              }
            >
              {therapists.length === 0 ? "Check back soon." : "Try a different condition, or clear the filters."}
            </EmptyState>
          ) : (
            <ul>
              <li className="border-t-2 border-slate-900" aria-hidden="true" />
              {filteredTherapists.map((doc: DiscoverTherapistItem) => (
                <li key={doc.clerkUserId} className="border-b border-slate-300 py-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                      <DoctorAvatar src={doc.avatarUrl} name={doc.professionalName} size="md" className="size-14 shrink-0 sm:size-16" />
                      <div className="min-w-0">
                        <h2 className="text-lg font-bold leading-snug text-slate-900">{doc.professionalName}</h2>
                        {doc.specialization && <p className="text-sm font-medium text-slate-800">{doc.specialization}</p>}
                        <p className="text-sm text-slate-600">
                          {[doc.qualification, doc.yearsOfExperience && `${doc.yearsOfExperience} experience`, doc.clinicName].filter(Boolean).join(" · ")}
                        </p>
                        {doc.isRecommended && (
                          <p className="mt-1.5 text-sm text-slate-800">
                            <span className="font-semibold">Suggested for you</span>
                            {doc.recommendationReason ? ` — ${doc.recommendationReason}` : ""}
                          </p>
                        )}
                        {doc.supportedConditions && doc.supportedConditions.length > 0 && (
                          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Conditions treated">
                            {doc.supportedConditions.slice(0, 4).map((cond: string) => {
                              const isMatch = concerns.some((c: string) => c.toLowerCase() === cond.toLowerCase() || cond.toLowerCase().includes(c.toLowerCase()));
                              return (
                                <li key={cond} className={cn("rounded border px-1.5 py-0.5 text-xs font-medium", isMatch ? "border-emerald-600 bg-emerald-50 text-emerald-900" : "border-slate-300 text-slate-700")}>
                                  {isMatch && <span className="sr-only">Matches your concerns: </span>}
                                  {cond}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        {typeof doc.consultationFee === "number" && doc.consultationFee > 0 && (
                          <p className="mt-2 text-sm text-slate-700">Consultation fee <span className="font-mono font-semibold tabular">₹{doc.consultationFee}</span></p>
                        )}
                      </div>
                    </div>
                    <Button asChild className="shrink-0 sm:self-center">
                      <Link href={`/therapist-profile/${doc.clerkUserId}`}>View profile and book</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
