/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/navigation/AppShell";
import { Users, ChevronRight, ClipboardList, Loader2, AlertCircle, Clock, Check, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth, useUser } from "@clerk/react";

export default function TherapistDashboard() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [patients, setPatients] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      const token = await getToken();
      if (!token) return;

      const res = await fetch("/api/therapist/dashboard", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      const data = await res.json();
      if (data.success) {
        setPatients(data.data.patients || []);
        setPendingRequests(data.data.pendingRequests || []);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("Failed to load dashboard data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestAction = async (requestId: string, action: "accept" | "decline") => {
    try {
      const token = await getToken();
      const res = await fetch(`/api/therapist/requests/${requestId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action })
      });
      
      if (res.ok) {
        // Refresh dashboard
        fetchDashboardData();
      }
    } catch (err) {
      console.error(`Failed to ${action} request`, err);
    }
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex h-full items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <div className="flex flex-col h-full items-center justify-center p-6 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <h2 className="text-xl font-semibold text-slate-900">Error loading dashboard</h2>
          <p className="text-slate-500">{error}</p>
        </div>
      </AppShell>
    );
  }

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <AppShell>
      <div className="flex flex-col space-y-8 pb-4 pt-2">
        <div className="flex flex-col space-y-1">
          <h1 className="text-xl font-medium tracking-tight text-slate-900">
            {getGreeting()}, Dr. {user?.lastName || user?.firstName || "Therapist"}
          </h1>
          <p className="text-sm text-slate-500">
            You have {pendingRequests.length} new requests and {patients.length} active patients.
          </p>
        </div>

        {pendingRequests.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-amber-500" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Pending Requests
              </h2>
            </div>
            
            <div className="flex flex-col space-y-3">
              {pendingRequests.map((req) => {
                const name = `${req.user?.firstName || ""} ${req.user?.lastName || ""}`.trim() || "Patient";
                const concerns = req.profile?.concerns?.join(", ") || "No specific concerns";
                
                return (
                  <div key={req.request._id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                          {req.user?.imageUrl ? (
                             <img src={req.user.imageUrl} alt={name} className="w-full h-full object-cover rounded-full" />
                          ) : (
                            <Users className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-slate-900">{name}</h3>
                          <p className="text-xs font-medium text-slate-500 mt-0.5">{concerns}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-slate-100 flex gap-2">
                      <Button 
                        onClick={() => handleRequestAction(req.request._id, "accept")}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-9 text-xs"
                      >
                        <Check className="w-3.5 h-3.5 mr-1" /> Accept
                      </Button>
                      <Button 
                        onClick={() => handleRequestAction(req.request._id, "decline")}
                        variant="outline" 
                        className="flex-1 h-9 text-xs text-slate-600"
                      >
                        <X className="w-3.5 h-3.5 mr-1" /> Decline
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-slate-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active Patients
            </h2>
          </div>
          
          <div className="flex flex-col space-y-3">
            {patients.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center space-y-2">
                   <p className="text-sm font-medium text-slate-900">No active patients.</p>
                   <p className="text-xs text-slate-500">When you accept an appointment request, patients will appear here.</p>
               </div>
            ) : (
              patients.map((p) => {
                const name = `${p.user?.firstName || ""} ${p.user?.lastName || ""}`.trim() || "Patient";
                const concerns = p.profile?.concerns?.join(", ") || "No specific concerns";
                return (
                  <Link
                    key={p.assignment.patientId}
                    href={`/therapist/patient/${p.assignment.patientId}`}
                    className="block group"
                  >
                    <div className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-4 shadow-sm transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">
                            {p.user?.imageUrl ? (
                               <img src={p.user.imageUrl} alt={name} className="w-full h-full object-cover" />
                            ) : (
                              <Users className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                              {name}
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">{concerns}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-colors" />
                      </div>
                      
                      <div className="flex items-center gap-4 pt-3 border-t border-slate-100">
                        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                          <ClipboardList className="w-3.5 h-3.5 text-slate-400" />
                          <span>{p.exerciseAssignments.length} Exercises Assigned</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
