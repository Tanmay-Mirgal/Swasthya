"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/navigation/AppShell";
import { getPatientById, savePrescription } from "@/lib/therapist/therapistStore";
import { getAllExercises } from "@/lib/exercises/registry";
import { CheckCircle2, ChevronRight } from "lucide-react";


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
    }, 500); // Simulate tiny network delay
  };

  return (
    <AppShell title="Assign Exercise" showBackNav backHref={`/therapist/patient/${patientId}`}>
      <div className="pt-4 space-y-4">
        <div className="text-center">
          <h2 className="text-sm font-extrabold text-white">Prescription for {patient.name}</h2>
          <p className="text-xs text-zinc-400 mt-1">Configure exercise parameters</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider pl-1">Exercise</label>
            <select 
              value={selectedExerciseId}
              onChange={(e) => setSelectedExerciseId(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 appearance-none"
            >
              {exercises.map(ex => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider pl-1">Target Sets</label>
              <input 
                type="number" min="1" max="10"
                value={sets}
                onChange={(e) => setSets(parseInt(e.target.value, 10))}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white text-center focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider pl-1">Target Reps</label>
              <input 
                type="number" min="1" max="50"
                value={reps}
                onChange={(e) => setReps(parseInt(e.target.value, 10))}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white text-center focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider pl-1">Target ROM (Degrees) - Optional</label>
            <input 
              type="number" min="1" max="180" placeholder="e.g. 160"
              value={targetRom}
              onChange={(e) => setTargetRom(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Save Prescription
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
