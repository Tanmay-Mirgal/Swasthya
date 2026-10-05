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

  // 1. Join user personal notification channel
  socket.on("join_user", ({ userId }) => {
    if (!userId) return;
    socket.join(`user:${userId}`);
    socket.data.userId = userId;
    console.log(`[Socket.IO] User channel registered: user:${userId}`);
  });

  // 1b. Join direct chat room
  socket.on("join_chat", ({ userId, targetUserId, conversationId }) => {
    if (userId) {
      socket.join(`user:${userId}`);
      socket.data.userId = userId;
    }
    if (conversationId) {
      socket.join(`conversation:${conversationId}`);
    }
    console.log(`[Socket.IO] Direct chat room joined: user:${userId}, conversation:${conversationId}`);
  });

  // 1c. Join consultation room
  socket.on("join_consultation", ({ consultationId, userId, role }) => {
    if (!consultationId) return;

    socket.join(`consultation:${consultationId}`);
    if (userId) {
      socket.join(`user:${userId}`);
      socket.data.userId = userId;
    }
    socket.data.consultationId = consultationId;
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

  // 2. Chat messaging (Direct Chat & Consultation Chat)
  socket.on("send_message", (messageData) => {
    const { consultationId, conversationId, targetUserId, receiverId } = messageData;
    console.log(`[Socket.IO] Message received:`, {
      consultationId,
      conversationId,
      targetUserId,
      receiverId,
      senderRole: messageData.senderRole,
    });

    // 1. Consultation room delivery (exclude sender — they already added it locally)
    if (consultationId) {
      socket.to(`consultation:${consultationId}`).emit("new_message", messageData);
    }

    // 2. Direct conversation room delivery
    if (conversationId) {
      socket.to(`conversation:${conversationId}`).emit("new_message", messageData);
    }

    // 3. Target user room delivery (ensures cross-room delivery)
    const target = targetUserId || receiverId;
    if (target) {
      socket.to(`user:${target}`).emit("new_message", messageData);
    }

    // 4. Fallback if no room specified
    if (!consultationId && !conversationId && !target) {
      socket.broadcast.emit("new_message", messageData);
    }
  });

  // 3. Typing indicator
  socket.on("typing", ({ consultationId, conversationId, targetUserId, userId, role, isTyping }) => {
    if (consultationId) {
      socket.to(`consultation:${consultationId}`).emit("typing_update", {
        userId,
        role,
        isTyping,
      });
    }
    if (conversationId) {
      socket.to(`conversation:${conversationId}`).emit("typing_update", {
        userId,
        role,
        isTyping,
      });
    }
    if (targetUserId) {
      socket.to(`user:${targetUserId}`).emit("typing_update", {
        userId,
        role,
        isTyping,
      });
    }
  });

  // 4. WebRTC Signaling: Call User (single unified handler)
  //    Emits incoming_call to both the consultation room AND the
  //    other user's personal channel so it works even if the two
  //    browsers navigated to slightly different consultation URLs.
  socket.on("call_user", ({ consultationId, offer, callerName, callerRole, targetUserId }) => {
    console.log(`[WebRTC] Call initiated in ${consultationId} by ${callerRole} (${callerName}), target: ${targetUserId || "room-only"}`);
    const payload = {
      consultationId,
      offer,
      callerName: callerName || (callerRole === "patient" ? "Patient" : "Doctor"),
      callerRole,
      timestamp: Date.now(),
    };
    // Broadcast to everyone else in the consultation room
    socket.to(`consultation:${consultationId}`).emit("incoming_call", payload);
    // Also send directly to target user's personal channel
    if (targetUserId) {
      socket.to(`user:${targetUserId}`).emit("incoming_call", payload);
    }
  });

  // peer_offer is the same signal re-emitted by the client — just relay it
  socket.on("peer_offer", ({ consultationId, offer, callerName, callerRole, targetUserId }) => {
    console.log(`[WebRTC] Peer offer relayed in ${consultationId} by ${callerRole || "unknown"}`);
    const payload = {
      consultationId,
      offer,
      callerName: callerName || (callerRole === "patient" ? "Patient" : "Doctor"),
      callerRole,
      timestamp: Date.now(),
    };
    socket.to(`consultation:${consultationId}`).emit("incoming_call", payload);
    if (targetUserId) {
      socket.to(`user:${targetUserId}`).emit("incoming_call", payload);
    }
  });

  // 5. WebRTC Signaling: Call Accepted & Peer Answer
  socket.on("call_accepted", ({ consultationId, answer, targetUserId }) => {
    console.log(`[WebRTC] Call accepted in ${consultationId}`);
    const payload = { consultationId, answer };
    socket.to(`consultation:${consultationId}`).emit("call_accepted", payload);
    socket.to(`consultation:${consultationId}`).emit("peer_answer", payload);
    if (targetUserId) {
      socket.to(`user:${targetUserId}`).emit("call_accepted", payload);
      socket.to(`user:${targetUserId}`).emit("peer_answer", payload);
    }
  });

  socket.on("peer_answer", ({ consultationId, answer, targetUserId }) => {
    console.log(`[WebRTC] Peer answer relayed in ${consultationId}`);
    const payload = { consultationId, answer };
    socket.to(`consultation:${consultationId}`).emit("peer_answer", payload);
    socket.to(`consultation:${consultationId}`).emit("call_accepted", payload);
    if (targetUserId) {
      socket.to(`user:${targetUserId}`).emit("peer_answer", payload);
      socket.to(`user:${targetUserId}`).emit("call_accepted", payload);
    }
  });

  // 6. WebRTC Signaling: ICE Candidate relay
  socket.on("ice_candidate", ({ consultationId, candidate, targetUserId }) => {
    if (!consultationId || !candidate) return;
    const payload = { candidate };
    socket.to(`consultation:${consultationId}`).emit("ice_candidate", payload);
    if (targetUserId) {
      socket.to(`user:${targetUserId}`).emit("ice_candidate", payload);
    }
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

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.warn(`[Socket.IO Server] Port ${PORT} is already in use. A socket server is likely already running on port ${PORT}.`);
  } else {
    console.error("[Socket.IO Server] Server error:", err);
  }
});

server.listen(PORT, () => {
  console.log(`> Swasthya Socket.IO Signaling Server running on http://localhost:${PORT}`);
});
