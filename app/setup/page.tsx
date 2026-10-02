/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect } from "react";
import { useUser, useAuth } from "@clerk/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  UserCircle,
  Briefcase, Loader2
} from "lucide-react";
import AppShell from "@/components/navigation/AppShell";

export default function SetupPage() {
  const { user, isLoaded: userLoaded } = useUser();
  const { getToken } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<"role" | "patient" | "therapist">("role");
  const [selectedRole, setSelectedRole] = useState<
    "patient" | "therapist" | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Form states
  const [concerns, setConcerns] = useState<string[]>([]);
  const [professionalName, setProfessionalName] = useState("");
  const [specialization, setSpecialization] = useState("");

  useEffect(() => {
    if (userLoaded && user) {
      const publicMetadata = user.publicMetadata;
      if (publicMetadata.onboardingCompleted) {
        router.push(
          publicMetadata.role === "therapist" ? "/therapist" : "/",
        );
      } else if (publicMetadata.role) {
        setStep(publicMetadata.role as "patient" | "therapist");
        setSelectedRole(publicMetadata?.role as "patient" | "therapist");
      }
    }
  }, [userLoaded, user, router]);

  if (!userLoaded) {
    return (
      <AppShell hideNav>
        <div className="flex h-full items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      </AppShell>
    );
  }

  const handleRoleSelection = async () => {
    if (!selectedRole) return;
    setIsSubmitting(true);
    setError("");

    try {
      const token = await getToken();
      const res = await fetch("/api/onboarding/role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: selectedRole }),
      });

      if (!res.ok) throw new Error("Failed to set role");

      setStep(selectedRole);
    } catch (err) {
      setError("An error occurred while saving your role.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const token = await getToken();
      const res = await fetch("/api/onboarding/patient", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ concerns }),
      });

      if (!res.ok) throw new Error("Failed to save profile");
      await user?.reload();
      router.push("/"); // Patient dashboard is at /
    } catch (err) {
      setError("An error occurred while saving your profile." + err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitTherapist = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const token = await getToken();
      const res = await fetch("/api/onboarding/therapist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ professionalName, specialization }),
      });

      if (!res.ok) throw new Error("Failed to save profile");
      await user?.reload();
      router.push("/therapist");
    } catch (err) {
      setError("An error occurred while saving your profile.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell hideNav title="Setup">
      <div className="flex flex-col max-w-md mx-auto w-full px-4 py-8 space-y-6">
        {step === "role" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                How will you use RehabLens?
              </h1>
              <p className="text-slate-500 text-sm">
                Choose the experience that fits you.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => setSelectedRole("patient")}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                  selectedRole === "patient"
                    ? "border-blue-600 bg-blue-50/50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-blue-300"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`p-3 rounded-full ${selectedRole === "patient" ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"}`}
                  >
                    <UserCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3
                      className={`font-semibold ${selectedRole === "patient" ? "text-blue-900" : "text-slate-900"}`}
                    >
                      Patient
                    </h3>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Track your exercises, sessions and rehabilitation
                      progress.
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setSelectedRole("therapist")}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                  selectedRole === "therapist"
                    ? "border-blue-600 bg-blue-50/50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-blue-300"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`p-3 rounded-full ${selectedRole === "therapist" ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"}`}
                  >
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <div>
                    <h3
                      className={`font-semibold ${selectedRole === "therapist" ? "text-blue-900" : "text-slate-900"}`}
                    >
                      Therapist
                    </h3>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Guide patients, review sessions and monitor progress.
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {error && (
              <p className="text-red-500 text-sm text-center">{error}</p>
            )}

            <Button
              className="w-full h-12 text-base font-semibold"
              disabled={!selectedRole || isSubmitting}
              onClick={handleRoleSelection}
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Continue"
              )}
            </Button>
          </div>
        )}

        {step === "patient" && (
          <form
            onSubmit={submitPatient}
            className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Your Rehabilitation
              </h1>
              <p className="text-slate-500 text-sm">
                Tell us what you&apos;re working on.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-700">
                  What areas do you need help with?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {["Neck", "Shoulder", "Arm / Elbow", "Back", "Hip", "Knee", "Ankle"].map((area) => (
                    <button
                      key={area}
                      type="button"
                      onClick={() => {
                        setConcerns((prev) =>
                          prev.includes(area)
                            ? prev.filter((a) => a !== area)
                            : [...prev, area]
                        );
                      }}
                      className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                        concerns.includes(area)
                          ? "border-blue-600 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {area}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-sm text-center">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Complete Setup"
              )}
            </Button>
          </form>
        )}

        {step === "therapist" && (
          <form
            onSubmit={submitTherapist}
            className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Professional Profile
              </h1>
              <p className="text-slate-500 text-sm">
                Set up your practice information.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Professional Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Sarah Smith, PT"
                  value={professionalName}
                  onChange={(e) => setProfessionalName(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Specialization
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Orthopedics, Sports Medicine"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-sm text-center">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Complete Setup"
              )}
            </Button>
          </form>
        )}
      </div>
    </AppShell>
  );
}
