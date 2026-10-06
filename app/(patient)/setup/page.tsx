/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect } from "react";
import { useUser, useAuth } from "@clerk/react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button, Field, Input, Notice, TickBox } from "@/components/ui";
import AppShell from "@/components/layout/AppShell";
import { cn } from "@/lib/utils";

const PATIENT_AREAS = [
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
];

/** Toggle that behaves like a checkbox: a box with a tick plus the label, so state never relies on colour. */
function Choice({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      onClick={onToggle}
      className={cn(
        "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm font-medium",
        selected ? "border-emerald-600 bg-emerald-50 text-[var(--ink)]" : "border-slate-300 bg-white text-slate-800 hover:border-slate-500"
      )}
    >
      <TickBox state={selected ? "done" : "todo"} size={20} />
      <span>{label}</span>
    </button>
  );
}

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
  const [selectedRole, setSelectedRole] = useState<"patient" | "therapist" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [concerns, setConcerns] = useState<string[]>([]);

  // Therapist profile: nothing is pre-filled, so credentials are only ever what the therapist types.
  const [professionalName, setProfessionalName] = useState("");
  const [selectedSpecializations, setSelectedSpecializations] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState("");
  const [qualification, setQualification] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [yearsOfExperience, setYearsOfExperience] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("All");

  useEffect(() => {
    if (userLoaded && user) {
      if (!professionalName) {
        const name = user.fullName || user.firstName || "";
        if (name) setProfessionalName(name);
      }
      const publicMetadata = user.publicMetadata;
      if (publicMetadata.onboardingCompleted) {
        router.push(publicMetadata.role === "therapist" ? "/therapist" : "/");
      } else if (publicMetadata.role) {
        setStep(publicMetadata.role as "patient" | "therapist");
        setSelectedRole(publicMetadata?.role as "patient" | "therapist");
      }
    }
  }, [userLoaded, user, router, professionalName]);

  if (!userLoaded) {
    return (
      <AppShell hideNav title="Setup">
        <p role="status" className="py-16 text-center text-sm text-slate-600">Loading your account…</p>
      </AppShell>
    );
  }

  const authedPost = async (url: string, body: unknown) => {
    const token = await getToken();
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  };

  const handleRoleSelection = async () => {
    if (!selectedRole) return;
    setIsSubmitting(true);
    setError("");
    try {
      const res = await authedPost("/api/onboarding/role", { role: selectedRole });
      if (!res.ok) throw new Error("role");
      setStep(selectedRole);
    } catch {
      setError("We couldn’t save your choice. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      const res = await authedPost("/api/onboarding/patient", { concerns });
      if (!res.ok) throw new Error("profile");
      await user?.reload();
      router.push("/");
    } catch {
      setError("We couldn’t save your profile. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSpecialization = (item: string) =>
    setSelectedSpecializations((prev) => (prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]));

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
      setError("Choose at least one specialisation so patients can find you.");
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      const res = await authedPost("/api/onboarding/therapist", {
        professionalName,
        specialization: selectedSpecializations.slice(0, 3).join(", "),
        specializations: selectedSpecializations,
        supportedConditions: selectedSpecializations,
        qualification,
        clinicName,
        yearsOfExperience,
      });
      if (!res.ok) throw new Error("profile");
      await user?.reload();
      router.push("/therapist");
    } catch {
      setError("We couldn’t save your practice profile. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = ["All", "Spine", "Joints", "Sports", "Rehab", "Specialized"];
  const filteredOptions =
    activeFilter === "All" ? THERAPIST_SPECIALIZATION_OPTIONS : THERAPIST_SPECIALIZATION_OPTIONS.filter((o) => o.category === activeFilter);

  return (
    <AppShell hideNav title="Set up your account" maxWidth="default">
      <div className="mx-auto w-full max-w-xl py-4">
        {step === "role" && (
          <div className="space-y-6">
            <header>
              <h1 className="text-3xl font-bold tracking-tight">How will you use Swasthya?</h1>
              <p className="mt-1.5 text-base text-slate-700">Choose the one that fits you.</p>
            </header>

            <div role="radiogroup" aria-label="Your role" className="divide-y divide-slate-300 border-y-2 border-slate-900">
              {(
                [
                  { id: "patient", title: "Patient", body: "Do your prescribed exercises with camera feedback, track your progress and talk to your physiotherapist." },
                  { id: "therapist", title: "Doctor / Physiotherapist", body: "Prescribe exercises, review your patients’ sessions, message them and hold video consultations." },
                ] as const
              ).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  role="radio"
                  aria-checked={selectedRole === r.id}
                  onClick={() => setSelectedRole(r.id)}
                  className={cn("flex w-full items-start gap-4 px-2 py-5 text-left hover:bg-slate-50", selectedRole === r.id && "bg-emerald-50")}
                >
                  <TickBox state={selectedRole === r.id ? "done" : "todo"} size={24} className="mt-0.5" />
                  <span>
                    <span className="block text-lg font-bold">{r.title}</span>
                    <span className="mt-0.5 block max-w-prose text-sm leading-relaxed text-slate-700">{r.body}</span>
                  </span>
                </button>
              ))}
            </div>

            {error && <Notice tone="danger" title={error} />}
            <Button size="lg" className="w-full" disabled={!selectedRole || isSubmitting} onClick={handleRoleSelection}>
              {isSubmitting ? "Saving…" : "Continue"}
            </Button>
          </div>
        )}

        {step === "patient" && (
          <form onSubmit={submitPatient} className="space-y-6">
            <header>
              <h1 className="text-3xl font-bold tracking-tight">What are you recovering from?</h1>
              <p className="mt-1.5 text-base text-slate-700">Choose any that apply. We use this to suggest exercises; your physiotherapist can change the plan.</p>
            </header>

            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Areas of concern</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {PATIENT_AREAS.map((area) => (
                  <Choice
                    key={area}
                    label={area}
                    selected={concerns.includes(area)}
                    onToggle={() => setConcerns((prev) => (prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]))}
                  />
                ))}
              </div>
            </fieldset>

            {error && <Notice tone="danger" title={error} />}
            <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Finish setup"}
            </Button>
          </form>
        )}

        {step === "therapist" && (
          <form onSubmit={submitTherapist} className="space-y-6">
            <header>
              <h1 className="text-3xl font-bold tracking-tight">Your practice profile</h1>
              <p className="mt-1.5 text-base text-slate-700">Patients see this when they look for a physiotherapist. Enter only details that are true.</p>
            </header>

            <Field label="Professional name" htmlFor="pro-name" hint="As patients should see it, including any title, for example Dr. Priya Nair.">
              <Input id="pro-name" required value={professionalName} onChange={(e) => setProfessionalName(e.target.value)} autoComplete="name" />
            </Field>

            <fieldset>
              <legend className="text-sm font-semibold">Specialisations and conditions</legend>
              <p className="mt-0.5 text-sm text-slate-600">
                Choose the areas you treat. <span className="font-semibold tabular text-slate-900">{selectedSpecializations.length}</span> selected.
              </p>

              <div role="group" aria-label="Filter by area" className="mt-3 flex flex-wrap gap-1.5">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    aria-pressed={activeFilter === cat}
                    onClick={() => setActiveFilter(cat)}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-sm font-semibold",
                      activeFilter === cat ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-800 hover:border-slate-500"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
                {filteredOptions.map((item) => (
                  <Choice key={item.name} label={item.name} selected={selectedSpecializations.includes(item.name)} onToggle={() => toggleSpecialization(item.name)} />
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                <Input
                  aria-label="Add another specialisation"
                  placeholder="Add another, for example Vestibular rehab"
                  value={customTagInput}
                  onChange={(e) => setCustomTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddCustomTag(e);
                  }}
                />
                <Button type="button" variant="outline" onClick={handleAddCustomTag} disabled={!customTagInput.trim()}>
                  <Plus className="size-4" aria-hidden="true" /> Add
                </Button>
              </div>

              {selectedSpecializations.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Selected specialisations">
                  {selectedSpecializations.map((spec) => (
                    <li key={spec} className="flex items-center gap-1 rounded-md border border-slate-300 bg-white py-0.5 pl-2 pr-0.5 text-sm font-medium">
                      {spec}
                      <button type="button" onClick={() => toggleSpecialization(spec)} aria-label={`Remove ${spec}`} className="rounded p-1.5 text-slate-600 hover:bg-slate-100">
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Qualification" htmlFor="qual" hint="For example MPT, BPT.">
                <Input id="qual" value={qualification} onChange={(e) => setQualification(e.target.value)} />
              </Field>
              <Field label="Experience" htmlFor="exp" hint="For example 6 years.">
                <Input id="exp" value={yearsOfExperience} onChange={(e) => setYearsOfExperience(e.target.value)} />
              </Field>
            </div>
            <Field label="Clinic or hospital" htmlFor="clinic">
              <Input id="clinic" value={clinicName} onChange={(e) => setClinicName(e.target.value)} />
            </Field>

            {error && <Notice tone="danger" title={error} />}
            <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save and open my practice"}
            </Button>
          </form>
        )}
      </div>
    </AppShell>
  );
}
