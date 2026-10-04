export type AppointmentStatus =
  | "PENDING"
  | "ACCEPTED"
  | "DECLINED"
  | "CANCELLED"
  | "COMPLETED"
  | "NO_SHOW";

export type ConsultationRoomStatus =
  | "NOT_CREATED"
  | "SCHEDULED"
  | "OPEN"
  | "PATIENT_JOINED"
  | "DOCTOR_JOINED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "EXPIRED";

export interface AppointmentDoctor {
  clerkUserId: string;
  professionalName: string;
  title?: string;
  specialization?: string;
  qualification?: string;
  clinicName?: string;
  avatarUrl?: string;
  rating?: number;
  yearsOfExperience?: string;
  consultationFee?: number;
}

export interface AppointmentPatient {
  clerkUserId: string;
  name: string;
  imageUrl?: string;
  concerns?: string[];
}

export interface Appointment {
  _id: string;
  patientId: string;
  therapistId: string;
  status: AppointmentStatus;
  requestedDate?: string | Date;
  requestedTime?: string;
  scheduledAt?: string | Date;
  duration: number; // minutes (default 30)
  patientNote?: string;
  consultationId?: string;
  roomStatus?: ConsultationRoomStatus;
  doctor?: AppointmentDoctor;
  patient?: AppointmentPatient;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ConsultationWindow {
  windowStart: Date;
  scheduledStart: Date;
  scheduledEnd: Date;
  windowEnd: Date;
}

/**
 * Calculates the valid consultation window.
 * - Window opens: 10 minutes prior to scheduled start.
 * - Window closes: duration + 15 minutes grace period after scheduled start.
 */
export function getConsultationWindow(
  scheduledAt: Date | string,
  durationMinutes = 30
): ConsultationWindow {
  const start = new Date(scheduledAt);
  const windowStart = new Date(start.getTime() - 10 * 60 * 1000);
  const scheduledEnd = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const windowEnd = new Date(scheduledEnd.getTime() + 15 * 60 * 1000);

  return {
    windowStart,
    scheduledStart: start,
    scheduledEnd,
    windowEnd,
  };
}

export type TimeWindowStatus =
  | "PENDING_APPROVAL"
  | "BEFORE_WINDOW"
  | "JOIN_WINDOW_OPEN"
  | "IN_PROGRESS"
  | "ENDED"
  | "CANCELLED"
  | "DECLINED";

/**
 * Evaluates the current timing status of an appointment.
 */
export function getAppointmentTimeStatus(
  status: string,
  scheduledAt?: Date | string | null,
  durationMinutes = 30,
  currentTime = new Date()
): TimeWindowStatus {
  const upperStatus = (status || "").toUpperCase();

  if (upperStatus === "CANCELLED") return "CANCELLED";
  if (upperStatus === "DECLINED") return "DECLINED";
  if (upperStatus === "COMPLETED") return "ENDED";
  if (upperStatus === "PENDING") return "PENDING_APPROVAL";

  if (!scheduledAt) {
    return "PENDING_APPROVAL";
  }

  const { windowStart, scheduledStart, windowEnd } = getConsultationWindow(
    scheduledAt,
    durationMinutes
  );
  const now = currentTime.getTime();

  if (now < windowStart.getTime()) {
    return "BEFORE_WINDOW";
  }
  if (now >= windowStart.getTime() && now < scheduledStart.getTime()) {
    return "JOIN_WINDOW_OPEN";
  }
  if (now >= scheduledStart.getTime() && now <= windowEnd.getTime()) {
    return "IN_PROGRESS";
  }
  return "ENDED";
}

/**
 * Strict evaluation of whether a consultation room can be joined right now.
 * RULE 4:
 * 1. Must be ACCEPTED
 * 2. Must have scheduledAt
 * 3. Current time must be within window (windowStart <= now <= windowEnd)
 * 4. Not cancelled, not completed
 */
export function canJoinConsultation(
  status: string,
  scheduledAt?: Date | string | null,
  durationMinutes = 30,
  currentTime = new Date()
): boolean {
  const upperStatus = (status || "").toUpperCase();
  if (upperStatus !== "ACCEPTED" && upperStatus !== "ACTIVE") {
    return false;
  }

  if (!scheduledAt) return false;

  const { windowStart, windowEnd } = getConsultationWindow(
    scheduledAt,
    durationMinutes
  );
  const now = currentTime.getTime();

  return now >= windowStart.getTime() && now <= windowEnd.getTime();
}
