// socket-server.js
// Dedicated Socket.IO Signaling & Realtime Server for Swasthya Telehealth & Recovery
const http = require("http");
const { Server } = require("socket.io");

const PORT = process.env.PORT_SOCKET || 3001;

const server = http.createServer((req, res) => {
  // Simple health check endpoint
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "healthy", service: "swasthya-realtime-socket" }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  pingTimeout: 60000,
});

// Map of active rooms and presence
const roomUsers = new Map(); // consultationId -> Set of { socketId, userId, role }

io.on("connection", (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  // 1. Join consultation room
  socket.on("join_consultation", ({ consultationId, userId, role }) => {
    if (!consultationId) return;

    socket.join(`consultation:${consultationId}`);
    socket.data.consultationId = consultationId;
    socket.data.userId = userId;
    socket.data.role = role;

    if (!roomUsers.has(consultationId)) {
      roomUsers.set(consultationId, new Set());
    }
    const currentUsers = roomUsers.get(consultationId);
    currentUsers.add(socket.id);

    console.log(`[Socket.IO] ${role} (${userId}) joined consultation:${consultationId}`);

    // Notify room of presence
    io.to(`consultation:${consultationId}`).emit("presence_update", {
      consultationId,
      activeUserCount: currentUsers.size,
      online: true,
      lastJoinedRole: role,
    });
  });

  // 2. Chat messaging
  socket.on("send_message", (messageData) => {
    const { consultationId } = messageData;
    if (!consultationId) return;
    console.log(`[Socket.IO] Message in ${consultationId} from ${messageData.senderRole}`);
    // Broadcast to everyone in the consultation room including sender confirmation
    io.to(`consultation:${consultationId}`).emit("new_message", messageData);
  });

  // 3. Typing indicator
  socket.on("typing", ({ consultationId, userId, role, isTyping }) => {
    if (!consultationId) return;
    socket.to(`consultation:${consultationId}`).emit("typing_update", {
      userId,
      role,
      isTyping,
    });
  });

  // 4. WebRTC Signaling: Scheduled Room Peer Offer
  socket.on("peer_offer", ({ consultationId, offer }) => {
    console.log(`[WebRTC] Peer offer relayed in ${consultationId}`);
    socket.to(`consultation:${consultationId}`).emit("peer_offer", {
      consultationId,
      offer,
    });
  });

  // 4b. WebRTC Signaling: Scheduled Room Peer Answer
  socket.on("peer_answer", ({ consultationId, answer }) => {
    console.log(`[WebRTC] Peer answer relayed in ${consultationId}`);
    socket.to(`consultation:${consultationId}`).emit("peer_answer", {
      consultationId,
      answer,
    });
  });

  // Legacy Call Request (for backwards compatibility if needed)
  socket.on("call_user", ({ consultationId, offer, callerName, callerRole }) => {
    console.log(`[WebRTC] Call initiated in ${consultationId} by ${callerRole}`);
    socket.to(`consultation:${consultationId}`).emit("incoming_call", {
      consultationId,
      offer,
      callerName,
      callerRole,
      timestamp: Date.now(),
    });
  });

  // Legacy Call Answer
  socket.on("call_accepted", ({ consultationId, answer }) => {
    console.log(`[WebRTC] Call accepted in ${consultationId}`);
    socket.to(`consultation:${consultationId}`).emit("call_accepted", {
      consultationId,
      answer,
    });
  });

  // 6. WebRTC Signaling: ICE Candidate relay
  socket.on("ice_candidate", ({ consultationId, candidate }) => {
    socket.to(`consultation:${consultationId}`).emit("ice_candidate", {
      candidate,
    });
  });

  // 7. WebRTC Signaling: Call Rejected
  socket.on("call_rejected", ({ consultationId, reason }) => {
    console.log(`[WebRTC] Call rejected in ${consultationId}`);
    socket.to(`consultation:${consultationId}`).emit("call_rejected", {
      consultationId,
      reason: reason || "User declined the call",
    });
  });

  // 8. WebRTC Signaling: End Call
  socket.on("end_call", ({ consultationId, duration }) => {
    console.log(`[WebRTC] Call ended in ${consultationId}`);
    io.to(`consultation:${consultationId}`).emit("call_ended", {
      consultationId,
      duration,
    });
  });

  // 9. Post-Consultation Prescription & Plan Published
  socket.on("prescription_published", ({ consultationId, prescription, message }) => {
    console.log(`[Socket.IO] Prescription published for ${consultationId}`);
    io.to(`consultation:${consultationId}`).emit("prescription_received", {
      consultationId,
      prescription,
      message,
    });
    // Also notify active plans updated
    io.to(`consultation:${consultationId}`).emit("recovery_plan_updated", {
      patientId: prescription.patientId,
      exercisesCount: prescription.exercises?.length || 0,
    });
  });

  // 10. Disconnect handling
  socket.on("disconnect", () => {
    const { consultationId, role, userId } = socket.data;
    if (consultationId && roomUsers.has(consultationId)) {
      const currentUsers = roomUsers.get(consultationId);
      currentUsers.delete(socket.id);
      if (currentUsers.size === 0) {
        roomUsers.delete(consultationId);
      }
      io.to(`consultation:${consultationId}`).emit("presence_update", {
        consultationId,
        activeUserCount: currentUsers.size,
        online: currentUsers.size > 0,
        departedRole: role,
      });
    }
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`> Swasthya Socket.IO Signaling Server running on http://localhost:${PORT}`);
});
