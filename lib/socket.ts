import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const socketUrl =
      typeof window !== "undefined"
        ? `${window.location.protocol}//${window.location.hostname}:3001`
        : "http://localhost:3001";

    socket = io(socketUrl, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      autoConnect: true,
    });

    socket.on("connect", () => {
      console.log("[Socket.IO Client] Connected to signaling server, ID:", socket?.id);
    });

    socket.on("connect_error", (err) => {
      console.warn("[Socket.IO Client] Connection error (falling back to polling/offline sync):", err.message);
    });
  }

  return socket;
}

export function joinConsultationRoom(consultationId: string, userId: string, role: "patient" | "doctor") {
  const s = getSocket();
  if (s.connected) {
    s.emit("join_consultation", { consultationId, userId, role });
  } else {
    s.once("connect", () => {
      s.emit("join_consultation", { consultationId, userId, role });
    });
  }
}
