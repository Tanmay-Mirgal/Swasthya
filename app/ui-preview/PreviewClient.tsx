"use client";

import { useSearchParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import PatientHome from "@/components/patient/PatientHome";
import { computeDailyPlan, type ScheduleInput } from "@/lib/rehab/schedule";
import type { PlanSnapshot } from "@/lib/rehab/sessionService";
import ProgressView, { type ProgressSession } from "@/components/patient/ProgressView";
import ExerciseLibrary from "@/components/exercise/ExerciseLibrary";
import SessionSummary from "@/components/session/SessionSummary";
import OverviewTab from "@/components/therapist/OverviewTab";
import PatientsTable from "@/components/therapist/PatientsTable";
import type { TherapistConsultationItem, TherapistPatientItem, TherapistPendingRequestItem } from "@/components/therapist/types";

import { SessionDone, SessionIntro } from "@/components/exercise/SessionViews";
import { PlanBuilder } from "@/components/prescription/PlanBuilder";
import PlanSection from "@/components/therapist/PlanSection";
import ReportView from "@/components/review/ReportView";
import ReviewsTab from "@/components/review/ReviewsTab";
import type { ReviewListItem, WeeklyReportData } from "@/components/review/types";
import { computeExerciseProgress } from "@/lib/rehab/schedule";
import { getAllExercises } from "@/lib/exercises/registry";
import ReplayScreen, { type ReplayScenario } from "./ReplayScreen";
import StageSmoke from "./StageSmoke";
import QualityTrend from "@/components/progress/QualityTrend";
import { ReportBody } from "@/components/reports/SessionReportCard";
import { buildTrends } from "@/lib/movement/analytics/trends";
import { buildSessionFacts, deterministicReport } from "@/lib/movement/analytics/sessionReport";
import { Button, Notice, SectionHeading, TickBox, StatusMark, Authorship, EmptyState } from "@/components/ui";

// Fixture plan built with the real schedule functions, so the shape matches what /api/patient/plan returns.
const fixtureSchedule: ScheduleInput = {
  startDate: "2026-10-02",
  endDate: "2026-10-31",
  frequency: "daily",
  exercises: [
    { key: "k1", exerciseId: "seated-knee-extension", name: "Seated Knee Extension", sets: 3, reps: 15 },
    { key: "k2", exerciseId: "neck-rotation", name: "Neck Rotation", sets: 2, reps: 10 },
    { key: "k3", exerciseId: "seated-bicep-curl", name: "Seated Bicep Curl", sets: 2, reps: 12 },
  ],
  weeklyReview: { enabled: true, cycleDay: 6, requireRecording: true, recordingExerciseKey: "k1" },
};
function fixturePlan(variant: "active" | "paused" | "none" | "review"): PlanSnapshot {
  const today = variant === "review" ? "2026-10-07" : "2026-10-05"; // day 6 is the review day
  const logs = [{ exerciseKey: "k1", sets: [{ index: 0, completedReps: 15 }, { index: 1, completedReps: 8 }] }, { exerciseKey: "k2", sets: [{ index: 0, completedReps: 10 }, { index: 1, completedReps: 10 }] }];
  const daily = computeDailyPlan(fixtureSchedule, today, variant === "review" ? [] : logs);
  if (variant === "none") return { state: "none", timezone: "Asia/Kolkata", today };
  return {
    state: variant === "paused" ? "paused" : "active",
    timezone: "Asia/Kolkata",
    today,
    daily: variant === "paused" ? { ...daily, exercises: [], totalExercises: 0, totalSets: 0, completedSets: 0 } : daily,
    prescription: {
      id: "p1", version: 1, status: "active", doctorId: "d1", doctorName: "Dr. A. Rao", startDate: "2026-10-02", endDate: "2026-10-31", durationDays: 30, frequency: "daily",
      instructions: "Stop if the pain gets worse than mild.", doctorNotes: "Keep the thigh supported on the chair.", medicineCount: 1,
      weeklyReview: { enabled: true, cycleDay: 6, requireRecording: true, recordingExerciseKey: "k1" },
      exercises: [
        { key: "k1", exerciseId: "seated-knee-extension", name: "Seated Knee Extension", sets: 3, reps: 15, holdSeconds: 2, instructions: "Slow on the way down." },
        { key: "k2", exerciseId: "neck-rotation", name: "Neck Rotation", sets: 2, reps: 10, modifications: "Stay within a comfortable range." },
        { key: "k3", exerciseId: "seated-bicep-curl", name: "Seated Bicep Curl", sets: 2, reps: 12 },
      ],
      updatedAt: new Date(),
    },
    week: [
      { day: "2026-10-05", label: "M", state: "partial", isToday: variant !== "review" },
      { day: "2026-10-06", label: "T", state: "todo", isToday: false }, { day: "2026-10-07", label: "W", state: "todo", isToday: variant === "review" },
      { day: "2026-10-08", label: "T", state: "todo", isToday: false }, { day: "2026-10-09", label: "F", state: "todo", isToday: false },
      { day: "2026-10-10", label: "S", state: "todo", isToday: false }, { day: "2026-10-11", label: "S", state: "todo", isToday: false },
    ],
    upcoming: [{ day: "2026-10-06", exercises: ["Seated Knee Extension", "Neck Rotation", "Seated Bicep Curl"] }],
    review: variant === "review" ? { id: "r1", week: 1, status: "recording_due", recordingRequired: true, recordingExerciseKey: "k1", recordingDone: false } : null,
  };
}

const ago = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const patients: TherapistPatientItem[] = [
  { assignment: { patientId: "p1" }, user: { clerkUserId: "p1", fullName: "Asha Menon" }, profile: { concerns: ["Knee Pain"] }, exerciseAssignments: [{}, {}], activity: { lastSessionAt: ago(0), totalSessions: 14, sessionsLast7Days: 5, activeDaysLast7: 5, unreadMessages: 0 } },
  { assignment: { patientId: "p2" }, user: { clerkUserId: "p2", fullName: "Rohan Iyer" }, profile: { concerns: ["Neck Pain", "Posture Problems"] }, exerciseAssignments: [{}], activity: { lastSessionAt: ago(9), totalSessions: 6, sessionsLast7Days: 0, activeDaysLast7: 0, unreadMessages: 2 } },
  { assignment: { patientId: "p3" }, user: { clerkUserId: "p3", fullName: "Meera Joshi" }, profile: { concerns: ["Shoulder Pain"] }, exerciseAssignments: [], activity: { lastSessionAt: null, totalSessions: 0, sessionsLast7Days: 0, activeDaysLast7: 0, unreadMessages: 0 } },
  { assignment: { patientId: "p4" }, user: { clerkUserId: "p4", fullName: "Dev Kapoor" }, profile: { concerns: ["Back Pain"] }, exerciseAssignments: [{}, {}, {}], activity: { lastSessionAt: null, totalSessions: 0, sessionsLast7Days: 0, activeDaysLast7: 0, unreadMessages: 0 } },
];
const consults: TherapistConsultationItem[] = [
  { _id: "c1", patientId: "p1", doctorId: "d", patientName: "Asha Menon", patientImage: null, status: "ACTIVE", issue: "Knee rehabilitation", scheduledAt: new Date().toISOString(), createdAt: new Date().toISOString(), duration: 30, canJoin: true, requestedTime: "4:30 PM" },
];
const requests: TherapistPendingRequestItem[] = [
  { request: { _id: "r1", patientId: "p9", requestedDate: new Date(Date.now() + 86_400_000).toISOString(), requestedTime: "11:00 AM", patientNote: "Neck stiffness after long days at a desk", status: "pending" }, user: { clerkUserId: "p9", fullName: "Kavya Rao" }, profile: { concerns: ["Neck Pain"] } },
];

const day = (n: number, h = 9) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(h, 12, 0, 0);
  return d.toISOString();
};
const sessions: ProgressSession[] = [
  { id: "1", exerciseId: "seated-knee-extension", exerciseName: "Seated Knee Extension", date: day(0), completedReps: 10, targetReps: 10, rom: 84, durationSeconds: 372 },
  { id: "2", exerciseId: "neck-rotation", exerciseName: "Neck Rotation", date: day(1), completedReps: 8, targetReps: 10, rom: 52, durationSeconds: 301 },
  { id: "3", exerciseId: "seated-knee-extension", exerciseName: "Seated Knee Extension", date: day(2), completedReps: 10, targetReps: 10, rom: 80, durationSeconds: 390 },
  { id: "4", exerciseId: "seated-knee-extension", exerciseName: "Seated Knee Extension", date: day(5), completedReps: 9, targetReps: 10, rom: 76, durationSeconds: 410 },
  { id: "5", exerciseId: "seated-knee-extension", exerciseName: "Seated Knee Extension", date: day(9), completedReps: 7, targetReps: 10, rom: 70, durationSeconds: 350 },
  { id: "6", exerciseId: "seated-knee-extension", exerciseName: "Seated Knee Extension", date: day(16), completedReps: 6, targetReps: 10, rom: 64, durationSeconds: 320 },
];

