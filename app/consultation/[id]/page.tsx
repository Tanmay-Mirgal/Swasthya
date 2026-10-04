"use client";

import { useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth, useUser } from "@clerk/react";
import { getSocket, joinConsultationRoom } from "@/lib/socket";
import { DEFAULT_RTC_CONFIG, getMediaStreamWithFallback } from "@/lib/webrtc";
import {
  ConsultationHeader,
  IncomingCallModal,
  VideoCallArea,
  VideoControls,
  ChatPanel,
  PrescriptionModal,
} from "@/components/consultation";
import {
  Message,
  IncomingCallData,
  ConsultationDetails,
  DoctorDetails,
  PatientDetails,
  PrescriptionMedicine,
  PrescriptionExercise,
} from "@/types/consultation";

export default function ConsultationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const consultationId = resolvedParams.id;
  const router = useRouter();
  const { getToken } = useAuth();
  const { user } = useUser();

  // Consultation, Doctor & Patient details
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [consultation, setConsultation] = useState<ConsultationDetails | null>(null);
  const [doctor, setDoctor] = useState<DoctorDetails | null>(null);
  const [patient, setPatient] = useState<PatientDetails | null>(null);

  // Authenticated Role
  const [activeRole, setActiveRole] = useState<"patient" | "doctor">("patient");

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false); // Mobile chat toggle
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Video call state
  const [callActive, setCallActive] = useState(false);
  const [callConnecting, setCallConnecting] = useState(false);
  const [hasRemoteStream, setHasRemoteStream] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(1);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");

  // WebRTC refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const iceCandidateQueueRef = useRef<RTCIceCandidateInit[]>([]);

  // Prescription modal state
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [submittingPrescription, setSubmittingPrescription] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [prescriptionSaved, setPrescriptionSaved] = useState(false);

  // Prescription form fields (with templates)
  const [medicines, setMedicines] = useState<PrescriptionMedicine[]>([
    {
      name: "Aceclofenac + Paracetamol",
      dosage: "1 tablet",
      frequency: "Twice daily after meals",
      duration: "5 days",
      instructions: "Take with water.",
    },
  ]);
  const [healthyTips, setHealthyTips] = useState<string[]>([
    "Maintain correct upright seated posture",
    "Apply cold gel pack for 10-15 minutes",
  ]);
  const [prescribedExercises, setPrescribedExercises] = useState<PrescriptionExercise[]>([
    {
      exerciseId: "seated-knee-extension",
      name: "Seated Leg Extension",
      sets: 3,
      reps: 10,
      duration: "10 mins",
      frequency: "Daily",
      instructions: "Hold top extension for 2 seconds.",
    },
    {
      exerciseId: "straight-leg-raise",
      name: "Straight Leg Raise",
      sets: 3,
      reps: 10,
      duration: "8 mins",
      frequency: "Daily",
      instructions: "Keep knee straight.",
    },
  ]);
  const [doctorNotes, setDoctorNotes] = useState(
    "Patient presented with mild patellofemoral irritation. Prescribed targeted quadriceps loading."
  );

  // Fetch initial data
  useEffect(() => {
    const fetchConsultation = async () => {
      try {
        const token = await getToken();
        const res = await fetch(`/api/consultation/${consultationId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await res.json();

        if (json.error === "Consultation not found") {
          setError("Consultation not found.");
          setLoading(false);
          return;
        }

        if (json.success) {
          setConsultation(json.data.consultation);
          setDoctor(json.data.doctor);
          if (json.data.patient) setPatient(json.data.patient);
          if (json.data.messages) setMessages(json.data.messages);
          if (json.data.prescription) setPrescriptionSaved(true);

          if (json.data.currentUserRole) setActiveRole(json.data.currentUserRole);
          if (user?.id) {
            if (
              user.id === json.data.consultation?.doctorId ||
              user.id === json.data.doctor?.clerkUserId
            ) {
              setActiveRole("doctor");
            } else if (user.id === json.data.consultation?.patientId) {
              setActiveRole("patient");
            }
          }
        } else {
          setError("You don't have access to this consultation.");
        }
      } catch (err) {
        console.error("Failed to load consultation:", err);
        setError("Unable to load consultation. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchConsultation();
  }, [consultationId, getToken, user?.id]);

  useEffect(() => {
    if (user?.id && consultation) {
      if (user.id === consultation.doctorId || user.id === doctor?.clerkUserId) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setActiveRole("doctor");
      } else if (user.id === consultation.patientId) {
        setActiveRole("patient");
      }
    }
  }, [user?.id, consultation, doctor]);

  function cleanupCall() {
    setCallActive(false);
    setCallConnecting(false);
    setHasRemoteStream(false);
    setIncomingCall(null);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    iceCandidateQueueRef.current = [];
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }

  // Socket.IO realtime connection
  useEffect(() => {
    const socket = getSocket();
    const currentUserId = user?.id || "guest_user";

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConnectionStatus(socket.connected ? "connected" : "connecting");

    socket.on("connect", () => setConnectionStatus("connected"));
    socket.on("connect_error", () => setConnectionStatus("disconnected"));
    socket.on("disconnect", () => setConnectionStatus("disconnected"));

    joinConsultationRoom(consultationId, currentUserId, activeRole);

    const onPresence = (data: { activeUserCount: number }) => {
      if (data.activeUserCount) setOnlineUsers(data.activeUserCount);
    };
    const onNewMessage = (msg: Message) =>
      setMessages((prev) =>
        prev.some((m) => m._id && m._id === msg._id) ? prev : [...prev, msg]
      );
    const onTyping = (data: { role: string; isTyping: boolean }) => {
      if (data.role !== activeRole) setPeerTyping(data.isTyping);
    };
    const onIncomingCall = (data: IncomingCallData) => {
      if (data.callerRole !== activeRole) setIncomingCall(data);
    };
    const onCallAccepted = async (data: { answer: RTCSessionDescriptionInit }) => {
      setCallConnecting(false);
      setCallActive(true);
      if (peerConnectionRef.current && data.answer) {
        try {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(data.answer)
          );
          while (iceCandidateQueueRef.current.length > 0) {
            const candidate = iceCandidateQueueRef.current.shift();
            if (candidate) {
              await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            }
          }
        } catch (err) {
          console.warn("RTC setRemote error:", err);
        }
      }
    };
    const onIceCandidate = async (data: { candidate: RTCIceCandidateInit }) => {
      if (peerConnectionRef.current && data.candidate) {
        try {
          if (peerConnectionRef.current.remoteDescription) {
            await peerConnectionRef.current.addIceCandidate(
              new RTCIceCandidate(data.candidate)
            );
          } else {
            iceCandidateQueueRef.current.push(data.candidate);
          }
        } catch (err) {
          console.warn("RTC addIceCandidate error:", err);
        }
      }
    };
    const onCallEnded = () => cleanupCall();
    const onPrescriptionReceived = (data: { message?: Message }) => {
      setPrescriptionSaved(true);
      if (data.message) {
        const msg = data.message;
        setMessages((prev) => [...prev, msg]);
      }
    };

    socket.on("presence_update", onPresence);
    socket.on("new_message", onNewMessage);
    socket.on("typing_update", onTyping);
    socket.on("incoming_call", onIncomingCall);
    socket.on("call_accepted", onCallAccepted);
    socket.on("ice_candidate", onIceCandidate);
    socket.on("call_ended", onCallEnded);
    socket.on("prescription_received", onPrescriptionReceived);

    return () => {
      socket.off("presence_update", onPresence);
      socket.off("new_message", onNewMessage);
      socket.off("typing_update", onTyping);
      socket.off("incoming_call", onIncomingCall);
      socket.off("call_accepted", onCallAccepted);
      socket.off("ice_candidate", onIceCandidate);
      socket.off("call_ended", onCallEnded);
      socket.off("prescription_received", onPrescriptionReceived);
      socket.off("connect");
      socket.off("connect_error");
      socket.off("disconnect");
    };
  }, [consultationId, activeRole, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, peerTyping, isChatOpen]);

  useEffect(() => {
    if (callActive) {
      callTimerRef.current = setInterval(
        () => setCallDuration((prev) => prev + 1),
        1000
      );
    } else {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCallDuration(0);
    }
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, [callActive]);

  const formatTime = (secs: number) =>
    `${Math.floor(secs / 60)
      .toString()
      .padStart(2, "0")}:${(secs % 60).toString().padStart(2, "0")}`;

  // Sync local camera stream to local video DOM element whenever active or connecting
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      if (localVideoRef.current.srcObject !== localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      localVideoRef.current.play().catch(() => {});
    }
  }, [callActive, callConnecting]);

  // WebRTC Call Initiation
  const startVideoCall = async () => {
    try {
      setCallConnecting(true);
      setHasRemoteStream(false);
      const socket = getSocket();
      const pc = new RTCPeerConnection(DEFAULT_RTC_CONFIG);
      peerConnectionRef.current = pc;

      const stream = await getMediaStreamWithFallback();
      localStreamRef.current = stream;
      if (localVideoRef.current && stream) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }
      if (stream) {
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      }

      pc.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
          remoteVideoRef.current.play().catch(() => {});
          setHasRemoteStream(true);
        }
      };
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice_candidate", {
            consultationId,
            candidate: event.candidate,
          });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("call_user", {
        consultationId,
        offer,
        callerName:
          activeRole === "patient"
            ? user?.fullName || "Patient"
            : doctor?.professionalName || "Doctor",
        callerRole: activeRole,
      });

      fetch(`/api/consultation/${consultationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callStatus: "calling" }),
      }).catch(console.warn);

      // Transition to active call state so user camera is visible and call controls are ready
      setTimeout(() => {
        setCallConnecting(false);
        setCallActive(true);
      }, 1500);
    } catch (err: unknown) {
      console.error("Failed to start call", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      alert(`Could not start video call: ${message}. Make sure you have camera permissions.`);
      setCallConnecting(false);
    }
  };

  const acceptIncomingCall = async () => {
    if (!incomingCall) return;
    try {
      setCallConnecting(true);
      const socket = getSocket();
      const pc = new RTCPeerConnection(DEFAULT_RTC_CONFIG);
      peerConnectionRef.current = pc;

      const stream = await getMediaStreamWithFallback();
      localStreamRef.current = stream;
      if (localVideoRef.current && stream) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }
      if (stream) {
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      }

      pc.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
          remoteVideoRef.current.play().catch(() => {});
          setHasRemoteStream(true);
        }
      };
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice_candidate", {
            consultationId,
            candidate: event.candidate,
          });
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      while (iceCandidateQueueRef.current.length > 0) {
        const candidate = iceCandidateQueueRef.current.shift();
        if (candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(err => {
            console.warn("RTC addIceCandidate queue error:", err);
          });
        }
      }
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("call_accepted", { consultationId, answer });
      setIncomingCall(null);
      setCallConnecting(false);
      setCallActive(true);

      fetch(`/api/consultation/${consultationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callStatus: "connected" }),
      }).catch(console.warn);
    } catch (err: unknown) {
      console.error("Error accepting call", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      alert(`Could not accept video call: ${message}. Make sure you have camera permissions.`);
      setCallConnecting(false);
      setIncomingCall(null);
    }
  };

  const rejectIncomingCall = () => {
    getSocket().emit("call_rejected", {
      consultationId,
      reason: "Call declined",
    });
    setIncomingCall(null);
  };

  const endVideoCall = async () => {
    getSocket().emit("end_call", { consultationId, duration: callDuration });
    cleanupCall();
    if (activeRole === "doctor") setShowPrescriptionModal(true);
    fetch(`/api/consultation/${consultationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callStatus: "ended", duration: callDuration }),
    }).catch(console.warn);
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoDisabled(!videoTrack.enabled);
      }
    }
  };

  // Chat Send
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const text = inputText.trim();
    setInputText("");

    const tempId = `temp-${Date.now()}`;
    const newMsg: Message = {
      _id: tempId,
      senderId:
        user?.id || (activeRole === "patient" ? "patient_id" : "doctor_id"),
      senderRole: activeRole,
      content: text,
      type: "text",
      createdAt: new Date().toISOString(),
    };

    // Optimistic UI Update
    setMessages((prev) => [...prev, newMsg]);

    getSocket().emit("send_message", { ...newMsg, consultationId });
    getSocket().emit("typing", {
      consultationId,
      userId: user?.id || "user",
      role: activeRole,
      isTyping: false,
    });

    fetch(`/api/consultation/${consultationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newMsg),
    }).catch(console.warn);
  };

  const handleInputChange = (val: string) => {
    setInputText(val);
    const socket = getSocket();
    if (!isTyping) {
      setIsTyping(true);
      socket.emit("typing", {
        consultationId,
        userId: user?.id || "user",
        role: activeRole,
        isTyping: true,
      });
    }
    setTimeout(() => {
      setIsTyping(false);
      socket.emit("typing", {
        consultationId,
        userId: user?.id || "user",
        role: activeRole,
        isTyping: false,
      });
    }, 2000);
  };

  const handleSubmitPrescription = async () => {
    setSubmittingPrescription(true);
    try {
      const res = await fetch(`/api/consultation/${consultationId}/prescription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medicines,
          healthyTips,
          exercises: prescribedExercises,
          doctorNotes,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setPrescriptionSaved(true);
        setShowPrescriptionModal(false);
        getSocket().emit("prescription_published", {
          consultationId,
          prescription: json.data.prescription,
          message: json.data.message,
        });
      }
    } catch {
      alert("Error sending prescription.");
    } finally {
      setSubmittingPrescription(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 w-screen h-screen bg-[#0B0C10] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 w-screen h-screen bg-[#0B0C10] flex flex-col items-center justify-center p-6 text-center gap-4">
        <AlertCircle className="w-10 h-10 text-rose-500" />
        <p className="text-slate-200 font-medium">{error}</p>
        <Button onClick={() => router.push("/")} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-2.5 rounded-xl">
          Return Home
        </Button>
      </div>
    );
  }

  const isCompleted = consultation?.status === "COMPLETED";
  const peerName =
    activeRole === "patient" ? doctor?.professionalName : patient?.name;

  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#0B0C10] text-slate-100 overflow-hidden font-sans flex select-none">
      {/* === MAIN VIDEO AREA === */}
      <div className="flex-1 h-full relative bg-[#0B0C10] overflow-hidden flex flex-col">
        {/* We keep it relative, VideoCallArea will be absolute inset-0 or just flex-1 */}
        <VideoCallArea
          callActive={callActive}
          callConnecting={callConnecting}
          hasRemoteStream={hasRemoteStream}
          isCompleted={isCompleted}
          peerName={peerName}
          onlineUsers={onlineUsers}
          callDuration={callDuration}
          formatTime={formatTime}
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          isMuted={isMuted}
          isVideoDisabled={isVideoDisabled}
          onStartCall={startVideoCall}
        />

        <ConsultationHeader
          peerName={peerName}
          activeRole={activeRole}
          onlineUsers={onlineUsers}
          isCompleted={isCompleted}
          callActive={callActive}
          onBack={() => router.back()}
          onOpenPrescriptionModal={() => setShowPrescriptionModal(true)}
        />

        <IncomingCallModal
          incomingCall={incomingCall && !callActive ? incomingCall : null}
          onAccept={acceptIncomingCall}
          onReject={rejectIncomingCall}
        />

        <VideoControls
          callActive={callActive}
          connectionStatus={connectionStatus}
          isMuted={isMuted}
          isVideoDisabled={isVideoDisabled}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
          onEndCall={endVideoCall}
          onOpenChat={() => setIsChatOpen(true)}
        />
      </div>

      {/* === SIDE CHAT PANEL === */}
      <ChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={messages}
        activeRole={activeRole}
        doctorName={doctor?.professionalName}
        patientName={patient?.name}
        peerTyping={peerTyping}
        inputText={inputText}
        onInputChange={handleInputChange}
        onSendMessage={handleSendMessage}
        messagesEndRef={messagesEndRef}
      />

      {/* === DOCTOR PRESCRIPTION MODAL === */}
      {activeRole === "doctor" && (
        <PrescriptionModal
          isOpen={showPrescriptionModal}
          onClose={() => setShowPrescriptionModal(false)}
          medicines={medicines}
          setMedicines={setMedicines}
          prescribedExercises={prescribedExercises}
          setPrescribedExercises={setPrescribedExercises}
          healthyTips={healthyTips}
          setHealthyTips={setHealthyTips}
          doctorNotes={doctorNotes}
          setDoctorNotes={setDoctorNotes}
          onSubmit={handleSubmitPrescription}
          submitting={submittingPrescription}
        />
      )}
    </div>
  );
}
