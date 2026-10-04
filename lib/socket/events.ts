import { getSocket } from "./client";
import { JoinConsultationPayload } from "./types";

export function joinConsultationRoom(consultationId: string, userId: string, role: "patient" | "doctor") {
  const s = getSocket();
  const payload: JoinConsultationPayload = { consultationId, userId, role };
  if (s.connected) {
    s.emit("join_consultation", payload);
  } else {
    s.once("connect", () => {
      s.emit("join_consultation", payload);
    });
  }
}
