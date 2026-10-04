/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import AppShell from "@/components/navigation/AppShell";
import { getExerciseById } from "@/lib/exercises/registry";
import { FilePlus, CheckCircle2, Activity, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@clerk/react";

export default function PatientDetailPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = use(params);
  const { getToken } = useAuth();
  
  const [patientData, setPatientData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // For now, sessions are local only as per existing system
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    fetchPatientDetail();
  }, [patientId]);

  const fetchPatientDetail = async () => {
    try {
      setIsLoading(true);
      const token = await getToken();
      if (!token) return;

      const res = await fetch(`/api/therapist/patient/${patientId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      const data = await res.json();
      if (data.success) {
        setPatientData(data.data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("Failed to load patient data");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <AppShell title="Patient Profile" showBackNav backHref="/therapist">
        <div className="flex h-full items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      </AppShell>
    );
  }

  if (error || !patientData) {
    return (
      <AppShell title="Patient Profile" showBackNav backHref="/therapist">
        <div className="flex flex-col h-full items-center justify-center p-6 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <h2 className="text-xl font-semibold text-slate-900">Error loading patient</h2>
          <p className="text-slate-500">{error || "Patient not found"}</p>
        </div>
      </AppShell>
    );
  }

  const { user, profile, exerciseAssignments } = patientData;
  const name = `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Patient";
  const concerns = profile?.concerns?.join(", ") || "No specific concerns listed";

  return (
    <AppShell title="Patient Profile" showBackNav backHref="/therapist">
      <div className="space-y-6">
        
        {/* Patient Details */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{name}</h2>
              <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                <span>{user?.email}</span>
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200">
              <AlertCircle className="w-3.5 h-3.5" />
              Concerns: {concerns}
            </div>
          </CardContent>
        </Card>

        {/* Prescriptions */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Assigned Exercises</h3>
            <Button asChild size="sm" variant="outline">
              <Link href={`/therapist/patient/${patientId}/prescribe`}>
                <FilePlus className="w-4 h-4 mr-2" /> Assign New
              </Link>
            </Button>
          </div>
          
          <div className="space-y-3">
            {exerciseAssignments.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No active exercises assigned.</p>
            ) : (
              exerciseAssignments.map((ea: any) => {
                const ex = getExerciseById(ea.exerciseId);
                return (
                  <Card key={ea._id}>
                    <CardContent className="p-4">
                      <h4 className="text-sm font-semibold text-slate-900">{ex?.name || ea.exerciseId}</h4>
                      <p className="text-xs text-slate-500 mt-1">
                        {ea.targetSets} sets × {ea.targetReps} reps • {ea.type === "assigned" ? "Assigned" : "Suggested"}
                      </p>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </section>

        {/* Recent Sessions */}
        <section className="space-y-3 pb-6">
          <h3 className="text-sm font-semibold text-slate-900">Recent Sessions</h3>
          {sessions.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No sessions recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {sessions.map((s: any) => (
                <Card key={s.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-sm font-semibold text-slate-900">{s.exerciseName}</span>
                      <span className="text-xs text-slate-500">
                        {new Date(s.date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" /> 
                        {s.completedReps} Reps
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-blue-500" /> 
                        {s.rom}&deg; ROM
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

