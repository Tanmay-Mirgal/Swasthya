"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/navigation/AppShell";
import { getAllExercises } from "@/lib/exercises/registry";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@clerk/react";
import { Loader2, AlertCircle } from "lucide-react";

export default function PrescribeExercisePage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = use(params);
  const router = useRouter();
  const { getToken } = useAuth();
  
  const exercises = getAllExercises().filter(ex => ex.isAvailable);

  const [selectedExerciseId, setSelectedExerciseId] = useState(exercises[0]?.id || "");
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(10);
  const [targetRom, setTargetRom] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [patientName, setPatientName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPatientName();
  }, [patientId]);

  const fetchPatientName = async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch(`/api/therapist/patient/${patientId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
         setPatientName(`${data.data.user?.firstName || ""} ${data.data.user?.lastName || ""}`.trim() || "Patient");
      } else {
         setError(data.error);
      }
    } catch (err) {
      setError("Failed to load patient");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
       const token = await getToken();
       const res = await fetch(`/api/therapist/patient/${patientId}/prescribe`, {
          method: "POST",
          headers: {
             "Content-Type": "application/json",
             Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
             exerciseId: selectedExerciseId,
             targetSets: sets,
             targetReps: reps,
             targetROM: targetRom ? parseInt(targetRom, 10) : undefined,
          })
       });

       if (!res.ok) {
          throw new Error("Failed to save prescription");
       }
       router.push(`/therapist/patient/${patientId}`);
    } catch (err) {
       console.error(err);
       setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <AppShell title="Assign Exercise" showBackNav backHref={`/therapist/patient/${patientId}`}>
        <div className="flex h-full items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      </AppShell>
    );
  }

  if (error) {
     return (
        <AppShell title="Assign Exercise" showBackNav backHref={`/therapist/patient/${patientId}`}>
          <div className="flex flex-col h-full items-center justify-center p-6 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-red-500" />
            <h2 className="text-xl font-semibold text-slate-900">Error</h2>
            <p className="text-slate-500">{error}</p>
          </div>
        </AppShell>
      );
  }

  return (
    <AppShell title="Assign Exercise" showBackNav backHref={`/therapist/patient/${patientId}`}>
      <div className="space-y-6">
        <section className="space-y-1">
          <h2 className="text-xl font-semibold text-slate-900">New Prescription</h2>
          <p className="text-sm text-slate-500">Configure parameters for {patientName}</p>
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

