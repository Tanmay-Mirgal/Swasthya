/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/navigation/AppShell";
import { getPatients } from "@/lib/therapist/therapistStore";
import { Patient } from "@/lib/therapist/types";
import { Users, ChevronRight, ClipboardList } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";

export default function TherapistDashboard() {
  const [patients, setPatients] = useState<Patient[]>([]);

  useEffect(() => {
    setPatients(getPatients());
  }, []);

  return (
    <AppShell title="Therapist Portal" showBackNav backHref="/">
      <div className="space-y-6">
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-700" />
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              My Patients
            </h1>
          </div>
          <p className="text-sm text-slate-500">
            Monitor progress and assign exercise prescriptions.
          </p>
        </section>

        <section className="space-y-3">
          {patients.map((patient) => (
            <Link
              key={patient.id}
              href={`/therapist/patient/${patient.id}`}
              className="block group"
            >
              <Card className="hover:border-slate-300 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">
                        {patient.name}
                      </h3>
                      <p className="text-sm text-slate-500 mt-0.5">{patient.condition}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                  </div>
                  
                  <div className="flex items-center gap-4 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                      <ClipboardList className="w-4 h-4 text-slate-400" />
                      <span>{patient.prescriptions.length} Prescriptions</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
