/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import AppShell from "@/components/navigation/AppShell";
import { getPatientById, getPatientSessions } from "@/lib/therapist/therapistStore";
import { Patient } from "@/lib/therapist/types";
import { SessionRecord } from "@/lib/exercises/types";
import { getExerciseById } from "@/lib/exercises/registry";
import { FilePlus, CheckCircle2, Activity, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function PatientDetailPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = use(params);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);

  useEffect(() => {
    setPatient(getPatientById(patientId));
    setSessions(getPatientSessions(patientId));
  }, [patientId]);

  if (!patient) {
    return (
      <AppShell title="Loading..." showBackNav backHref="/therapist">
        <div className="text-center py-10 text-slate-500 text-sm">Patient not found.</div>
      </AppShell>
    );
  }

  const totalSessions = sessions.length;
  const avgRom = totalSessions > 0 
    ? Math.round(sessions.reduce((acc, s) => acc + s.rom, 0) / totalSessions) 
    : 0;

  return (
    <AppShell title="Patient Profile" showBackNav backHref="/therapist">
      <div className="space-y-6">
        
        {/* Patient Details */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{patient.name}</h2>
              <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                <span>Age {patient.age}</span>
                <span>{patient.height}</span>
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200">
              <AlertCircle className="w-3.5 h-3.5" />
              {patient.condition}
            </div>
          </CardContent>
        </Card>

        {/* Performance Summary */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Performance Summary</h3>
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4 text-center space-y-1">
                <span className="text-xs font-medium text-slate-500">Average ROM</span>
                <p className="text-2xl font-bold text-slate-900">{avgRom}&deg;</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center space-y-1">
                <span className="text-xs font-medium text-slate-500">Sessions</span>
                <p className="text-2xl font-bold text-slate-900">{totalSessions}</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Prescriptions */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Prescriptions</h3>
            <Button asChild size="sm" variant="outline">
              <Link href={`/therapist/patient/${patientId}/prescribe`}>
                <FilePlus className="w-4 h-4 mr-2" /> Assign New
              </Link>
            </Button>
          </div>
          
          <div className="space-y-3">
            {patient.prescriptions.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No active prescriptions.</p>
            ) : (
              patient.prescriptions.map(rx => {
                const ex = getExerciseById(rx.exerciseId);
                return (
                  <Card key={rx.id}>
                    <CardContent className="p-4">
                      <h4 className="text-sm font-semibold text-slate-900">{ex?.name || rx.exerciseId}</h4>
                      <p className="text-xs text-slate-500 mt-1">
                        {rx.targetSets} sets × {rx.targetReps} reps {rx.targetROM ? `• Target ${rx.targetROM}° ROM` : ''}
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
              {sessions.map(s => (
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