const sampleProgress = (done: number[]) => computeExerciseProgress({ key: "k1", exerciseId: "seated-knee-extension", name: "Seated Knee Extension", sets: 3, reps: 15 }, { exerciseKey: "k1", sets: done.map((c, i) => ({ index: i, completedReps: c })) });
const sampleReport: WeeklyReportData = {
  weekNumber: 2, weekStart: "2026-10-09", weekEnd: "2026-10-14", exercisesAssigned: 2, exercisesCompleted: 1, setsPrescribed: 30, setsCompleted: 24, repsPrescribed: 390, repsCompleted: 331,
  daysDue: 6, daysCompleted: 4, daysMissed: 1, adherencePercent: 80, averageRom: 82, averageFormScore: 84, qualityChange: 6,
  commonFeedback: [{ code: "INSUFFICIENT_ROM", count: 12, label: "Range of motion below target" }, { code: "TOO_FAST", count: 4, label: "Movement too fast" }],
  discomfortReports: [{ level: "moderate", day: "2026-10-11", exerciseName: "Seated Knee Extension" }],
  exercises: [
    { exerciseKey: "k1", exerciseId: "seated-knee-extension", name: "Seated Knee Extension", setsPrescribed: 18, setsCompleted: 15, repsPrescribed: 270, repsCompleted: 228, averageRom: 84, averageFormScore: 86 },
    { exerciseKey: "k2", exerciseId: "neck-rotation", name: "Neck Rotation", setsPrescribed: 12, setsCompleted: 9, repsPrescribed: 120, repsCompleted: 103, averageRom: 52 },
  ],
};
const sampleReviews: ReviewListItem[] = [
  { id: "a", patientId: "p1", patientName: "Patient A", weekNumber: 2, dueDate: "2026-10-14", status: "report_ready", recordingRequired: true, recordingAttached: true, adherencePercent: 80, qualityChange: 6, reviewedAt: null, lastReviewedAt: "2026-10-08T10:00:00Z" },
  { id: "b", patientId: "p2", patientName: "Patient B", weekNumber: 1, dueDate: "2026-10-14", status: "recording_due", recordingRequired: true, recordingAttached: false, adherencePercent: null, qualityChange: null, reviewedAt: null, lastReviewedAt: null },
  { id: "c", patientId: "p3", patientName: "Patient C", weekNumber: 3, dueDate: "2026-10-12", status: "reviewed", recordingRequired: false, recordingAttached: false, adherencePercent: 100, qualityChange: -3, reviewedAt: "2026-10-13T09:00:00Z", lastReviewedAt: "2026-10-13T09:00:00Z" },
];
const samplePlan = {
  id: "p1", version: 2, status: "active", startDate: "2026-10-02", endDate: "2026-10-31", durationDays: 30, frequency: "daily" as const, instructions: "Stop if the pain gets worse than mild.", doctorNotes: "Keep the thigh supported.",
  weeklyReview: { enabled: true, cycleDay: 6, requireRecording: true },
  exercises: [{ key: "k1", exerciseId: "seated-knee-extension", name: "Seated Knee Extension", sets: 3, reps: 15, holdSeconds: 2, targetRom: 90, instructions: "Slow on the way down." }, { key: "k2", exerciseId: "neck-rotation", name: "Neck Rotation", sets: 2, reps: 10, modifications: "Stay within a comfortable range." }],
  medicines: [{ name: "Ibuprofen", dosage: "400 mg", frequency: "twice daily", duration: "5 days", instructions: "After food" }],
  adherence: { dayNumber: 6, totalDays: 30, adherence7d: 71, missedDays7d: 1, completedToday: false },
  weeklyReviews: [{ id: "w1", weekNumber: 1, dueDate: "2026-10-07", status: "reviewed", recordingRequired: true, recordingAttached: true, adherencePercent: 86 }, { id: "w2", weekNumber: 2, dueDate: "2026-10-14", status: "report_ready", recordingRequired: true, recordingAttached: true, adherencePercent: 80 }],
};
const sampleHistory = [{ id: "p1", version: 2, status: "active", startDate: "2026-10-02", endDate: "2026-10-31", exerciseCount: 2 }, { id: "p0", version: 1, status: "completed", startDate: "2026-09-20", endDate: "2026-10-01", exerciseCount: 1, closedReason: "superseded" }];

