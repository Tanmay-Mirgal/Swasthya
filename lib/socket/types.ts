export type ConsultationRole = "patient" | "doctor" | "system";

export interface JoinConsultationPayload {
  consultationId: string;
  userId: string;
  role: "patient" | "doctor";
}

export interface TypingPayload {
  consultationId: string;
  userId?: string;
  role: string;
  isTyping: boolean;
}

export interface CallUserPayload {
  consultationId: string;
  offer: RTCSessionDescriptionInit;
  callerName: string;
  callerRole: string;
}

export interface CallAcceptedPayload {
  consultationId: string;
  answer: RTCSessionDescriptionInit;
}

export interface IceCandidatePayload {
  consultationId: string;
  candidate: RTCIceCandidateInit;
}

export interface EndCallPayload {
  consultationId: string;
  duration: number;
}
