"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/navigation/AppShell";
import { getPatientById, savePrescription } from "@/lib/therapist/therapistStore";
import { getAllExercises } from "@/lib/exercises/registry";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function PrescribeExercisePage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = use(params);
  const router = useRouter();
  const patient = getPatientById(patientId);
  const exercises = getAllExercises().filter(ex => ex.isAvailable);

  const [selectedExerciseId, setSelectedExerciseId] = useState(exercises[0]?.id || "");
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(10);
  const [targetRom, setTargetRom] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!patient) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    setTimeout(() => {
      savePrescription(patientId, {
        patientId,
        exerciseId: selectedExerciseId,
        targetSets: sets,
        targetReps: reps,
        targetROM: targetRom ? parseInt(targetRom, 10) : undefined,
      });
      router.push(`/therapist/patient/${patientId}`);
    }, 500);
  };

  return (
    <AppShell title="Assign Exercise" showBackNav backHref={`/therapist/patient/${patientId}`}>
      <div className="space-y-6">
        <section className="space-y-1">
          <h2 className="text-xl font-semibold text-slate-900">New Prescription</h2>
          <p className="text-sm text-slate-500">Configure parameters for {patient.name}</p>
        </section>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardContent className="p-4 space-y-4">
              
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Exercise</label>
                <select 
                  value={selectedExerciseId}
                  onChange={(e) => setSelectedExerciseId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 appearance-none shadow-sm"
                >
                  {exercises.map(ex => (
                    <option key={ex.id} value={ex.id}>{ex.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Sets</label>
                  <input 
                    type="number" min="1" max="10"
                    value={sets}
                    onChange={(e) => setSets(parseInt(e.target.value, 10))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Reps</label>
                  <input 
                    type="number" min="1" max="50"
                    value={reps}
                    onChange={(e) => setReps(parseInt(e.target.value, 10))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Target ROM (Degrees)</label>
                <input 
                  type="number" min="1" max="180" placeholder="Optional (e.g. 160)"
                  value={targetRom}
                  onChange={(e) => setTargetRom(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 shadow-sm"
                />
              </div>

              <div className="pt-2">
                <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save Prescription"}
                </Button>
              </div>

            </CardContent>
          </Card>
        </form>
      </div>
    </AppShell>
  );
}
