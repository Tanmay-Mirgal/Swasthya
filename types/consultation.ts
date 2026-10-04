export interface Message {
  _id?: string;
  consultationId?: string;
  conversationId?: string;
  senderId: string;
  senderRole: "patient" | "doctor" | "system";
  receiverId?: string;
  content: string;
  type: "text" | "prescription" | "call_summary" | "exercise_card" | "system";
  prescriptionData?: PrescriptionData;
  read: boolean;
  createdAt: string | Date;
}

export interface PrescriptionMedicine {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface PrescriptionExercise {
  exerciseId?: string;
  name: string;
  sets: number;
  reps: number;
  duration?: string;
  frequency?: string;
  instructions?: string;
}

export interface PrescriptionData {
  doctorName?: string;
  medicines?: PrescriptionMedicine[];
  exercises?: PrescriptionExercise[];
  healthyTips?: string[];
  doctorNotes?: string;
}

export interface IncomingCallData {
  callerName: string;
  callerRole: string;
  offer: RTCSessionDescriptionInit;
}

export type ConsultationStatus =
  | "REQUESTED"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED";

export type ConsultationRoomState =
  | "NOT_CREATED"
  | "SCHEDULED"
  | "OPEN"
  | "PATIENT_JOINED"
  | "DOCTOR_JOINED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "EXPIRED";

export interface ConsultationDetails {
  _id: string;
  appointmentId?: string;
  doctorId: string;
  patientId: string;
  issue: string;
  status: ConsultationStatus;
  roomStatus?: ConsultationRoomState;
  callStatus: "idle" | "calling" | "connected" | "ended";
  scheduledAt?: string | Date;
  startedAt?: string | Date;
  endedAt?: string | Date;
  duration?: number;
  patientNote?: string;
  doctorNotes?: string;
  prescriptionId?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface DoctorDetails {
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

export interface PatientDetails {
  patientId: string;
  name: string;
  imageUrl?: string | null;
  concerns?: string[];
}
