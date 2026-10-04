"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import {
  ArrowLeft,
  Loader2,
  Star,
  ShieldCheck,
  Clock,
  CheckCircle2,
  MessageSquare,
  Calendar,
  Languages,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@clerk/react";
import DoctorAvatar from "@/components/ui/DoctorAvatar";

const TIME_SLOTS = [
  "09:30 AM",
  "11:00 AM",
  "02:00 PM",
  "03:30 PM",
  "04:30 PM",
  "06:00 PM",
];

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

  // Booking Modal State
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });
  const [selectedTime, setSelectedTime] = useState<string>("04:30 PM");
  const [patientNote, setPatientNote] = useState<string>("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTherapist = async () => {
      try {
        const token = await getToken();
        const res = await fetch(`/api/therapist/public-profile/${therapistId}/`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await res.json();
        if (json.success && json.data) {
          setTherapist(json.data);
        } else {
          setError(json.error || "Practitioner profile not found.");
        }
      } catch (err) {
        console.error("Error fetching therapist:", err);
        setError("Unable to load practitioner profile.");
      } finally {
        setLoading(false);
      }
    };
    fetchTherapist();
  }, [therapistId, getToken]);

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingLoading(true);
    setBookingError(null);

    try {
      const token = await getToken();
      if (!token) {
        setBookingError("Please sign in to book an appointment.");
        setBookingLoading(false);
        return;
      }

      const res = await fetch("/api/patient/appointment-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          therapistId,
          requestedDate: selectedDate,
          requestedTime: selectedTime,
          patientNote: patientNote.trim() || therapist?.specialization || "Rehabilitation Consultation",
        }),
      });

      const json = await res.json();
      if (json.success) {
        setBookingSuccess(true);
        setTimeout(() => {
          setShowBookingModal(false);
          router.push("/appointments");
        }, 1500);
      } else {
        setBookingError(json.error || "Failed to schedule appointment request.");
      }
    } catch {
      setBookingError("Network error. Please try again.");
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) {
    return (
      <AppShell hideHeader>
        <div className="flex flex-col items-center justify-center h-[50vh] space-y-3">
          <Loader2 className="size-8 animate-spin text-slate-400" />
          <p className="text-xs text-slate-400">Loading specialist profile...</p>
        </div>
      </AppShell>
    );
  }

  if (error || !therapist) {
    return (
      <AppShell hideHeader>
        <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-2xl border border-slate-200 text-center space-y-4">
          <AlertCircle className="size-8 text-slate-400 mx-auto" />
          <h2 className="text-base font-semibold text-slate-900">{error || "Specialist not found"}</h2>
          <Button asChild className="bg-slate-900 text-white rounded-xl">
            <Link href="/discover">Browse Specialists</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell hideHeader>
      <div className="max-w-2xl mx-auto w-full space-y-6 pb-28 pt-2 px-3 sm:px-0">
        
        {/* Back Link */}
        <div>
          <Button asChild variant="ghost" className="text-xs text-slate-500 hover:text-slate-900 p-0 h-auto">
            <Link href="/discover" className="flex items-center gap-1.5">
              <ArrowLeft className="size-4" />
              <span>Back to Specialists</span>
            </Link>
          </Button>
        </div>

        {/* ── 1. DOCTOR IDENTITY CARD ──────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-7 shadow-[0_1px_3px_rgba(15,23,42,0.03)] space-y-5">
          <div className="flex items-start gap-4 sm:gap-5">
            <DoctorAvatar
              src={therapist.avatarUrl}
              name={therapist.professionalName}
              size="lg"
              isOnline={false}
              className="size-18 sm:size-20 rounded-2xl shrink-0"
            />

            <div className="min-w-0 space-y-1 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 leading-tight">
                  {therapist.professionalName}
                </h1>
                <ShieldCheck className="size-4 text-slate-400 shrink-0" />
                <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                  Verified Specialist
                </span>
              </div>

              <p className="text-xs sm:text-sm font-medium text-slate-700">
                {therapist.title || "Clinical Physiotherapist"}
              </p>

              <p className="text-xs text-slate-500">
                {therapist.specialization || "Orthopedic Rehabilitation"}
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-600">
                <div className="flex items-center gap-1 font-semibold text-slate-900">
                  <Star className="size-3.5 fill-amber-400 text-amber-400" />
                  <span>{therapist.rating || 4.9}</span>
                  <span className="text-slate-400 font-normal">({therapist.reviewCount || 86})</span>
                </div>
                <span className="text-slate-300">•</span>
                <span className="text-slate-500">{therapist.yearsOfExperience || "8+ years"} exp</span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-500">{therapist.clinicName || "Swasthya Partner Center"}</span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Line */}
          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-100 text-center">
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-[11px] text-slate-400 block font-medium">Session Fee</span>
              <span className="text-sm font-bold text-slate-900">₹{therapist.consultationFee || 499}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-[11px] text-slate-400 block font-medium">Duration</span>
              <span className="text-sm font-bold text-slate-900">30 mins</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-[11px] text-slate-400 block font-medium">Format</span>
              <span className="text-sm font-bold text-slate-900">Video & Guidance</span>
            </div>
          </div>
        </div>

        {/* ── 2. SPECIALTIES & CONDITIONS TREATED ──────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 space-y-3 shadow-xs">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Specialties & Conditions
          </h2>
          <div className="flex flex-wrap gap-2">
            {(therapist.supportedConditions || [
              "Neck Pain",
              "Back Pain",
              "Cervical Spondylosis",
              "Knee Rehabilitation",
              "Post-Op Recovery",
              "Posture Correction",
            ]).map((cond: string) => (
              <span
                key={cond}
                className="bg-slate-50 text-slate-700 text-xs px-3 py-1.5 rounded-lg border border-slate-200/70 font-medium flex items-center gap-1.5"
              >
                <CheckCircle2 className="size-3 text-slate-400 shrink-0" />
                <span>{cond}</span>
              </span>
            ))}
          </div>
        </div>

        {/* ── 3. CLINICAL BIO & BACKGROUND ────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 space-y-3 shadow-xs">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            About the Practitioner
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {therapist.bio ||
              `${therapist.professionalName} is an experienced physical therapist specializing in orthopedic rehabilitation, functional kinematic recovery, and posture correction. Sessions focus on clinical diagnosis, exercise form coaching, and progression tracking.`}
          </p>

          <div className="pt-2 flex flex-wrap gap-4 text-xs text-slate-500 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              <Languages className="size-3.5 text-slate-400" />
              <span>Languages: {therapist.languages?.join(", ") || "English, Hindi"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="size-3.5 text-slate-400" />
              <span>Response: Within clinical hours</span>
            </div>
          </div>
        </div>

        {/* ── 4. STICKY ACTION DOCK ────────────────────────────────────── */}
        <div
          className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-[0_-4px_16px_rgba(15,23,42,0.04)]"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 10px)" }}
        >
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-base font-bold text-slate-900">
                  ₹{therapist.consultationFee || 499}
                </span>
                <span className="text-[11px] text-slate-400">/ consultation</span>
              </div>
              <p className="text-[11px] text-slate-500">Scheduled video appointment</p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                asChild
                variant="outline"
                className="h-10 px-3.5 text-xs font-semibold rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                <Link href={`/chat/${therapist.clerkUserId}`} className="flex items-center gap-1.5">
                  <MessageSquare className="size-4 text-slate-500" />
                  <span>Message</span>
                </Link>
              </Button>

              <Button
                onClick={() => setShowBookingModal(true)}
                className="h-10 px-5 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
              >
                <Calendar className="size-3.5 mr-1.5" />
                <span>Book Appointment</span>
              </Button>
            </div>
          </div>
        </div>

        {/* ── 5. BOOK APPOINTMENT MODAL ───────────────────────────────── */}
        {showBookingModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-5 text-slate-900 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Schedule Consultation
                  </h3>
                  <p className="text-xs text-slate-500">
                    With {therapist.professionalName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
                  className="text-xs text-slate-400 hover:text-slate-700"
                >
                  ✕
                </button>
              </div>

              {bookingSuccess ? (
                <div className="p-6 bg-slate-50 rounded-xl text-center space-y-2">
                  <CheckCircle2 className="size-8 text-emerald-600 mx-auto" />
                  <p className="text-sm font-semibold text-slate-900">
                    Appointment Request Submitted
                  </p>
                  <p className="text-xs text-slate-500">
                    Your request was sent to {therapist.professionalName}. You will receive a confirmation once reviewed.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleBookAppointment} className="space-y-4">
                  {bookingError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                      {bookingError}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Preferred Date
                    </label>
                    <input
                      type="date"
                      min={new Date().toISOString().split("T")[0]}
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      required
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Available Consultation Slot
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {TIME_SLOTS.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setSelectedTime(slot)}
                          className={`py-2 px-2 text-xs rounded-lg border text-center transition-colors ${
                            selectedTime === slot
                              ? "bg-slate-900 text-white border-slate-900 font-semibold"
                              : "border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Primary Recovery Focus / Clinical Note
                    </label>
                    <textarea
                      rows={3}
                      value={patientNote}
                      onChange={(e) => setPatientNote(e.target.value)}
                      placeholder="e.g. Neck stiffness after work, knee pain following surgery..."
                      className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowBookingModal(false)}
                      disabled={bookingLoading}
                      className="flex-1 rounded-xl"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={bookingLoading}
                      className="flex-1 bg-slate-900 hover:bg-slate-800 text-white rounded-xl"
                    >
                      {bookingLoading ? (
                        <Loader2 className="size-4 animate-spin mx-auto" />
                      ) : (
                        "Request Appointment"
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}
