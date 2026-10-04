/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect } from "react";
import { useUser, useAuth } from "@clerk/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  UserCircle,
  Briefcase,
  Loader2,
  CheckCircle2,
  Plus,
  X,
  Sparkles,
  Stethoscope,
  Building2,
  Award,
  Clock,
  ShieldCheck,
} from "lucide-react";
import AppShell from "@/components/navigation/AppShell";

const THERAPIST_SPECIALIZATION_OPTIONS = [
  // Spine & Posture
  { name: "Neck Pain", category: "Spine" },
  { name: "Back Pain", category: "Spine" },
  { name: "Posture Problems", category: "Spine" },
  { name: "Sciatica Recovery", category: "Spine" },
  { name: "Cervical Spondylosis", category: "Spine" },
  { name: "Lumbar Rehabilitation", category: "Spine" },

  // Joints & Extremities
  { name: "Knee Pain", category: "Joints" },
  { name: "Knee Rehabilitation", category: "Joints" },
  { name: "Shoulder Pain", category: "Joints" },
  { name: "Rotator Cuff Rehab", category: "Joints" },
  { name: "Arm / Elbow", category: "Joints" },
  { name: "Hip & Pelvic Recovery", category: "Joints" },
  { name: "Ankle & Foot Biomechanics", category: "Joints" },

  // Sports & Rehabilitation
  { name: "Sports Injury", category: "Sports" },
  { name: "Athletic Conditioning", category: "Sports" },
  { name: "Mobility Issues", category: "Rehab" },
  { name: "General Physiotherapy", category: "Rehab" },
  { name: "Post-Surgical Rehab", category: "Rehab" },
  { name: "Rehabilitation", category: "Rehab" },
  { name: "Geriatric Physiotherapy", category: "Rehab" },
  { name: "Neurological Rehabilitation", category: "Specialized" },
  { name: "Dry Needling & Myofascial", category: "Specialized" },
];

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

  // Patient Form states
  const [concerns, setConcerns] = useState<string[]>([]);

  // Therapist Form states
  const [professionalName, setProfessionalName] = useState("");
  const [selectedSpecializations, setSelectedSpecializations] = useState<string[]>([
    "Neck Pain",
    "Back Pain",
  ]);
  const [customTagInput, setCustomTagInput] = useState("");
  const [qualification, setQualification] = useState("MPT, BPT Certified");
  const [clinicName, setClinicName] = useState("Swasthya Partner Clinic");
  const [yearsOfExperience, setYearsOfExperience] = useState("8+ years");
  const [activeFilter, setActiveFilter] = useState<string>("All");

  useEffect(() => {
    if (userLoaded && user) {
      if (!professionalName) {
        const name = user.fullName || user.firstName || "";
        if (name) {
          setProfessionalName(
            name.toLowerCase().startsWith("dr") ? name : `Dr. ${name}`
          );
        }
      }

      const publicMetadata = user.publicMetadata;
      if (publicMetadata.onboardingCompleted) {
        router.push(
          publicMetadata.role === "therapist" ? "/therapist" : "/"
        );
      } else if (publicMetadata.role) {
        setStep(publicMetadata.role as "patient" | "therapist");
        setSelectedRole(publicMetadata?.role as "patient" | "therapist");
      }
    }
  }, [userLoaded, user, router, professionalName]);

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

  // Toggle multi-select specialization chip
  const toggleSpecialization = (item: string) => {
    setSelectedSpecializations((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  // Add custom specialization or technique
  const handleAddCustomTag = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customTagInput.trim();
    if (trimmed && !selectedSpecializations.includes(trimmed)) {
      setSelectedSpecializations((prev) => [...prev, trimmed]);
      setCustomTagInput("");
    }
  };

  const submitTherapist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSpecializations.length === 0) {
      setError("Please select at least one clinical specialization or condition.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const token = await getToken();
      const primarySpec = selectedSpecializations.slice(0, 3).join(", ");

      const res = await fetch("/api/onboarding/therapist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          professionalName,
          specialization: primarySpec,
          specializations: selectedSpecializations,
          supportedConditions: selectedSpecializations,
          qualification,
          clinicName,
          yearsOfExperience,
        }),
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

  const categories = ["All", "Spine", "Joints", "Sports", "Rehab", "Specialized"];
  const filteredOptions =
    activeFilter === "All"
      ? THERAPIST_SPECIALIZATION_OPTIONS
      : THERAPIST_SPECIALIZATION_OPTIONS.filter((o) => o.category === activeFilter);

  return (
    <AppShell hideNav title="Setup">
      <div className="flex flex-col max-w-lg mx-auto w-full px-4 py-8 space-y-6">
        
        {/* ── STEP 1: ROLE SELECTION ────────────────────────────────────── */}
        {step === "role" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                How will you use Swasthya?
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
                    ? "border-emerald-600 bg-emerald-50/50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-emerald-300"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`p-3 rounded-full ${
                      selectedRole === "patient"
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <UserCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3
                      className={`font-semibold ${
                        selectedRole === "patient" ? "text-emerald-950" : "text-slate-900"
                      }`}
                    >
                      Patient
                    </h3>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Track your exercises, consultations and rehabilitation progress.
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setSelectedRole("therapist")}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                  selectedRole === "therapist"
                    ? "border-emerald-600 bg-emerald-50/50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-emerald-300"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`p-3 rounded-full ${
                      selectedRole === "therapist"
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <div>
                    <h3
                      className={`font-semibold ${
                        selectedRole === "therapist" ? "text-emerald-950" : "text-slate-900"
                      }`}
                    >
                      Doctor / Physiotherapist
                    </h3>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Conduct video consultations, write prescriptions and guide patients.
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {error && (
              <p className="text-red-500 text-sm text-center">{error}</p>
            )}

            <Button
              className="w-full h-12 text-base font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
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

        {/* ── STEP 2: PATIENT ONBOARDING ────────────────────────────────── */}
        {step === "patient" && (
          <form
            onSubmit={submitPatient}
            className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Your Rehabilitation Focus
              </h1>
              <p className="text-slate-500 text-sm">
                Select your primary physical & recovery goals.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-700">
                  Select your primary health & recovery areas
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    "Knee Pain",
                    "Back Pain",
                    "Neck Pain",
                    "Shoulder Pain",
                    "Posture Problems",
                    "Mobility Issues",
                    "Sports Injury",
                    "General Physiotherapy",
                    "Arm / Elbow",
                    "Rehabilitation",
                  ].map((area) => (
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
                      className={`p-3 rounded-xl border text-xs sm:text-sm font-medium transition-all cursor-pointer text-left flex items-center justify-between ${
                        concerns.includes(area)
                          ? "border-emerald-600 bg-emerald-50 text-emerald-800 shadow-2xs font-semibold ring-1 ring-emerald-500/30"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50/50"
                      }`}
                    >
                      <span>{area}</span>
                      {concerns.includes(area) && (
                        <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0 ml-1" />
                      )}
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
              className="w-full h-12 text-base font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
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

        {/* ── STEP 3: THERAPIST ONBOARDING (Multi-Select Specializations) ── */}
        {step === "therapist" && (
          <form
            onSubmit={submitTherapist}
            className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            {/* Header */}
            <div className="text-center space-y-1.5">
              <div className="size-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center mx-auto mb-2 shadow-2xs">
                <Stethoscope className="size-6" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Doctor Practice Profile
              </h1>
              <p className="text-slate-500 text-xs sm:text-sm">
                Set up your clinical credentials and multi-discipline specialties.
              </p>
            </div>

            <div className="space-y-5">
              {/* Professional Name */}
              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-semibold text-slate-800 flex items-center justify-between">
                  <span>Professional Name</span>
                  <span className="text-[11px] text-emerald-700 font-normal flex items-center gap-1">
                    <ShieldCheck className="size-3 text-emerald-600" />
                    Doctor Title
                  </span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Ashlesh Kadam"
                  value={professionalName}
                  onChange={(e) => setProfessionalName(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-medium text-slate-900 shadow-2xs"
                />
              </div>

              {/* ── MULTI-SELECT SPECIALIZATIONS ────────────────────── */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <div>
                    <label className="text-xs sm:text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                      <Sparkles className="size-3.5 text-emerald-600" />
                      <span>Clinical Specializations & Conditions</span>
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Tap multiple specialties to match patients with corresponding issues.
                    </p>
                  </div>

                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                    {selectedSpecializations.length} Selected
                  </span>
                </div>

                {/* Category Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveFilter(cat)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all shrink-0 cursor-pointer ${
                        activeFilter === cat
                          ? "bg-slate-900 text-white font-bold shadow-2xs"
                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Grid of Specialization Options */}
                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-1 border border-slate-200/80 rounded-2xl bg-slate-50/50">
                  {filteredOptions.map((item) => {
                    const isSelected = selectedSpecializations.includes(item.name);
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => toggleSpecialization(item.name)}
                        className={`p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer text-left flex items-center justify-between shadow-2xs ${
                          isSelected
                            ? "border-emerald-500 bg-emerald-50 text-emerald-950 font-bold ring-1 ring-emerald-500/30"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <span className="truncate pr-1">{item.name}</span>
                        {isSelected ? (
                          <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <Plus className="size-3 text-slate-400 shrink-0 opacity-50" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Add Custom Tag Bar */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Add custom specialization (e.g. Dry Needling, Vestibular)..."
                    value={customTagInput}
                    onChange={(e) => setCustomTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCustomTag(e);
                      }
                    }}
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-800"
                  />
                  <Button
                    type="button"
                    onClick={handleAddCustomTag}
                    disabled={!customTagInput.trim()}
                    variant="outline"
                    className="h-8.5 px-3 rounded-xl text-xs font-semibold border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <Plus className="size-3.5 mr-1" />
                    Add
                  </Button>
                </div>

                {/* Active Selected Tags Preview */}
                {selectedSpecializations.length > 0 && (
                  <div className="bg-white border border-emerald-100 rounded-2xl p-2.5 space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                      <span>Active Doctor Specializations:</span>
                      <button
                        type="button"
                        onClick={() => setSelectedSpecializations([])}
                        className="text-emerald-700 hover:text-emerald-900 font-bold cursor-pointer"
                      >
                        Clear all
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedSpecializations.map((spec) => (
                        <span
                          key={spec}
                          className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] font-semibold px-2 py-0.5 rounded-lg flex items-center gap-1 group shadow-2xs"
                        >
                          <span>{spec}</span>
                          <button
                            type="button"
                            onClick={() => toggleSpecialization(spec)}
                            className="text-emerald-700 hover:text-red-600 transition-colors p-0.5 rounded-full cursor-pointer"
                          >
                            <X className="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Clinical Credentials & Center Details */}
              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                    <Award className="size-3 text-emerald-600" />
                    <span>Qualification</span>
                  </label>
                  <input
                    type="text"
                    value={qualification}
                    onChange={(e) => setQualification(e.target.value)}
                    placeholder="e.g. MPT, BPT Certified"
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:border-emerald-500 shadow-2xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                    <Clock className="size-3 text-emerald-600" />
                    <span>Experience</span>
                  </label>
                  <input
                    type="text"
                    value={yearsOfExperience}
                    onChange={(e) => setYearsOfExperience(e.target.value)}
                    placeholder="e.g. 10+ years"
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:border-emerald-500 shadow-2xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                  <Building2 className="size-3 text-emerald-600" />
                  <span>Clinic / Hospital Affiliate</span>
                </label>
                <input
                  type="text"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  placeholder="e.g. Swasthya Partner Center"
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:border-emerald-500 shadow-2xs"
                />
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-xs sm:text-sm text-center font-medium bg-red-50 border border-red-200 p-2.5 rounded-xl">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-sm sm:text-base font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs cursor-pointer active:scale-[0.99] transition-transform"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Saving Practice Profile...</span>
                </div>
              ) : (
                "Complete Setup & Open Portal"
              )}
            </Button>
          </form>
        )}
      </div>
    </AppShell>
  );
}
