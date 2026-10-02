/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/navigation/AppShell";
import { getPatients } from "@/lib/therapist/therapistStore";
import { Patient } from "@/lib/therapist/types";
import { Users, ChevronRight, Activity, ClipboardList } from "lucide-react";

export default function TherapistDashboard() {
  const [patients, setPatients] = useState<Patient[]>([]);

  useEffect(() => {
    setPatients(getPatients());
  }, []);

  return (
    <AppShell title="Therapist Dashboard" showBackNav backHref="/">
      <div className="space-y-4 pt-2">
        <div className="bg-gradient-to-br from-indigo-950/80 via-zinc-900 to-zinc-950 border border-indigo-500/30 rounded-2xl p-5 shadow-lg space-y-2">
          <div className="flex items-center gap-2 text-indigo-400">
            <Users className="w-5 h-5" />
            <h2 className="text-sm font-extrabold uppercase tracking-widest">My Patients</h2>
          </div>
          <p className="text-xs text-zinc-400">
            Monitor progress and assign exercise prescriptions.
          </p>
        </div>

        <div className="space-y-3">
          {patients.map((patient) => (
            <Link
              key={patient.id}
              href={`/therapist/patient/${patient.id}`}
              className="group block bg-zinc-900/90 border border-zinc-800/80 hover:border-indigo-500/40 rounded-2xl p-4 shadow-xl backdrop-blur-xl transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-white group-hover:text-indigo-300 transition-colors">
                    {patient.name}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">{patient.condition}</p>
                </div>
                <div className="p-2 rounded-xl bg-zinc-800/80 text-zinc-400 group-hover:text-white group-hover:bg-indigo-600 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
              
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-zinc-800/80">
                <div className="flex items-center gap-1.5 text-xs text-zinc-300">
                  <ClipboardList className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{patient.prescriptions.length} Prescriptions</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-zinc-300">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  <span>View Analytics</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
