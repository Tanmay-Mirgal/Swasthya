/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import {
  Users,
  ChevronRight,
  ClipboardList,
  Loader2,
  AlertCircle,
  Clock,
  Check,
  X,
  Activity,
  Calendar,
  Stethoscope,
  Video,
  User,
  ShieldCheck,
  Search,
  Sparkles,
  Building2,
  Award,
  DollarSign,
  PhoneCall,
  Save,
  CheckCircle2,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth, useUser } from "@clerk/react";
import DoctorAvatar from "@/components/ui/DoctorAvatar";

const SPECIALIZATION_SUGGESTIONS = [
  "Neck Pain",
  "Back Pain",
  "Posture Problems",
  "Sciatica Recovery",
  "Cervical Spine",
  "Knee Pain",
  "Knee Rehabilitation",
  "Shoulder Pain",
  "Rotator Cuff Rehab",
  "Arm / Elbow",
  "Hip & Pelvis",
  "Ankle & Foot Biomechanics",
  "Sports Injury",
  "Mobility Issues",
  "General Physiotherapy",
  "Post-Surgical Rehab",
  "Rehabilitation",
  "Geriatric Care",
  "Neurological Rehabilitation",
  "Dry Needling",
];

export default function TherapistPortalPage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Tab State: "dashboard" | "patients" | "appointments" | "profile"
  const tabParam = searchParams.get("tab") as "dashboard" | "patients" | "appointments" | "profile" | null;
  const [activeTab, setActiveTab] = useState<"dashboard" | "patients" | "appointments" | "profile">(
    tabParam || "dashboard"
  );

  useEffect(() => {
    if (tabParam && ["dashboard", "patients", "appointments", "profile"].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  // Data States
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    totalPatients: 0,
    todayAppointments: 0,
    completedSessions: 0,
    consultationFee: 499,
    totalRevenue: 0,
  });

  // Search & Filter for Patients & Appointments
  const [patientSearch, setPatientSearch] = useState("");
  const [appointmentFilter, setAppointmentFilter] = useState<"all" | "today" | "completed">("all");

  // Profile Edit Form State
  const [profile, setProfile] = useState<any>(null);
  const [profName, setProfName] = useState("");
  const [profTitle, setProfTitle] = useState("");
  const [profQual, setProfQual] = useState("");
  const [profClinic, setProfClinic] = useState("");
  const [profFee, setProfFee] = useState(499);
  const [profExp, setProfExp] = useState("10+ years");
  const [profBio, setProfBio] = useState("");
  const [profConditions, setProfConditions] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState("");

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
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (data.success) {
        setPatients(data.data.patients || []);
        setConsultations(data.data.consultations || []);
        setPendingRequests(data.data.pendingRequests || []);
        if (data.data.stats) setStats(data.data.stats);

        // Populate Profile if returned
        if (data.data.profile) {
          syncProfileState(data.data.profile);
        } else {
          // Fallback fetch profile
          fetchProfileData();
        }
      } else {
        setError(data.error || "Failed to load dashboard data");
      }
    } catch (err) {
      setError("Failed to load dashboard data");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProfileData = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch("/api/therapist/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && json.data) {
        syncProfileState(json.data);
      }
    } catch (e) {
      console.warn("Could not load therapist profile:", e);
    }
  };

  const syncProfileState = (data: any) => {
    setProfile(data);
    setProfName(data.professionalName || user?.fullName || "Dr. Physiotherapist");
    setProfTitle(data.title || "Senior Clinical Physiotherapist");
    setProfQual(data.qualification || "MPT, BPT Certified");
    setProfClinic(data.clinicName || "Swasthya Partner Clinic");
    setProfFee(data.consultationFee || 499);
    setProfExp(data.yearsOfExperience || "10+ years");
    setProfBio(data.bio || "");
    setProfConditions(data.supportedConditions || ["Neck Pain", "Back Pain"]);
  };

  const handleRequestAction = async (requestId: string, action: "accept" | "decline") => {
    try {
      const token = await getToken();
      const res = await fetch(`/api/therapist/requests/${requestId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        fetchDashboardData();
      }
    } catch (err) {
      console.error(`Failed to ${action} request`, err);
    }
  };

  // Toggle multi-select specialization in profile
  const toggleCondition = (item: string) => {
    setProfConditions((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  // Add custom specialization tag
  const handleAddCustomCondition = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customTagInput.trim();
    if (trimmed && !profConditions.includes(trimmed)) {
      setProfConditions((prev) => [...prev, trimmed]);
      setCustomTagInput("");
    }
  };

  // Save profile changes
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileSuccessMsg("");

    try {
      const token = await getToken();
      const primarySpec = profConditions.slice(0, 3).join(", ") || "Orthopedic Physical Therapy";

      const res = await fetch("/api/therapist/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          professionalName: profName,
          title: profTitle,
          qualification: profQual,
          clinicName: profClinic,
          consultationFee: profFee,
          yearsOfExperience: profExp,
          bio: profBio,
          specialization: primarySpec,
          supportedConditions: profConditions,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setProfileSuccessMsg("Profile details saved successfully!");
        setTimeout(() => setProfileSuccessMsg(""), 4000);
        fetchDashboardData();
      } else {
        alert(json.error || "Failed to update profile");
      }
    } catch (err) {
      console.error("Error saving profile:", err);
      alert("Error saving profile details.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const switchTab = (tab: "dashboard" | "patients" | "appointments" | "profile") => {
    setActiveTab(tab);
    router.replace(`/therapist?tab=${tab}`);
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex flex-col h-[70vh] items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-xs font-semibold text-slate-500">Loading Doctor Portal...</p>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <div className="flex flex-col h-full items-center justify-center p-6 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <h2 className="text-xl font-bold text-slate-900">Error loading portal</h2>
          <p className="text-slate-500 text-sm">{error}</p>
          <Button onClick={fetchDashboardData} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <RefreshCw className="w-4 h-4 mr-1.5" /> Try Again
          </Button>
        </div>
      </AppShell>
    );
  }

  // Filtered lists
  const filteredPatients = patients.filter((p: any) => {
    const q = patientSearch.toLowerCase();
    const name = (p.user?.fullName || `${p.user?.firstName || ""} ${p.user?.lastName || ""}`).toLowerCase();
    const concerns = (p.profile?.concerns || []).join(" ").toLowerCase();
    return name.includes(q) || concerns.includes(q);
  });

  const filteredAppointments = consultations.filter((c: any) => {
    if (appointmentFilter === "today") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return new Date(c.createdAt) >= today;
    }
    if (appointmentFilter === "completed") {
      return c.status === "COMPLETED";
    }
    return true;
  });

  return (
    <AppShell maxWidth="wide">
      <div className="flex flex-col space-y-5 pb-24 md:pb-8 pt-1">
        
        {/* ── TOP DOCTOR HEADER BAR ───────────────────────────────────── */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <DoctorAvatar
              src={profile?.avatarUrl || user?.imageUrl}
              name={profName || "Doctor"}
              size="lg"
              isOnline={true}
              className="rounded-2xl"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                  {profName || "Dr. Physiotherapist"}
                </h1>
                <ShieldCheck className="size-4.5 text-emerald-600 shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                  Verified Doctor
                </span>
              </div>
              <p className="text-xs font-semibold text-emerald-700">
                {profTitle} • {profClinic}
              </p>
              <p className="text-[11px] text-slate-500 font-medium pt-0.5">
                {profQual} • {profExp} experience
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              onClick={() => switchTab("profile")}
              variant="outline"
              className="h-9 text-xs font-semibold rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <User className="size-3.5 mr-1" />
              Edit Profile
            </Button>
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-900">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Doctor Portal Live</span>
            </div>
          </div>
        </div>

        {/* ── CLEAN 4-TAB NAVIGATION SWITCHER ─────────────────────────── */}
        <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-2xl border border-slate-200/80 overflow-x-auto scrollbar-none">
          <button
            onClick={() => switchTab("dashboard")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === "dashboard"
                ? "bg-white text-emerald-950 shadow-2xs font-extrabold"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            <Activity className="size-3.5" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => switchTab("patients")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === "patients"
                ? "bg-white text-emerald-950 shadow-2xs font-extrabold"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            <Users className="size-3.5" />
            <span>Patients List</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
              {patients.length}
            </span>
          </button>

          <button
            onClick={() => switchTab("appointments")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === "appointments"
                ? "bg-white text-emerald-950 shadow-2xs font-extrabold"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            <Calendar className="size-3.5" />
            <span>Appointments</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-800">
              {consultations.length}
            </span>
          </button>

          <button
            onClick={() => switchTab("profile")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === "profile"
                ? "bg-white text-emerald-950 shadow-2xs font-extrabold"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            <User className="size-3.5" />
            <span>Practice Profile & Settings</span>
          </button>
        </div>

        {/* ── TAB 1: DASHBOARD VIEW ──────────────────────────────────── */}
        {activeTab === "dashboard" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Active Patients</span>
                  <div className="size-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Users className="size-4" />
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-slate-900 mt-2">
                  {stats.totalPatients}
                </div>
                <span className="text-[11px] text-slate-400 font-medium">Under active care</span>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Today&apos;s Appointments</span>
                  <div className="size-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Calendar className="size-4" />
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-slate-900 mt-2">
                  {stats.todayAppointments}
                </div>
                <span className="text-[11px] text-slate-400 font-medium">Scheduled for today</span>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Completed Sessions</span>
                  <div className="size-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="size-4" />
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-emerald-700 mt-2">
                  {stats.completedSessions}
                </div>
                <span className="text-[11px] text-slate-400 font-medium">Prescriptions delivered</span>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Session Fee</span>
                  <div className="size-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <DollarSign className="size-4" />
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-slate-900 mt-2">
                  ₹{stats.consultationFee}
                </div>
                <span className="text-[11px] text-slate-400 font-medium">Per 25m video call</span>
              </div>
            </div>

            {/* Pending Requests Section */}
            {pendingRequests.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-amber-500" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Pending Consultation Requests ({pendingRequests.length})
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {pendingRequests.map((req: any) => {
                    const name = req.user?.fullName || "Patient";
                    const concerns = req.profile?.concerns?.join(", ") || "General Rehabilitation";

                    return (
                      <div
                        key={req.request._id}
                        className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="size-11 rounded-full bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                            {req.user?.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={req.user.imageUrl} alt={name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-emerald-100 text-emerald-800 font-bold text-xs">
                                {name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-slate-900 truncate">{name}</h3>
                            <p className="text-xs text-emerald-700 font-semibold truncate">{concerns}</p>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2 border-t border-slate-100">
                          <Button
                            onClick={() => handleRequestAction(req.request._id, "accept")}
                            className="flex-1 h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
                          >
                            <Check className="size-3.5 mr-1" /> Accept
                          </Button>
                          <Button
                            onClick={() => handleRequestAction(req.request._id, "decline")}
                            variant="outline"
                            className="flex-1 h-9 text-xs border-slate-200 text-slate-700 rounded-xl"
                          >
                            <X className="size-3.5 mr-1" /> Decline
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Recent Consultations Workspace Access */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">
                  Recent Consultations & Calls ({consultations.length})
                </h2>
                <button
                  onClick={() => switchTab("appointments")}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-0.5 cursor-pointer"
                >
                  <span>View all</span>
                  <ChevronRight className="size-3.5" />
                </button>
              </div>

              {consultations.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-2">
                  <Stethoscope className="size-8 text-slate-300 mx-auto" />
                  <p className="text-sm font-bold text-slate-700">No consultations logged yet.</p>
                  <p className="text-xs text-slate-400">
                    When patients book or start video calls with you, they will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {consultations.slice(0, 4).map((c: any) => (
                    <div
                      key={c._id}
                      className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center font-bold text-xs shrink-0">
                          {c.patientName?.slice(0, 2).toUpperCase() || "PT"}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900">{c.patientName}</h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                              {c.status || "CONFIRMED"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 font-medium">
                            Focus: {c.issue || "Orthopedic Recovery"} •{" "}
                            {new Date(c.createdAt).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>

                      <Button asChild className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shrink-0">
                        <Link href={`/consultation/${c._id}`}>
                          <Video className="size-3.5 mr-1" />
                          <span>Enter Workspace</span>
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ── TAB 2: ALL PATIENTS LIST ──────────────────────────────── */}
        {activeTab === "patients" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Search Bar */}
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="size-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search patients by name or health concern (e.g. Knee, Back)..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs"
                />
              </div>

              <span className="text-xs font-semibold text-slate-500 shrink-0">
                {filteredPatients.length} Patients
              </span>
            </div>

            {/* Patients List Grid */}
            {filteredPatients.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center space-y-2">
                <Users className="size-10 text-slate-300 mx-auto" />
                <h3 className="text-base font-bold text-slate-800">No matching patients</h3>
                <p className="text-xs text-slate-500">
                  {patientSearch
                    ? `No patients found matching "${patientSearch}".`
                    : "No active patients under your care yet."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredPatients.map((p: any) => {
                  const name = p.user?.fullName || `${p.user?.firstName || ""} ${p.user?.lastName || ""}`.trim() || "Patient";
                  const concerns = p.profile?.concerns || [p.consultation?.issue || "General Recovery"];
                  const patientId = p.assignment?.patientId || p.user?.clerkUserId;

                  return (
                    <div
                      key={patientId}
                      className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-3 hover:border-emerald-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="size-11 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0 border border-emerald-200">
                            {p.user?.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.user.imageUrl} alt={name} className="w-full h-full object-cover rounded-2xl" />
                            ) : (
                              name.slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">{name}</h3>
                            <p className="text-[11px] text-slate-500">{p.user?.email || "Swasthya Patient"}</p>
                          </div>
                        </div>

                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                          Active Care
                        </span>
                      </div>

                      {/* Health Focus Chips */}
                      <div className="flex flex-wrap gap-1">
                        {concerns.map((c: string) => (
                          <span
                            key={c}
                            className="text-[10px] font-semibold bg-slate-50 border border-slate-200/80 text-slate-700 px-2 py-0.5 rounded-lg"
                          >
                            {c}
                          </span>
                        ))}
                      </div>

                      {/* Exercises & Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                        <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                          <ClipboardList className="size-3.5 text-emerald-600" />
                          <span>{p.exerciseAssignments?.length || 3} exercises assigned</span>
                        </span>

                        <div className="flex items-center gap-2">
                          {p.consultation?._id ? (
                            <Button asChild size="sm" className="h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold">
                              <Link href={`/consultation/${p.consultation._id}`}>
                                <Video className="size-3 mr-1" />
                                <span>Workspace</span>
                              </Link>
                            </Button>
                          ) : (
                            <Button asChild size="sm" variant="outline" className="h-8 rounded-xl border-slate-200 text-slate-700 text-xs">
                              <Link href={`/therapist/patient/${patientId}`}>
                                <span>View History</span>
                                <ChevronRight className="size-3 ml-0.5" />
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: APPOINTMENTS VIEW ───────────────────────────────── */}
        {activeTab === "appointments" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Filter Tabs */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setAppointmentFilter("all")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                    appointmentFilter === "all" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500"
                  }`}
                >
                  All ({consultations.length})
                </button>
                <button
                  onClick={() => setAppointmentFilter("today")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                    appointmentFilter === "today" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500"
                  }`}
                >
                  Today ({stats.todayAppointments})
                </button>
                <button
                  onClick={() => setAppointmentFilter("completed")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                    appointmentFilter === "completed" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500"
                  }`}
                >
                  Completed ({stats.completedSessions})
                </button>
              </div>

              <span className="text-xs text-slate-500 font-semibold">
                Fee: ₹{stats.consultationFee}/session
              </span>
            </div>

            {/* Appointments Cards */}
            {filteredAppointments.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center space-y-2">
                <Calendar className="size-10 text-slate-300 mx-auto" />
                <h3 className="text-base font-bold text-slate-800">No appointments in this view</h3>
                <p className="text-xs text-slate-500">
                  New video appointments and consultations booked by patients will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAppointments.map((c: any) => (
                  <div
                    key={c._id}
                    className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="size-11 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center font-bold text-sm shrink-0">
                        {c.patientName?.slice(0, 2).toUpperCase() || "PT"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900">{c.patientName}</h4>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              c.status === "COMPLETED"
                                ? "bg-slate-100 text-slate-700"
                                : "bg-emerald-100 text-emerald-800 animate-pulse"
                            }`}
                          >
                            {c.status || "CONFIRMED"}
                          </span>
                        </div>
                        <p className="text-xs text-emerald-700 font-semibold">
                          Condition Focus: {c.issue || "Orthopedic Physical Therapy"}
                        </p>
                        <p className="text-[11px] text-slate-400 font-medium">
                          Consultation Room ID: #{c._id.slice(-6)} • ₹{c.fee || 499}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <Button asChild className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs">
                        <Link href={`/consultation/${c._id}`}>
                          <Video className="size-3.5 mr-1.5" />
                          <span>Join Video Workspace</span>
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 4: PRACTICE PROFILE & SETTINGS ─────────────────────── */}
        {activeTab === "profile" && (
          <form
            onSubmit={handleSaveProfile}
            className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-2xs space-y-6 animate-in fade-in duration-300"
          >
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Doctor Practice Profile & Credentials
              </h2>
              <p className="text-xs text-slate-500">
                Update your professional credentials, clinic information, and multi-discipline specialties.
              </p>
            </div>

            {profileSuccessMsg && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                <span>{profileSuccessMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Professional Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <User className="size-3.5 text-emerald-600" />
                  <span>Professional Name</span>
                </label>
                <input
                  type="text"
                  required
                  value={profName}
                  onChange={(e) => setProfName(e.target.value)}
                  placeholder="e.g. Dr. Ashlesh Kadam"
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-emerald-500 shadow-2xs font-medium"
                />
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <Stethoscope className="size-3.5 text-emerald-600" />
                  <span>Professional Title</span>
                </label>
                <input
                  type="text"
                  required
                  value={profTitle}
                  onChange={(e) => setProfTitle(e.target.value)}
                  placeholder="e.g. Senior Orthopedic Physiotherapist"
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-emerald-500 shadow-2xs"
                />
              </div>

              {/* Qualification */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <Award className="size-3.5 text-emerald-600" />
                  <span>Medical Qualification & Certifications</span>
                </label>
                <input
                  type="text"
                  value={profQual}
                  onChange={(e) => setProfQual(e.target.value)}
                  placeholder="e.g. MPT Orthopedics, BPT Certified"
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-emerald-500 shadow-2xs"
                />
              </div>

              {/* Clinic Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <Building2 className="size-3.5 text-emerald-600" />
                  <span>Clinic / Hospital Affiliate</span>
                </label>
                <input
                  type="text"
                  value={profClinic}
                  onChange={(e) => setProfClinic(e.target.value)}
                  placeholder="e.g. Apex Joint & Spine Center"
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-emerald-500 shadow-2xs"
                />
              </div>

              {/* Experience */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <Clock className="size-3.5 text-emerald-600" />
                  <span>Years of Experience</span>
                </label>
                <input
                  type="text"
                  value={profExp}
                  onChange={(e) => setProfExp(e.target.value)}
                  placeholder="e.g. 10+ years"
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-emerald-500 shadow-2xs"
                />
              </div>

              {/* Fee */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <DollarSign className="size-3.5 text-emerald-600" />
                  <span>Consultation Fee (₹ INR)</span>
                </label>
                <input
                  type="number"
                  value={profFee}
                  onChange={(e) => setProfFee(Number(e.target.value) || 499)}
                  placeholder="499"
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-emerald-500 shadow-2xs font-bold"
                />
              </div>
            </div>

            {/* ── MULTI-SELECT CLINICAL SPECIALIZATIONS ───────────────── */}
            <div className="space-y-2.5 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-emerald-600" />
                    <span>Specializations & Focus Conditions (Multi-Select)</span>
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Patients are matched with your profile based on these selected issues.
                  </p>
                </div>
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  {profConditions.length} Selected
                </span>
              </div>

              {/* Chip Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-56 overflow-y-auto p-1.5 border border-slate-200 rounded-2xl bg-slate-50/50">
                {SPECIALIZATION_SUGGESTIONS.map((item) => {
                  const isSelected = profConditions.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleCondition(item)}
                      className={`p-2 rounded-xl border text-xs font-medium transition-all cursor-pointer text-left flex items-center justify-between shadow-2xs ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-50 text-emerald-950 font-bold ring-1 ring-emerald-500/30"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <span className="truncate pr-1">{item}</span>
                      {isSelected ? (
                        <CheckCircle2 className="size-3 text-emerald-600 shrink-0" />
                      ) : (
                        <Plus className="size-3 text-slate-400 shrink-0 opacity-40" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Add Custom Tag Bar */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Add custom specialization or technique..."
                  value={customTagInput}
                  onChange={(e) => setCustomTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCustomCondition(e);
                    }
                  }}
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 text-slate-800"
                />
                <Button
                  type="button"
                  onClick={handleAddCustomCondition}
                  disabled={!customTagInput.trim()}
                  variant="outline"
                  className="h-8.5 px-3 rounded-xl text-xs font-semibold border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <Plus className="size-3.5 mr-1" />
                  Add
                </Button>
              </div>

              {/* Active Selected Tags Preview */}
              {profConditions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {profConditions.map((cond) => (
                    <span
                      key={cond}
                      className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] font-semibold px-2 py-0.5 rounded-lg flex items-center gap-1 group shadow-2xs"
                    >
                      <span>{cond}</span>
                      <button
                        type="button"
                        onClick={() => toggleCondition(cond)}
                        className="text-emerald-700 hover:text-red-600 transition-colors p-0.5 rounded-full cursor-pointer"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Professional Bio */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <label className="text-xs font-semibold text-slate-700">
                Clinical Biography & Recovery Approach
              </label>
              <textarea
                rows={3}
                value={profBio}
                onChange={(e) => setProfBio(e.target.value)}
                placeholder="Share your clinical background, specialized rehabilitation methods, and treatment philosophy..."
                className="w-full p-3 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-emerald-500 shadow-2xs"
              />
            </div>

            {/* Save Button */}
            <div className="pt-2 flex items-center justify-end">
              <Button
                type="submit"
                disabled={isSavingProfile}
                className="h-11 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-xs flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
              >
                {isSavingProfile ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Save className="size-4" />
                    <span>Save Practice Profile</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </AppShell>
  );
}