const trendFixture = buildTrends(
  [18, 14, 11, 8, 5, 3, 1].map((n, i) => ({
    id: `t${i}`,
    date: day(n),
    exerciseId: "seated-knee-extension",
    exerciseName: "Seated Knee Extension",
    completedReps: 45,
    targetReps: 45,
    rom: 78 + i * 2,
    judged: i !== 0,
    validReps: 24 + i * 3,
    invalidReps: 21 - i * 3,
    correctionAttempts: 6,
    correctionsSucceeded: 2 + i / 1.5 | 0,
    avgConfidence: i === 3 ? 0.55 : 0.92,
    avgRepSeconds: 3.4,
    errors: [{ code: "TRUNK_LEAN", label: "Leaning the trunk", reps: 8 - i }],
  })),
  { now: new Date() }
)[0];

const reportFixture = (() => {
  const mk = (index: number, reps: number, valid: number, invalid: number) => ({ index, completedReps: reps, chunks: [{ chunkId: `c${index}`, reps, engine: 2, validReps: valid, invalidReps: invalid, partialReps: 0, rom: 80, avgConfidence: 0.93, repRecords: [{ n: 1, valid: true, reasons: [], errors: [], rom: 80, ms: 3200, conf: 0.9 }] }] });
  const facts = buildSessionFacts({
    exerciseId: "seated-knee-extension", exerciseName: "Seated Knee Extension", targetReps: 45, completedReps: 45, rom: 82, targetRom: 90, dateKey: "2026-10-07", engineVersion: 2,
    validReps: 37, invalidReps: 8, partialReps: 3, correctionAttempts: 6, correctionsSucceeded: 4, avgConfidence: 0.92,
    issueCounts: { TRUNK_LEAN: 6, TOO_FAST: 2 }, issueSeverity: { TRUNK_LEAN: "major", TOO_FAST: "minor" }, observations: [{ code: "TRUNK_LEAN", repsAffected: 6, ofReps: 45 }],
    sets: [mk(0, 15, 10, 5), mk(1, 15, 13, 2), mk(2, 15, 14, 1)],
  } as never);
  return { sessionId: "x", source: "deterministic" as const, generatedAt: new Date().toISOString(), content: deterministicReport(facts), disclosure: "Automatic summary from your recorded session data. It is not a medical diagnosis." };
})();

