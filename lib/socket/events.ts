import { getSocket } from "./client";
import { JoinConsultationPayload, JoinChatPayload, JoinUserPayload } from "./types";

let lastConsultation: JoinConsultationPayload | null = null;
let lastChat: JoinChatPayload | null = null;
let lastUser: JoinUserPayload | null = null;
let reconnectHandlerRegistered = false;

function ensureReconnectHandler() {
  if (reconnectHandlerRegistered) return;
  reconnectHandlerRegistered = true;

  const s = getSocket();
  s.on("connect", () => {
    console.log("[Socket.IO] Reconnected - restoring room subscriptions");
    if (lastUser) {
      s.emit("join_user", lastUser);
    }
    if (lastChat) {
      s.emit("join_chat", lastChat);
    }
    if (lastConsultation) {
      s.emit("join_consultation", lastConsultation);
    }
  });
}

export function joinUserRoom(userId: string) {
  if (!userId) return;
  const s = getSocket();
  const payload: JoinUserPayload = { userId };
  lastUser = payload;
  ensureReconnectHandler();

  if (s.connected) {
    s.emit("join_user", payload);
  } else {
    s.once("connect", () => s.emit("join_user", payload));
  }
}

export function joinChatRoom(userId: string, targetUserId?: string, conversationId?: string) {
  if (!userId) return;
  const s = getSocket();
  const payload: JoinChatPayload = { userId, targetUserId, conversationId };
  lastChat = payload;
  ensureReconnectHandler();

  if (s.connected) {
    s.emit("join_chat", payload);
  } else {
    s.once("connect", () => s.emit("join_chat", payload));
  }
}

export function joinConsultationRoom(consultationId: string, userId: string, role: "patient" | "doctor") {
  if (!consultationId) return;
  const s = getSocket();
  const payload: JoinConsultationPayload = { consultationId, userId, role };
  lastConsultation = payload;
  ensureReconnectHandler();

  if (s.connected) {
    s.emit("join_consultation", payload);
  } else {
    s.once("connect", () => {
      s.emit("join_consultation", payload);
    });
  }
}

