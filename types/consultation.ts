export interface Message {
  _id?: string;
  senderId: string;
  senderRole: "patient" | "doctor" | "system";
  content: string;
  type: "text" | "prescription" | "system";
  prescriptionData?: {
    doctorName?: string;
    medicines?: PrescriptionMedicine[];
    exercises?: PrescriptionExercise[];
    healthyTips?: string[];
    doctorNotes?: string;
  };
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

export interface IncomingCallData {
  callerName: string;
  callerRole: string;
  offer: RTCSessionDescriptionInit;
}

export interface ConsultationDetails {
  doctorId?: string;
  patientId?: string;
  status?: string;
}

export interface DoctorDetails {
  professionalName?: string;
  clerkUserId?: string;
  user?: {
    imageUrl?: string;
    firstName?: string;
    lastName?: string;
  };
}

export interface PatientDetails {
  name?: string;
}