export default function PreviewClient() {
  const screen = useSearchParams().get("screen") || "home";

  if (screen === "stage") return <StageSmoke />;

  if (screen === "live" || screen === "setup" || screen.startsWith("replay-")) {
    const scenario: ReplayScenario = screen === "live" ? "ok" : screen === "setup" ? "camera" : (screen.slice(7) as ReplayScenario);
    return <ReplayScreen scenario={scenario} />;
  }

  return (
    <AppShell title="Preview" maxWidth="wide">
      {(screen === "home" || screen === "review" || screen === "paused" || screen === "empty") && (
        <PatientHome
          firstName="Asha"
          greeting="Good morning"
          dateLabel="Monday, 5 October"
          plan={fixturePlan(screen === "home" ? "active" : screen === "empty" ? "none" : (screen as "review" | "paused"))}
          liveConsultation={screen === "home" ? { id: "demo", doctorName: "Dr. A. Rao", issue: "Knee rehabilitation" } : null}
          therapist={screen === "empty" ? null : { name: "Dr. A. Rao", specialization: "Orthopaedic physiotherapy", chatHref: "#", profileHref: "#", unread: 2 }}
          lastSession={screen === "empty" ? null : { exerciseName: "Seated Knee Extension", dateLabel: "Sun, Oct 4", reps: 45, targetReps: 45, rom: 84, durationLabel: "6:12" }}
        />
      )}
      {screen === "builder" && <PlanBuilder patientId="p1" patientName="Asha Menon" existing={null} backHref="#" />}
      {screen === "builder-revise" && <PlanBuilder patientId="p1" patientName="Asha Menon" backHref="#" existing={{ id: "p1", version: 2, frequency: "daily", durationDays: 30, instructions: "Stop if the pain gets worse than mild.", doctorNotes: "Keep the thigh supported.", weeklyReview: { enabled: true, cycleDay: 6, requireRecording: true, recordingExerciseKey: "k1" }, exercises: samplePlan.exercises, medicines: samplePlan.medicines }} />}
      {screen === "plan" && <PlanSection patientId="p1" patientName="Asha Menon" plan={samplePlan} history={sampleHistory} onChanged={() => undefined} />}
      {screen === "plan-empty" && <PlanSection patientId="p1" patientName="Asha Menon" plan={null} history={[]} onChanged={() => undefined} />}
      {screen === "report" && <div className="max-w-3xl"><ReportView report={sampleReport} /></div>}
      {screen === "reviews" && <ReviewsTab reviews={sampleReviews} />}
      {screen === "reviews-empty" && <ReviewsTab reviews={[]} />}
      {screen === "intro" && <SessionIntro name="Seated Knee Extension" progress={sampleProgress([15, 8])} doctorName="Dr. A. Rao" instructions="Slow on the way down." askRecording={false} recordingOn={false} reviewRecordingChosen={false} onChooseRecording={() => undefined} onStart={() => undefined} />}
      {screen === "intro-record" && <SessionIntro name="Seated Knee Extension" progress={sampleProgress([])} doctorName="Dr. A. Rao" askRecording recordingOn={false} reviewRecordingChosen onChooseRecording={() => undefined} onStart={() => undefined} />}
      {screen === "done" && <SessionDone progress={sampleProgress([15, 15, 15])} bestRom={86} discomfort="moderate" onDiscomfort={() => undefined} recording={{ state: "sent", error: null, onRetry: () => undefined }} saveNotice={null} next={{ href: "#", name: "Neck Rotation" }} />}
      {screen === "library" && <ExerciseLibrary exercises={getAllExercises()} suggestion={{ exerciseId: "neck-rotation", reason: "it matches the neck stiffness in your profile" }} prescribedIds={["seated-knee-extension"]} />}
      {screen === "progress" && <ProgressView sessions={sessions} />}
      {screen === "progress-empty" && <ProgressView sessions={[]} />}
      {screen === "summary" && (
        <SessionSummary
          session={{ id: "x", exerciseId: "seated-knee-extension", exerciseName: "Seated Knee Extension", date: day(0), targetReps: 10, completedReps: 10, rom: 84, averageTempo: 2.4, durationSeconds: 372, validReps: 8, invalidReps: 2, partialReps: 1, correctionAttempts: 3, correctionsSucceeded: 2, avgConfidence: 0.94, errors: { TRUNK_LEAN: { count: 2, severity: "major" } } }}
          previous={{ id: "y", exerciseId: "seated-knee-extension", exerciseName: "Seated Knee Extension", date: day(2), targetReps: 10, completedReps: 10, rom: 80, averageTempo: 2.5, durationSeconds: 390 }}
        />
      )}
      {screen === "therapist" && (
        <OverviewTab patients={patients} consultations={consults} pendingRequests={requests} onRequestAction={async () => undefined} busyRequestId={null} onShowAll={() => undefined} />
      )}
      {screen === "patients" && <PatientsTable patients={patients} />}
      {screen === "trend" && <div className="max-w-2xl"><QualityTrend trend={trendFixture} /></div>}
      {screen === "session-report" && <div className="max-w-2xl"><ReportBody report={reportFixture} audience="therapist" /></div>}
      {screen === "kit" && (
        <div className="max-w-2xl space-y-6">
          <SectionHeading title="Buttons" />
          <div className="flex flex-wrap gap-2">
            <Button>Primary</Button><Button variant="secondary">Secondary</Button><Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button><Button variant="danger">Danger</Button><Button variant="highlight">Highlight</Button><Button disabled>Disabled</Button>
          </div>
          <SectionHeading title="Notices" />
          <Notice tone="info" title="Info">Plain information.</Notice>
          <Notice tone="success" title="Saved">Your changes were saved.</Notice>
          <Notice tone="warning" title="Needs attention">Something to look at.</Notice>
          <Notice tone="danger" title="Couldn’t send">Check your connection and try again.</Notice>
          <SectionHeading title="Status" />
          <div className="flex flex-wrap gap-4">
            <StatusMark kind="done">Done</StatusMark><StatusMark kind="partial">1 of 3 sets</StatusMark><StatusMark kind="pending">Not started</StatusMark>
            <StatusMark kind="missed">Missed</StatusMark><StatusMark kind="attention">Needs review</StatusMark>
          </div>
          <div className="flex gap-3"><TickBox state="done" /><TickBox state="todo" /><TickBox state="partial" /><TickBox state="missed" /></div>
          <div className="space-y-1"><Authorship by="automated" /><Authorship by="therapist" name="Dr. A. Rao" /><p className="hand">Keep the knee in line with your toes.</p></div>
          <EmptyState title="Nothing here yet">Describe what belongs here and the next step.</EmptyState>
        </div>
      )}
    </AppShell>
  );
}
