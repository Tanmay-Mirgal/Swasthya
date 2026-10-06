export interface PatientActivity {
  lastSessionAt: string | null;
  totalSessions: number;
  sessionsLast7Days: number;
  activeDaysLast7: number;
  unreadMessages: number;
}

export interface TherapistPatientItem {
  assignment?: { patientId: string; status?: string };
  consultation?: { _id: string; issue?: string; status?: string };
  user?: {
    clerkUserId: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    email?: string;
    imageUrl?: string;
  };
  profile?: { concerns?: string[] } | null;
  exerciseAssignments?: unknown[];
  activity?: PatientActivity;
}

export interface TherapistConsultationItem {
  _id: string;
  patientId: string;
  doctorId: string;
  patientName: string;
  patientImage: string | null;
  patientConcerns?: string[];
  status: string;
  issue?: string;
  scheduledAt: string | Date;
  requestedTime?: string;
  createdAt: string | Date;
  duration: number;
  canJoin?: boolean;
}

export interface TherapistPendingRequestItem {
  request: {
    _id: string;
    patientId: string;
    requestedDate?: string;
    requestedTime?: string;
    patientNote?: string;
    status: string;
  };
  user?: { clerkUserId: string; fullName?: string; firstName?: string; lastName?: string; imageUrl?: string };
  profile?: { concerns?: string[] } | null;
}

export interface TherapistProfileData {
  professionalName?: string;
  title?: string;
  qualification?: string;
  clinicName?: string;
  consultationFee?: number;
  yearsOfExperience?: string;
  bio?: string;
  supportedConditions?: string[];
  avatarUrl?: string;
}

export function patientName(p: TherapistPatientItem): string {
  return p.user?.fullName || `${p.user?.firstName || ""} ${p.user?.lastName || ""}`.trim() || "Patient";
}

export function patientId(p: TherapistPatientItem): string {
  return p.assignment?.patientId || p.user?.clerkUserId || "";
}

export type PatientStatusKind = "no_plan" | "not_started" | "attention" | "active";

export interface PatientStatus {
  kind: PatientStatusKind;
  label: string;
  /** Plain-language reason, shown beside the status. */
  reason: string;
  /** True when a therapist should look at this patient first. */
  needsAttention: boolean;
}

const DAY = 86_400_000;

/** Status from real data only: prescribed plan, last tracked session, recent activity. */
export function getPatientStatus(p: TherapistPatientItem, now = Date.now()): PatientStatus {
  const plan = p.exerciseAssignments?.length ?? 0;
  const a = p.activity;
  if (plan === 0) {
    return { kind: "no_plan", label: "No plan yet", reason: "No exercises prescribed", needsAttention: true };
  }
  if (!a || a.totalSessions === 0) {
    return { kind: "not_started", label: "Not started", reason: "Hasn’t done a session yet", needsAttention: false };
  }
  const days = a.lastSessionAt ? Math.floor((now - new Date(a.lastSessionAt).getTime()) / DAY) : Infinity;
  if (days >= 7) {
    return { kind: "attention", label: "Needs attention", reason: `No session in ${days} days`, needsAttention: true };
  }
  return { kind: "active", label: "Active", reason: days === 0 ? "Exercised today" : `Last session ${days === 1 ? "yesterday" : `${days} days ago`}`, needsAttention: false };
}

export function relativeDay(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
