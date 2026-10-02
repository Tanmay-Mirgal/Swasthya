"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "@/components/navigation/AppShell";
import { ArrowLeft, Loader2, User, Clock, Building2, MapPin, BriefcaseMedical } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@clerk/react";

export default function TherapistProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const therapistId = resolvedParams.id;
  const router = useRouter();
  
  const { getToken } = useAuth();
  const [therapist, setTherapist] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [requestStatus, setRequestStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const fetchTherapist = async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const res = await fetch(`/api/therapist/public-profile/${therapistId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) setTherapist(json.data);
      } catch (err) {
        console.error("Error fetching therapist:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTherapist();
  }, [therapistId, getToken]);

  const handleRequestAppointment = async () => {
    setRequesting(true);
    setRequestStatus("idle");
    try {
      const token = await getToken();
      const res = await fetch("/api/patient/appointment-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          therapistId,
          requestedDate: new Date().toISOString(),
          requestedTime: "Flexible", // Stubbing a flexible default request
        })
      });
      
      const json = await res.json();
      if (json.success) {
        setRequestStatus("success");
      } else {
        setRequestStatus("error");
        setErrorMessage(json.error || "Failed to send request.");
      }
    } catch (err) {
      setRequestStatus("error");
      setErrorMessage("Network error sending request.");
    } finally {
      setRequesting(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-full items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      </AppShell>
    );
  }

  if (!therapist) {
    return (
      <AppShell>
        <div className="p-6 text-center">
          <h2 className="text-lg font-medium">Therapist not found</h2>
          <Link href="/discover" className="text-blue-600 mt-4 block">Return to discovery</Link>
        </div>
      </AppShell>
    );
  }

  if (requestStatus === "success") {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-[70vh] px-6 text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-2">
            <Clock className="w-8 h-8 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Request sent</h2>
            <p className="text-slate-500 mt-2 text-sm leading-relaxed max-w-[280px] mx-auto">
              Your appointment request has been sent to <strong>{therapist.professionalName}</strong>. We'll let you know when they respond.
            </p>
          </div>
          <Button asChild className="w-full bg-slate-900 text-white h-12 rounded-xl mt-4">
            <Link href="/">Return to Home</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col pb-8">
        {/* Header Image Area */}
        <div className="relative h-32 bg-slate-100 w-full -mx-4 px-4 sm:mx-0 sm:px-0">
          <Link href="/discover" className="absolute top-4 left-4 p-2 bg-white/80 backdrop-blur-md rounded-full shadow-sm z-10">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </Link>
          <div className="absolute -bottom-12 left-6">
            <div className="w-24 h-24 bg-white p-1 rounded-full shadow-md">
              <div className="w-full h-full bg-blue-50 rounded-full flex items-center justify-center">
                <User className="w-10 h-10 text-blue-600" />
              </div>
            </div>
          </div>
        </div>
        
        {/* Profile Info */}
        <div className="pt-16 px-2">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {therapist.professionalName || "Verified Therapist"}
          </h1>
          <p className="text-base text-blue-600 font-medium mt-1">
            {therapist.specialization || "Physical Therapy Specialist"}
          </p>
          
          <div className="flex flex-wrap gap-y-3 gap-x-6 mt-6">
            <div className="flex items-center text-sm text-slate-600">
              <BriefcaseMedical className="w-4 h-4 mr-2 text-slate-400" />
              {therapist.yearsOfExperience || "5+"} years experience
            </div>
            <div className="flex items-center text-sm text-slate-600">
              <Building2 className="w-4 h-4 mr-2 text-slate-400" />
              {therapist.clinicName || "Independent Practice"}
            </div>
          </div>

          <div className="h-px w-full bg-slate-100 my-6" />

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">About</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Dr. {therapist.professionalName?.split(" ").pop() || "Smith"} is a verified rehabilitation specialist partnering with RehabLens to provide targeted, evidence-based physical therapy.
            </p>
          </section>

          <div className="h-px w-full bg-slate-100 my-6" />
          
          {requestStatus === "error" && (
            <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-6 border border-red-100">
              {errorMessage}
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Request an appointment</h2>
            <p className="text-xs text-slate-500">
              Send a request to start your rehabilitation program. You can discuss exact scheduling later.
            </p>
            <Button 
              onClick={handleRequestAppointment} 
              disabled={requesting}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm text-sm font-semibold mt-2"
            >
              {requesting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {requesting ? "Sending Request..." : "Send Request"}
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
