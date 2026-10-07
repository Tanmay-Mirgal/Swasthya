"use client";

import { useState } from "react";
import { Check, Circle, Plus, X } from "lucide-react";
import { Button, Field, Input, Notice, Textarea, TickBox } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { TherapistProfileData } from "./types";

const SPECIALIZATION_SUGGESTIONS = [
  "Neck Pain", "Back Pain", "Posture Problems", "Sciatica Recovery", "Cervical Spine", "Knee Pain", "Knee Rehabilitation",
  "Shoulder Pain", "Rotator Cuff Rehab", "Arm / Elbow", "Hip & Pelvis", "Ankle & Foot Biomechanics", "Sports Injury",
  "Mobility Issues", "General Physiotherapy", "Post-Surgical Rehab", "Rehabilitation", "Geriatric Care", "Neurological Rehabilitation", "Dry Needling",
];

interface Props {
  initial: TherapistProfileData | null;
  fallbackName?: string;
  onSave: (values: {
    professionalName: string;
    title: string;
    qualification: string;
    clinicName: string;
    consultationFee?: number;
    yearsOfExperience: string;
    bio: string;
    specialization: string;
    supportedConditions: string[];
  }) => Promise<{ ok: boolean; error?: string }>;
}

/** What patients see on your profile. Nothing is pre-filled with example credentials. */
export default function PracticeProfileForm({ initial, fallbackName, onSave }: Props) {
  const [name, setName] = useState(initial?.professionalName || fallbackName || "");
  const [title, setTitle] = useState(initial?.title || "");
  const [qual, setQual] = useState(initial?.qualification || "");
  const [clinic, setClinic] = useState(initial?.clinicName || "");
  const [fee, setFee] = useState(initial?.consultationFee ? String(initial.consultationFee) : "");
  const [exp, setExp] = useState(initial?.yearsOfExperience || "");
  const [bio, setBio] = useState(initial?.bio || "");
  const [conditions, setConditions] = useState<string[]>(initial?.supportedConditions || []);
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  const toggle = (c: string) => setConditions((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  const addCustom = () => {
    const t = custom.trim();
    if (t && !conditions.includes(t)) setConditions((prev) => [...prev, t]);
    setCustom("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const res = await onSave({
      professionalName: name,
      title,
      qualification: qual,
      clinicName: clinic,
      consultationFee: fee ? Number(fee) : undefined,
      yearsOfExperience: exp,
      bio,
      specialization: conditions.slice(0, 3).join(", "),
      supportedConditions: conditions,
    });
    setSaving(false);
    setMessage(res.ok ? { tone: "success", text: "Your practice profile is saved." } : { tone: "danger", text: res.error || "We couldn’t save your profile. Try again." });
  };

  const all = Array.from(new Set([...SPECIALIZATION_SUGGESTIONS, ...conditions]));

  const checks = [
    { label: "Name and title", done: !!name.trim() && !!title.trim() },
    { label: "Qualification", done: !!qual.trim() },
    { label: "Clinic or hospital", done: !!clinic.trim() },
    { label: "Experience", done: !!exp.trim() },
    { label: "At least 3 specialisations", done: conditions.length >= 3 },
    { label: "A short bio", done: bio.trim().length >= 40 },
  ];
  const doneCount = checks.filter((c) => c.done).length;
  const initials = name.replace(/^dr\.?\s+/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

  return (
    <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,42rem)_minmax(20rem,26rem)] xl:gap-12">
    <form onSubmit={submit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Professional name" htmlFor="pp-name"><Input id="pp-name" required value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Title" htmlFor="pp-title" hint="For example Senior Orthopaedic Physiotherapist."><Input id="pp-title" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Qualification" htmlFor="pp-qual"><Input id="pp-qual" value={qual} onChange={(e) => setQual(e.target.value)} /></Field>
        <Field label="Clinic or hospital" htmlFor="pp-clinic"><Input id="pp-clinic" value={clinic} onChange={(e) => setClinic(e.target.value)} /></Field>
        <Field label="Experience" htmlFor="pp-exp" hint="For example 6 years."><Input id="pp-exp" value={exp} onChange={(e) => setExp(e.target.value)} /></Field>
        <Field label="Consultation fee (₹)" htmlFor="pp-fee" hint="Leave empty if you don’t want to show a fee."><Input id="pp-fee" type="number" min={0} inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value)} /></Field>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold">Specialisations and conditions</legend>
        <p className="mt-0.5 text-sm text-slate-600">Patients are matched to you using these. <span className="font-semibold tabular text-slate-900">{conditions.length}</span> selected.</p>
        <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
          {all.map((item) => {
            const on = conditions.includes(item);
            return (
              <button key={item} type="button" role="checkbox" aria-checked={on} onClick={() => toggle(item)}
                className={cn("flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm font-medium", on ? "border-emerald-600 bg-emerald-50" : "border-slate-300 bg-white hover:border-slate-500")}>
                <TickBox state={on ? "done" : "todo"} size={18} /> {item}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex gap-2">
          <Input aria-label="Add another specialisation" placeholder="Add another" value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} />
          <Button type="button" variant="outline" onClick={addCustom} disabled={!custom.trim()}><Plus className="size-4" aria-hidden="true" /> Add</Button>
        </div>
        {conditions.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Selected">
            {conditions.map((c) => (
              <li key={c} className="flex items-center gap-1 rounded-md border border-slate-300 bg-white py-0.5 pl-2 pr-0.5 text-sm font-medium">
                {c}
                <button type="button" onClick={() => toggle(c)} aria-label={`Remove ${c}`} className="rounded p-1.5 text-slate-600 hover:bg-slate-100"><X className="size-3.5" /></button>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <Field label="About you" htmlFor="pp-bio" hint="Your background and how you work with patients."><Textarea id="pp-bio" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} /></Field>

      {message && <Notice tone={message.tone} title={message.text} />}
      <Button type="submit" size="lg" disabled={saving}>{saving ? "Saving…" : "Save practice profile"}</Button>
    </form>

    <aside aria-label="Profile preview" className="space-y-5 xl:sticky xl:top-8">
      <section className="rounded-xl border border-slate-300 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">How patients see you</p>
        <div className="mt-4 flex items-start gap-3">
          <div aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-base font-bold text-emerald-900">{initials}</div>
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-slate-900">{name || "Your name"}</p>
            <p className="text-sm text-slate-700">{title || "Your title"}</p>
            {qual && <p className="mt-0.5 text-sm text-slate-600">{qual}</p>}
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-4 text-sm">
          <div className="col-span-2"><dt className="text-xs text-slate-600">Clinic</dt><dd className="font-medium">{clinic || "—"}</dd></div>
          <div><dt className="text-xs text-slate-600">Experience</dt><dd className="font-medium">{exp || "—"}</dd></div>
          <div><dt className="text-xs text-slate-600">Consultation</dt><dd className="font-medium tabular">{fee ? `₹${fee}` : "Not shown"}</dd></div>
        </dl>
        {conditions.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Specialisations">
            {conditions.slice(0, 6).map((c) => <li key={c} className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-900">{c}</li>)}
            {conditions.length > 6 && <li className="px-1 py-0.5 text-xs text-slate-600">+{conditions.length - 6} more</li>}
          </ul>
        )}
        {bio.trim() && <p className="mt-4 line-clamp-4 border-t border-slate-200 pt-4 text-sm leading-relaxed text-slate-700">{bio}</p>}
      </section>

      <section className="rounded-xl border border-slate-300 bg-white p-5">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold">Profile completeness</h3>
          <span className="text-sm font-semibold tabular text-slate-900">{doneCount}/{checks.length}</span>
        </div>
        <ul className="mt-3 space-y-2">
          {checks.map((c) => (
            <li key={c.label} className={cn("flex items-center gap-2 text-sm", c.done ? "text-slate-900" : "text-slate-600")}>
              {c.done ? <Check className="size-4 text-emerald-700" aria-hidden="true" /> : <Circle className="size-4 text-slate-400" aria-hidden="true" />}
              {c.label}<span className="sr-only">{c.done ? " done" : " to do"}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-slate-600">Patients are matched to you using your specialisations, so a fuller profile gets you better matches.</p>
      </section>
    </aside>
    </div>
  );
}
