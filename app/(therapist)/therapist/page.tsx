/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/react";
import AppShell from "@/components/layout/AppShell";
import { Button, Notice, PageHeader, PageLoading } from "@/components/ui";
import OverviewTab from "@/components/therapist/OverviewTab";
import PatientsTable from "@/components/therapist/PatientsTable";
import AppointmentsTab from "@/components/therapist/AppointmentsTab";
import ReviewsTab from "@/components/review/ReviewsTab";
import type { ReviewListItem } from "@/components/review/types";
import PracticeProfileForm from "@/components/therapist/PracticeProfileForm";
import type {
  TherapistConsultationItem,
  TherapistPatientItem,
  TherapistPendingRequestItem,
  TherapistProfileData,
} from "@/components/therapist/types";

type TabId = "overview" | "patients" | "reviews" | "appointments" | "profile";
const TABS: Record<TabId, { title: string; description: string }> = {
  overview: { title: "Overview", description: "Who needs you, today’s work, and recent activity." },
  patients: { title: "Patients", description: "Everyone under your care, with their latest activity." },
  reviews: { title: "Weekly reviews", description: "Each patient’s week from the sets they completed, with their recording when you asked for one." },
  appointments: { title: "Appointments", description: "Consultations you’ve accepted and their status." },
  profile: { title: "Practice profile", description: "What patients see when they look for a physiotherapist." },
};

export default function TherapistPortalPage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const searchParams = useSearchParams();
  const router = useRouter();

  const tabParam = searchParams.get("tab");
  const tab: TabId = tabParam === "patients" || tabParam === "reviews" || tabParam === "appointments" || tabParam === "profile" ? tabParam : "overview";

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [patients, setPatients] = useState<TherapistPatientItem[]>([]);
  const [consultations, setConsultations] = useState<TherapistConsultationItem[]>([]);
  const [pendingRequests, setPendingRequests] = useState<TherapistPendingRequestItem[]>([]);
  const [profile, setProfile] = useState<TherapistProfileData | null>(null);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<ReviewListItem[]>([]);
  const [reviewsError, setReviewsError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch("/api/therapist/dashboard", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const json = await res.json();
      if (json.success) {
        setPatients(json.data.patients || []);
        setConsultations(json.data.consultations || []);
        setPendingRequests(json.data.pendingRequests || []);
        if (json.data.profile) setProfile(json.data.profile);
        setError(null);
        // Reviews load alongside; a failure here shows only on the reviews tab.
        try {
          const r = await fetch("/api/therapist/weekly-reviews", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
          const rj = await r.json();
          if (rj.success) {
            setReviews(rj.data);
            setReviewsError(null);
          } else setReviewsError(rj.error || "We couldn’t load weekly reviews.");
        } catch {
          setReviewsError("We couldn’t load weekly reviews.");
        }
      } else {
        setError(json.error || "We couldn’t load your practice.");
      }
    } catch {
      setError("We couldn’t reach Swasthya. Check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRequestAction = async (requestId: string, action: "accept" | "decline") => {
    setBusyRequestId(requestId);
    setActionError(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/therapist/requests/${requestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("request failed");
      await load();
    } catch {
      setActionError(`We couldn’t ${action} that request. Please try again.`);
    } finally {
      setBusyRequestId(null);
    }
  };

  const handleSaveProfile = async (values: Record<string, unknown>) => {
    try {
      const token = await getToken();
      const res = await fetch("/api/therapist/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...values, specialization: (values.specialization as string) || "Orthopedic Physical Therapy" }),
      });
      const json = await res.json();
      if (json.success) {
        void load();
        return { ok: true };
      }
      return { ok: false, error: json.error as string | undefined };
    } catch {
      return { ok: false, error: "We couldn’t reach Swasthya. Check your connection and try again." };
    }
  };

  const goTo = (next: "patients" | "appointments") => router.replace(`/therapist?tab=${next}`);

  return (
    <AppShell title={TABS[tab].title} maxWidth="wide">
      <PageHeader title={TABS[tab].title} description={TABS[tab].description} />
      {isLoading ? (
        <PageLoading label="Loading your practice" />
      ) : error ? (
        <Notice tone="danger" title="We couldn’t load your practice" action={<Button size="sm" variant="secondary" onClick={() => { setIsLoading(true); void load(); }}>Try again</Button>}>
          {error}
        </Notice>
      ) : (
        <>
          {actionError && <Notice className="mb-5" tone="danger" title={actionError} />}
          {tab === "overview" && (
            <OverviewTab patients={patients} consultations={consultations} pendingRequests={pendingRequests} onRequestAction={handleRequestAction} busyRequestId={busyRequestId} onShowAll={goTo} />
          )}
          {tab === "patients" && <PatientsTable patients={patients} />}
          {tab === "reviews" && (reviewsError ? <Notice tone="danger" title={reviewsError} /> : <ReviewsTab reviews={reviews} />)}
          {tab === "appointments" && <AppointmentsTab consultations={consultations} />}
          {tab === "profile" && <PracticeProfileForm key={profile?.professionalName ?? "new"} initial={profile} fallbackName={user?.fullName || undefined} onSave={handleSaveProfile} />}
        </>
      )}
    </AppShell>
  );
}
