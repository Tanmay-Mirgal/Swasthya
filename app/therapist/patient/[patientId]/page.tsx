/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import AppShell from "@/components/navigation/AppShell";
import { getPatientById, getPatientSessions } from "@/lib/therapist/therapistStore";
import { Patient } from "@/lib/therapist/types";
import { SessionRecord } from "@/lib/exercises/types";
import { getExerciseById } from "@/lib/exercises/registry";
import { FilePlus, Calendar, Activity, CheckCircle2, AlertTriangle, ChevronRight } from "lucide-react";


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
        <div className="text-center py-10 text-zinc-400 text-xs">Patient not found.</div>
      </AppShell>
    );
  }

  // Summary logic
  const totalSessions = sessions.length;
  const avgRom = totalSessions > 0 
    ? Math.round(sessions.reduce((acc, s) => acc + s.rom, 0) / totalSessions) 
    : 0;

  return (
    <AppShell title="Patient Profile" showBackNav backHref="/therapist">
      <div className="space-y-4 pt-2">
        {/* Patient Details */}
        <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-4 shadow-xl backdrop-blur-xl">
          <h2 className="text-lg font-extrabold text-white">{patient.name}</h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-xs text-zinc-400">
            <span>Age: {patient.age}</span>
            <span>Height: {patient.height}</span>
          </div>
          <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800/80 border border-zinc-700/60 text-[10px] font-bold text-zinc-300">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            {patient.condition}
          </div>
        </div>

        {/* Prescriptions */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-zinc-400">Active Prescriptions</h3>
            <Link 
              href={`/therapist/patient/${patientId}/prescribe`}
              className="flex items-center gap-1 text-[10px] font-bold bg-indigo-600/20 text-indigo-400 px-2 py-1 rounded-full hover:bg-indigo-600/40 transition-colors"
            >
              <FilePlus className="w-3 h-3" /> Assign New
            </Link>
          </div>
          <div className="space-y-2">
            {patient.prescriptions.length === 0 ? (
              <p className="text-xs text-zinc-500 italic px-1">No active prescriptions.</p>
            ) : (
              patient.prescriptions.map(rx => {
                const ex = getExerciseById(rx.exerciseId);
                return (
                  <div key={rx.id} className="bg-zinc-900/80 border border-indigo-500/20 rounded-2xl p-3.5 shadow-md flex justify-between items-center">
                    <div>
                      <h4 className="text-sm font-bold text-white">{ex?.name || rx.exerciseId}</h4>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        {rx.targetSets} sets × {rx.targetReps} reps {rx.targetROM ? `• ${rx.targetROM}° Target ROM` : ''}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Performance Summary */}
        <div className="space-y-2 pt-2">
           <h3 className="text-xs font-extrabold uppercase tracking-widest text-zinc-400 px-1">Performance Summary</h3>
           <div className="grid grid-cols-2 gap-2.5">
             <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-3.5 text-center shadow-lg">
                <span className="text-2xl font-black font-mono text-cyan-400">{avgRom}&deg;</span>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mt-1">Average ROM</p>
             </div>
             <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-3.5 text-center shadow-lg">
                <span className="text-2xl font-black font-mono text-white">{totalSessions}</span>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mt-1">Sessions</p>
             </div>
           </div>
        </div>

        {/* Recent Sessions */}
        <div className="space-y-2 pt-2 pb-6">
          <h3 className="text-xs font-extrabold uppercase tracking-widest text-zinc-400 px-1">Recent Sessions</h3>
          {sessions.length === 0 ? (
            <p className="text-xs text-zinc-500 italic px-1">No sessions recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {sessions.map(s => (
                <div key={s.id} className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-3.5 shadow-md">
                   <div className="flex justify-between items-center mb-2">
                     <span className="text-xs font-bold text-white">{s.exerciseName}</span>
                     <span className="text-[9px] font-mono text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded-full">
                       {new Date(s.date).toLocaleDateString()}
                     </span>
                   </div>
                   <div className="flex items-center gap-4 text-[10px] text-zinc-300">
                     <div className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> {s.completedReps} Reps</div>
                     <div className="flex items-center gap-1"><Activity className="w-3 h-3 text-cyan-400" /> {s.rom}&deg; ROM</div>
                   </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
