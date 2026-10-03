"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/navigation/AppShell";
import { ArrowLeft, Loader2, User, ChevronRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@clerk/react";

export default function DiscoverTherapistsPage() {
  const { getToken } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const res = await fetch("/api/patient/discover", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) setData(json.data);
      } catch (err) {
        console.error("Error fetching discover data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [getToken]);

  if (loading) {
    return (
      <AppShell>
        <div className="flex flex-col h-[60vh] items-center justify-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          <p className="text-sm text-slate-500">Finding therapists for your selected concerns...</p>
        </div>
      </AppShell>
    );
  }

  const { concerns, therapists } = data || { concerns: [], therapists: [] };

  return (
    <AppShell>
      <div className="flex flex-col space-y-6 pb-6 pt-2">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <h1 className="text-xl font-medium tracking-tight text-slate-900">Find a Therapist</h1>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Based on what you're working on
          </h2>
          <div className="flex flex-wrap gap-2">
            {concerns.length > 0 ? concerns.map((concern: string) => (
              <span key={concern} className="bg-white border border-slate-200 text-slate-700 px-3 py-1 text-sm rounded-full shadow-sm font-medium">
                {concern}
              </span>
            )) : (
              <span className="text-sm text-slate-500">General rehabilitation</span>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Recommended Therapists</h2>
          
          {therapists.length === 0 ? (
            <div className="text-center py-10 px-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-slate-600 font-medium">No therapists match your selected concerns yet.</p>
              <p className="text-sm text-slate-500 mt-2">Please check back later or update your profile.</p>
            </div>
          ) : (
            <div className="flex flex-col space-y-4 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-6 md:space-y-0">
              {therapists.map((therapist: any) => {
                 // Simulate "relevant to" logic based on simple inclusion for display
                 const isHighlyRelevant = concerns.some((c: string) => 
                   (therapist.specialization || "").toLowerCase().includes(c.toLowerCase())
                 );

                 return (
                  <div key={therapist.clerkUserId} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col relative overflow-hidden group">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100">
                        <User className="w-6 h-6 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-slate-900">
                          {therapist.professionalName || "Verified Therapist"}
                        </h3>
                        <p className="text-sm text-slate-600 font-medium mt-0.5">
                          {therapist.specialization || "Physical Therapy"}
                        </p>
                        
                        {isHighlyRelevant && (
                          <div className="flex items-center gap-1.5 mt-2 text-xs font-medium text-emerald-700 bg-emerald-50 w-fit px-2 py-1 rounded-md">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Relevant to your concerns
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-medium">{therapist.yearsOfExperience || "5+"} years experience</span>
                      <Button asChild variant="outline" className="h-9 text-sm">
                        <Link href={`/therapist-profile/${therapist.clerkUserId}`}>
                          View Profile <ChevronRight className="w-4 h-4 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                 )
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
