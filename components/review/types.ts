export interface ReportExercise {
  exerciseKey: string;
  exerciseId: string;
  name: string;
  setsPrescribed: number;
  setsCompleted: number;
  repsPrescribed: number;
  repsCompleted: number;
  averageRom?: number;
  romUnit?: "deg" | "pct";
  averageFormScore?: number;
  validReps?: number;
  invalidReps?: number;
}

export interface WeeklyReportData {
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  exercisesAssigned: number;
  exercisesCompleted: number;
  setsPrescribed: number;
  setsCompleted: number;
  repsPrescribed: number;
  repsCompleted: number;
  daysDue: number;
  daysCompleted: number;
  daysMissed: number;
  adherencePercent: number | null;
  averageRom?: number;
  averageFormScore?: number;
  formBasis?: "engine2" | "legacy";
  quality?: {
    validReps: number;
    invalidReps: number;
    partialReps: number;
    correctionAttempts: number;
    correctionsSucceeded: number;
    avgConfidence?: number;
    repeatedErrors: { code: string; reps: number; severity: "minor" | "moderate" | "major"; label?: string }[];
  };
  qualityChange?: number | null;
  commonFeedback: { code: string; count: number; label?: string }[];
  discomfortReports: { level: "mild" | "moderate" | "severe"; day: string; exerciseName: string }[];
  exercises: ReportExercise[];
}

export interface ReviewDetail {
  id: string;
  weekNumber: number;
  dueDate: string;
  status: "upcoming" | "recording_due" | "report_ready" | "reviewed";
  recordingRequired: boolean;
  recordingId: string | null;
  patientId: string;
  patientName: string;
  prescription: { id: string; startDate: string; endDate: string; version: number } | null;
  report: WeeklyReportData | null;
  therapistNotes: string | null;
  reviewedAt: string | null;
  viewerRole: "therapist" | "patient";
}

export interface ReviewListItem {
  id: string;
  patientId: string;
  patientName: string;
  patientImage?: string;
  weekNumber: number;
  dueDate: string;
  status: ReviewDetail["status"];
  recordingRequired: boolean;
  recordingAttached: boolean;
  adherencePercent: number | null;
  qualityChange: number | null;
  reviewedAt: string | null;
  lastReviewedAt: string | null;
}
