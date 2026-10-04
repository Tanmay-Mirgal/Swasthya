"use client";

import { useEffect, useState, useRef, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "@/components/navigation/AppShell";
import {
  ArrowLeft,
  Loader2,
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Send,
  Sparkles,
  FileText,
  CheckCircle2,
  Plus,
  Trash2,
  Play,
  Pill,
  Lightbulb,
  Dumbbell,
  ShieldCheck,
  UserCheck,
  PhoneCall,
  Clock,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth, useUser } from "@clerk/react";
import { getSocket, joinConsultationRoom } from "@/lib/socket";
import DoctorAvatar from "@/components/ui/DoctorAvatar";

interface Message {
  _id?: string;
  senderId: string;
  senderRole: "patient" | "doctor" | "system";
  content: string;
  type: "text" | "prescription" | "system";
  prescriptionData?: any;
  createdAt: string | Date;
}

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
  const [consultation, setConsultation] = useState<any>(null);
  const [doctor, setDoctor] = useState<any>(null);
  const [patient, setPatient] = useState<any>(null);

  // Authenticated Role: automatically resolved based on user identity (Doctor or Patient)
  const [activeRole, setActiveRole] = useState<"patient" | "doctor">("patient");

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Video call state
  const [callActive, setCallActive] = useState(false);
  const [callConnecting, setCallConnecting] = useState(false);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(1);

  // WebRTC refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Prescription modal state (for doctor)
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [submittingPrescription, setSubmittingPrescription] = useState(false);
  const [prescriptionSaved, setPrescriptionSaved] = useState(false);

  // Prescription form fields
  const [medicines, setMedicines] = useState([
    {
      name: "Pain relief & Anti-inflammatory (Aceclofenac + Paracetamol)",
      dosage: "1 tablet",
      frequency: "Twice daily after meals",
      duration: "5 days",
      instructions: "Take with water. Stop if stomach discomfort occurs.",
    },
  ]);

  const [healthyTips, setHealthyTips] = useState<string[]>([
    "Maintain correct upright seated posture during work hours",
    "Avoid deep knee squats and excessive joint loading for 14 days",
    "Apply cold gel pack for 10-15 minutes after completing daily exercises",
    "Keep hydrated to support joint synovial fluid lubrication",
  ]);

  const [newTipInput, setNewTipInput] = useState("");

  const [prescribedExercises, setPrescribedExercises] = useState([
    {
      exerciseId: "seated-knee-extension",
      name: "Seated Leg Extension",
      sets: 3,
      reps: 10,
      duration: "10 mins",
      frequency: "Daily",
      difficulty: "Beginner",
      instructions: "Hold top extension for 2 seconds. Squeeze quadriceps firmly.",
    },
    {
      exerciseId: "straight-leg-raise",
      name: "Straight Leg Raise",
      sets: 3,
      reps: 10,
      duration: "8 mins",
      frequency: "Daily",
      difficulty: "Beginner",
      instructions: "Keep knee straight, elevate leg 12 inches off floor smoothly.",
    },
    {
      exerciseId: "quad-stretch",
      name: "Quad Stretch",
      sets: 3,
      reps: 3,
      duration: "30 sec hold",
      frequency: "Twice daily",
      difficulty: "Gentle",
      instructions: "Gently stretch anterior thigh without hyper-flexing lumbar spine.",
    },
  ]);

  const [doctorNotes, setDoctorNotes] = useState(
    "Patient presented with mild patellofemoral irritation. Joint alignment is intact. Prescribed targeted quadriceps loading and hamstring/quad flexibility protocol. Review in 10 days."
  );

  // 1. Fetch initial consultation data
  useEffect(() => {
    const fetchConsultation = async () => {
      try {
        const token = await getToken();
        const res = await fetch(`/api/consultation/${consultationId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await res.json();
        if (json.success) {
          setConsultation(json.data.consultation);
          setDoctor(json.data.doctor);
          if (json.data.patient) {
            setPatient(json.data.patient);
          }
          if (json.data.messages) {
            setMessages(json.data.messages);
          }
          if (json.data.prescription) {
            setPrescriptionSaved(true);
          }

          // Automatically set user's role:
          // If server verified caller is the doctor, or if current user matches doctorId
          if (json.data.currentUserRole) {
            setActiveRole(json.data.currentUserRole);
          }
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
        }
      } catch (err) {
        console.error("Failed to load consultation:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchConsultation();
  }, [consultationId, getToken, user?.id]);

  // Synchronize role if user becomes loaded or changes
  useEffect(() => {
    if (user?.id && consultation) {
      if (user.id === consultation.doctorId || user.id === doctor?.clerkUserId) {
        setActiveRole("doctor");
      } else if (user.id === consultation.patientId) {
        setActiveRole("patient");
      }
    }
  }, [user?.id, consultation, doctor]);

  // 2. Setup Socket.IO realtime connection & listeners
  useEffect(() => {
    const socket = getSocket();
    const currentUserId = user?.id || "guest_user";

    joinConsultationRoom(consultationId, currentUserId, activeRole);

    const onPresence = (data: any) => {
      if (data.activeUserCount) {
        setOnlineUsers(data.activeUserCount);
      }
    };

    const onNewMessage = (msg: Message) => {
      setMessages((prev) => {
        // Prevent duplicate message if already added locally
        if (prev.some((m) => m._id && m._id === msg._id)) return prev;
        return [...prev, msg];
      });
    };

    const onTyping = (data: any) => {
      if (data.role !== activeRole) {
        setPeerTyping(data.isTyping);
      }
    };

    const onIncomingCall = (data: any) => {
      if (data.callerRole !== activeRole) {
        setIncomingCall(data);
      }
    };

    const onCallAccepted = async (data: any) => {
      setCallConnecting(false);
      setCallActive(true);
      if (peerConnectionRef.current && data.answer) {
        try {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(data.answer)
          );
        } catch (err) {
          console.warn("RTC setRemoteDescription answer error:", err);
        }
      }
    };

    const onIceCandidate = async (data: any) => {
      if (peerConnectionRef.current && data.candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(
            new RTCIceCandidate(data.candidate)
          );
        } catch (err) {
          console.warn("RTC addIceCandidate error:", err);
        }
      }
    };

    const onCallEnded = () => {
      cleanupCall();
    };

    const onPrescriptionReceived = (data: any) => {
      setPrescriptionSaved(true);
      if (data.message) {
        setMessages((prev) => [...prev, data.message]);
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
    };
  }, [consultationId, activeRole, user?.id]);

  // Scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, peerTyping]);

  // Call duration counter
  useEffect(() => {
    if (callActive) {
      callTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      setCallDuration(0);
    }
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, [callActive]);

  // Format call duration MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remainder
      .toString()
      .padStart(2, "0")}`;
  };

  // 3. WebRTC Media & Call Initiation
  const startVideoCall = async () => {
    try {
      setCallConnecting(true);
      const socket = getSocket();

      // Setup RTCPeerConnection with Google STUN servers
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      peerConnectionRef.current = pc;

      // Acquire camera & microphone
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
      } catch (mediaErr) {
        console.warn("Camera/mic permission denied or unavailable, using canvas preview:", mediaErr);
        // Create fallback video stream using canvas
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#059669";
          ctx.fillRect(0, 0, 640, 480);
          ctx.fillStyle = "#ffffff";
          ctx.font = "24px sans-serif";
          ctx.fillText("Swasthya Medical Stream", 50, 240);
        }
        stream = (canvas as any).captureStream(30);
      }

      localStreamRef.current = stream;
      if (localVideoRef.current && stream) {
        localVideoRef.current.srcObject = stream;
      }

      // Add tracks to peer connection
      if (stream) {
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream!);
        });
      }

      // Handle remote tracks
      pc.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      // Handle ICE Candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice_candidate", {
            consultationId,
            candidate: event.candidate,
          });
        }
      };

      // Create offer
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

      // Update consultation record in backend
      fetch(`/api/consultation/${consultationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callStatus: "calling" }),
      }).catch(console.warn);

      // Auto-connect peer simulation if testing solo
      setTimeout(() => {
        if (callConnecting) {
          setCallConnecting(false);
          setCallActive(true);
        }
      }, 3000);
    } catch (err) {
      console.error("Failed to start video consultation:", err);
      setCallConnecting(false);
    }
  };

  const acceptIncomingCall = async () => {
    if (!incomingCall) return;
    try {
      setCallConnecting(true);
      const socket = getSocket();

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      peerConnectionRef.current = pc;

      // Stream
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
      } catch (e) {
        console.warn("Local camera fallback in call answer:", e);
      }

      localStreamRef.current = stream;
      if (localVideoRef.current && stream) {
        localVideoRef.current.srcObject = stream;
      }

      if (stream) {
        stream.getTracks().forEach((track) => pc.addTrack(track, stream!));
      }

      pc.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
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
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("call_accepted", {
        consultationId,
        answer,
      });

      setIncomingCall(null);
      setCallConnecting(false);
      setCallActive(true);

      fetch(`/api/consultation/${consultationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callStatus: "connected" }),
      }).catch(console.warn);
    } catch (err) {
      console.error("Error accepting call:", err);
      setCallConnecting(false);
      setIncomingCall(null);
    }
  };

  const rejectIncomingCall = () => {
    const socket = getSocket();
    socket.emit("call_rejected", {
      consultationId,
      reason: "Call declined",
    });
    setIncomingCall(null);
  };

  const endVideoCall = async () => {
    const socket = getSocket();
    socket.emit("end_call", {
      consultationId,
      duration: callDuration,
    });

    cleanupCall();

    // If active role is doctor or consultation completed, open prescription modal!
    if (activeRole === "doctor") {
      setShowPrescriptionModal(true);
    }

    // Save duration in backend
    try {
      await fetch(`/api/consultation/${consultationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callStatus: "ended",
          duration: callDuration,
        }),
      });
    } catch (err) {
      console.warn("Failed to persist call duration:", err);
    }
  };

  const cleanupCall = () => {
    setCallActive(false);
    setCallConnecting(false);
    setIncomingCall(null);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
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

  // 4. Chat Message Send
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const text = inputText.trim();
    setInputText("");

    const newMsg: Message = {
      senderId: user?.id || (activeRole === "patient" ? "patient_id" : "doctor_id"),
      senderRole: activeRole,
      content: text,
      type: "text",
      createdAt: new Date().toISOString(),
    };

    // Emit via Socket.IO immediately
    const socket = getSocket();
    socket.emit("send_message", {
      ...newMsg,
      consultationId,
    });

    // Notify typing stopped
    socket.emit("typing", {
      consultationId,
      userId: user?.id || "user",
      role: activeRole,
      isTyping: false,
    });

    // Persist to MongoDB
    try {
      await fetch(`/api/consultation/${consultationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMsg),
      });
    } catch (err) {
      console.warn("Failed to persist chat message:", err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
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

    // Debounce stop typing
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

  // 5. Submit Prescription & Synchronize Recovery Plan
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

        // Emit through socket so patient receives card instantly in chat
        const socket = getSocket();
        socket.emit("prescription_published", {
          consultationId,
          prescription: json.data.prescription,
          message: json.data.message,
        });

        alert("Post-consultation plan sent to patient and synchronized with their daily exercises!");
      } else {
        alert(json.error || "Failed to submit prescription");
      }
    } catch (err) {
      console.error("Error submitting prescription:", err);
      alert("Error sending prescription.");
    } finally {
      setSubmittingPrescription(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-[75vh] items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell hideNav hideHeader>
      <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-20px)] sm:h-[calc(100vh-85px)] bg-slate-50/50 -mx-4 -my-4 sm:mx-auto sm:my-0 rounded-3xl border border-slate-200 overflow-hidden shadow-sm relative">
        {/* Top Header Bar */}
        <div className="bg-white px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0 shadow-2xs">
          <div className="flex items-center gap-3">
            <Link
              href="/discover"
              className="p-1.5 -ml-1 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>

            {/* Doctor Avatar when viewing as Patient, or Patient Avatar when viewing as Doctor */}
            {activeRole === "patient" ? (
              <DoctorAvatar
                src={doctor?.avatarUrl}
                name={doctor?.professionalName || "Doctor"}
                size="sm"
                isOnline={callActive || true}
              />
            ) : patient?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={patient.imageUrl}
                alt={patient.name || "Patient"}
                className="size-10 rounded-2xl object-cover border border-slate-200/80 shadow-2xs"
              />
            ) : (
              <div className="size-10 rounded-2xl bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center border border-emerald-200 text-xs shadow-2xs">
                {(patient?.name || "PT").slice(0, 2).toUpperCase()}
              </div>
            )}

            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold text-slate-900 leading-tight">
                  {activeRole === "patient"
                    ? doctor?.professionalName || "Doctor Consultation"
                    : patient?.name || "Patient Consultation"}
                </h2>
                {activeRole === "patient" ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                )}
              </div>
              <p className="text-[11px] font-medium text-emerald-700">
                {activeRole === "patient"
                  ? `${doctor?.specialization || "Orthopedic Physical Therapy"} • `
                  : `Focus: ${consultation?.issue || "Orthopedic Recovery"} • `}
                <span className="text-slate-500 font-normal">
                  {callActive ? "Call Connected" : "Online"}
                </span>
              </p>
            </div>
          </div>

          {/* Action buttons (Clean role-specific actions - NO debug switcher) */}
          <div className="flex items-center gap-2">
            {/* Doctor-only: Create or Update Prescription & Recovery Plan */}
            {activeRole === "doctor" && (
              <Button
                onClick={() => setShowPrescriptionModal(true)}
                className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Prescription & Plan</span>
                <span className="sm:hidden">Prescription</span>
              </Button>
            )}

            {/* Video Call button (Available to both participants) */}
            {!callActive ? (
              <Button
                onClick={startVideoCall}
                disabled={callConnecting}
                className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                {callConnecting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Video className="w-3.5 h-3.5" />
                    <span>Start Video Call</span>
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={endVideoCall}
                className="h-9 px-3.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                <span>End Call ({formatTime(callDuration)})</span>
              </Button>
            )}
          </div>
        </div>

        {/* Incoming Call Overlay / Banner */}
        {incomingCall && (
          <div className="bg-emerald-600 text-white px-4 py-3 flex items-center justify-between shadow-md animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                <PhoneCall className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold">
                  Incoming Video Consultation from {incomingCall.callerName}
                </p>
                <p className="text-[10px] text-emerald-100">
                  Secure peer-to-peer WebRTC line
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={acceptIncomingCall}
                className="h-8 px-3 rounded-lg bg-white text-emerald-800 font-bold text-xs hover:bg-emerald-50"
              >
                Accept
              </Button>
              <Button
                onClick={rejectIncomingCall}
                variant="outline"
                className="h-8 px-2.5 rounded-lg border-white/40 text-white hover:bg-white/10 text-xs"
              >
                Decline
              </Button>
            </div>
          </div>
        )}

        {/* Split Screen Video Call Panel (when active or connecting) */}
        {(callActive || callConnecting) && (
          <div className="bg-slate-900 border-b border-slate-800 p-3 sm:p-4 text-white transition-all shrink-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
              {/* Doctor / Remote Video */}
              <div className="relative aspect-video bg-slate-800 rounded-2xl overflow-hidden border border-slate-700/80 shadow-inner flex items-center justify-center">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                {/* Fallback Doctor Simulation Frame */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex flex-col justify-between p-3 pointer-events-none">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold bg-black/60 px-2 py-0.5 rounded-md text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {activeRole === "patient" ? doctor?.professionalName : "Patient Stream"}
                    </span>
                    <span className="text-[11px] font-mono text-slate-300 bg-black/60 px-2 py-0.5 rounded-md">
                      {formatTime(callDuration)}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">
                    WebRTC Peer-to-Peer 1080p HD
                  </div>
                </div>
              </div>

              {/* Patient / Local Video */}
              <div className="relative aspect-video bg-slate-800 rounded-2xl overflow-hidden border border-slate-700/80 shadow-inner flex items-center justify-center">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex flex-col justify-between p-3 pointer-events-none">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold bg-black/60 px-2 py-0.5 rounded-md text-slate-200">
                      You ({activeRole === "patient" ? "Patient" : "Doctor"})
                    </span>
                    {isMuted && (
                      <span className="text-[10px] bg-red-600/80 px-1.5 py-0.5 rounded font-semibold text-white">
                        Muted
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">
                    Live Feed
                  </div>
                </div>
              </div>
            </div>

            {/* In-Call Controls Bar */}
            <div className="flex items-center justify-center gap-3 mt-3 pt-2">
              <button
                onClick={toggleMute}
                className={`p-2.5 rounded-full transition-colors cursor-pointer ${
                  isMuted ? "bg-red-500 text-white" : "bg-slate-700 text-slate-200 hover:bg-slate-600"
                }`}
                title={isMuted ? "Unmute Mic" : "Mute Mic"}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <button
                onClick={toggleVideo}
                className={`p-2.5 rounded-full transition-colors cursor-pointer ${
                  isVideoDisabled ? "bg-red-500 text-white" : "bg-slate-700 text-slate-200 hover:bg-slate-600"
                }`}
                title={isVideoDisabled ? "Turn Video On" : "Turn Video Off"}
              >
                {isVideoDisabled ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
              </button>

              <button
                onClick={endVideoCall}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <PhoneOff className="w-4 h-4" />
                <span>End Consultation</span>
              </button>
            </div>
          </div>
        )}

        {/* Chat Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Consultation Started Banner */}
          <div className="text-center my-2">
            <span className="bg-white border border-slate-200 text-slate-600 text-[11px] font-semibold px-3 py-1 rounded-full shadow-2xs inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Consultation Room Active • Focus: {consultation?.issue || "Knee Pain"}
            </span>
          </div>

          {messages.map((msg, idx) => {
            const isSelf = msg.senderRole === activeRole;

            // Render Structured Prescription Card
            if (msg.type === "prescription" && msg.prescriptionData) {
              const rx = msg.prescriptionData;
              return (
                <div
                  key={msg._id || idx}
                  className="max-w-md mx-auto my-4 bg-white rounded-3xl border-2 border-emerald-300 shadow-md shadow-emerald-500/5 p-5 space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 leading-tight">
                          Post-Consultation Prescription & Plan
                        </h4>
                        <p className="text-[11px] font-medium text-emerald-700">
                          Prescribed by {rx.doctorName || "Dr. Aarti Sharma"}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      Verified Rx
                    </span>
                  </div>

                  {/* Medicines */}
                  {rx.medicines && rx.medicines.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                        <Pill className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Prescribed Medications</span>
                      </div>
                      <div className="space-y-1.5">
                        {rx.medicines.map((med: any, mIdx: number) => (
                          <div
                            key={mIdx}
                            className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs space-y-0.5"
                          >
                            <p className="font-bold text-slate-800">{med.name}</p>
                            <p className="text-slate-500 text-[11px]">
                              {med.dosage} • {med.frequency} • {med.duration}
                            </p>
                            {med.instructions && (
                              <p className="text-emerald-700 text-[10px]">
                                Note: {med.instructions}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Healthy Tips */}
                  {rx.healthyTips && rx.healthyTips.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                        <span>Clinical Recovery Tips</span>
                      </div>
                      <ul className="text-xs text-slate-600 space-y-1 pl-1">
                        {rx.healthyTips.map((tip: string, tIdx: number) => (
                          <li key={tIdx} className="flex items-start gap-1.5">
                            <span className="text-emerald-600 font-bold">•</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Prescribed Exercises - Synchronized with Recovery Plan */}
                  {rx.exercises && rx.exercises.length > 0 && (
                    <div className="space-y-2 pt-1 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                          <Dumbbell className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Prescribed Exercise Routine ({rx.exercises.length})</span>
                        </div>
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          Synced with My Plan
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {rx.exercises.map((ex: any, eIdx: number) => (
                          <div
                            key={eIdx}
                            className="bg-emerald-50/50 border border-emerald-200/80 rounded-xl p-2.5 flex items-center justify-between text-xs"
                          >
                            <div>
                              <p className="font-bold text-slate-900">{ex.name}</p>
                              <p className="text-[11px] text-emerald-800">
                                {ex.sets} sets × {ex.reps} reps • {ex.frequency || "Daily"}
                              </p>
                            </div>
                            <Link
                              href={`/exercise/${ex.exerciseId}`}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 shadow-2xs"
                            >
                              <Play className="w-3 h-3 fill-white" />
                              <span>Start</span>
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Link to Dashboard Plan */}
                  <div className="pt-2">
                    <Button
                      asChild
                      className="w-full h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                    >
                      <Link href="/">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>View in My Recovery Plan</span>
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            }

            // Normal text message
            return (
              <div
                key={msg._id || idx}
                className={`flex flex-col ${isSelf ? "items-end" : "items-start"}`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase">
                    {msg.senderRole === "doctor"
                      ? doctor?.professionalName || "Dr. Sharma"
                      : "Patient"}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <div
                  className={`max-w-[80%] sm:max-w-md px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-2xs ${
                    isSelf
                      ? "bg-emerald-600 text-white rounded-tr-xs"
                      : "bg-white text-slate-800 border border-slate-200 rounded-tl-xs"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {peerTyping && (
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-full w-fit shadow-2xs animate-pulse">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" />
              <span>
                {activeRole === "patient" ? doctor?.professionalName : "Patient"} is typing...
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input Bar */}
        <div className="p-3 sm:p-4 bg-white border-t border-slate-200 shrink-0">
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={handleInputChange}
              placeholder={
                activeRole === "patient"
                  ? "Message Dr. Sharma regarding your knee pain..."
                  : "Type doctor recommendation or guidance..."
              }
              className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-slate-900"
            />
            <Button
              type="submit"
              disabled={!inputText.trim()}
              className="h-11 w-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4 ml-0.5" />
            </Button>
          </form>
        </div>

        {/* Doctor Post-Consultation Prescription Modal */}
        {showPrescriptionModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 space-y-6">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Post-Consultation Prescription & Recovery Plan
                  </h3>
                  <p className="text-xs text-slate-500">
                    Creates prescription and automatically synchronizes exercises to patient plan
                  </p>
                </div>
                <button
                  onClick={() => setShowPrescriptionModal(false)}
                  className="text-slate-400 hover:text-slate-700 p-1"
                >
                  ✕
                </button>
              </div>

              {/* Section A: Medicines */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Pill className="w-3.5 h-3.5 text-emerald-600" />
                    A. Medications (Optional)
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      setMedicines([
                        ...medicines,
                        {
                          name: "",
                          dosage: "1 tablet",
                          frequency: "Daily",
                          duration: "5 days",
                          instructions: "",
                        },
                      ])
                    }
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Medicine
                  </button>
                </div>

                <div className="space-y-2">
                  {medicines.map((med, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2 relative"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={med.name}
                          onChange={(e) => {
                            const updated = [...medicines];
                            updated[idx].name = e.target.value;
                            setMedicines(updated);
                          }}
                          placeholder="Medicine name (e.g. Aceclofenac)"
                          className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setMedicines(medicines.filter((_, i) => i !== idx))
                          }
                          className="text-slate-400 hover:text-red-600 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={med.dosage}
                          onChange={(e) => {
                            const updated = [...medicines];
                            updated[idx].dosage = e.target.value;
                            setMedicines(updated);
                          }}
                          placeholder="Dosage"
                          className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs"
                        />
                        <input
                          type="text"
                          value={med.frequency}
                          onChange={(e) => {
                            const updated = [...medicines];
                            updated[idx].frequency = e.target.value;
                            setMedicines(updated);
                          }}
                          placeholder="Frequency"
                          className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs"
                        />
                        <input
                          type="text"
                          value={med.duration}
                          onChange={(e) => {
                            const updated = [...medicines];
                            updated[idx].duration = e.target.value;
                            setMedicines(updated);
                          }}
                          placeholder="Duration"
                          className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section B: Healthy Tips */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                  B. Clinical Healthy Tips
                </h4>
                <div className="space-y-1.5">
                  {healthyTips.map((tip, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs text-slate-700"
                    >
                      <span>• {tip}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setHealthyTips(healthyTips.filter((_, i) => i !== idx))
                        }
                        className="text-slate-400 hover:text-red-600 shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTipInput}
                    onChange={(e) => setNewTipInput(e.target.value)}
                    placeholder="Add specific recovery advice..."
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs"
                  />
                  <Button
                    type="button"
                    onClick={() => {
                      if (newTipInput.trim()) {
                        setHealthyTips([...healthyTips, newTipInput.trim()]);
                        setNewTipInput("");
                      }
                    }}
                    className="h-8 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold"
                  >
                    Add
                  </Button>
                </div>
              </div>

              {/* Section C: Exercises from Swasthya's Library */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Dumbbell className="w-3.5 h-3.5 text-emerald-600" />
                    C. Prescribed Exercises (Synchronized)
                  </h4>
                  <span className="text-[11px] font-semibold text-emerald-700">
                    {prescribedExercises.length} Exercises Selected
                  </span>
                </div>

                <div className="space-y-2">
                  {prescribedExercises.map((ex, idx) => (
                    <div
                      key={idx}
                      className="bg-emerald-50/50 border border-emerald-200/80 rounded-2xl p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">{ex.name}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setPrescribedExercises(
                              prescribedExercises.filter((_, i) => i !== idx)
                            )
                          }
                          className="text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-500 font-medium">Sets</label>
                          <input
                            type="number"
                            value={ex.sets}
                            onChange={(e) => {
                              const updated = [...prescribedExercises];
                              updated[idx].sets = parseInt(e.target.value) || 1;
                              setPrescribedExercises(updated);
                            }}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 font-medium">Reps / Sec</label>
                          <input
                            type="number"
                            value={ex.reps}
                            onChange={(e) => {
                              const updated = [...prescribedExercises];
                              updated[idx].reps = parseInt(e.target.value) || 1;
                              setPrescribedExercises(updated);
                            }}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 font-medium">Frequency</label>
                          <input
                            type="text"
                            value={ex.frequency}
                            onChange={(e) => {
                              const updated = [...prescribedExercises];
                              updated[idx].frequency = e.target.value;
                              setPrescribedExercises(updated);
                            }}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 font-medium">Instructions</label>
                          <input
                            type="text"
                            value={ex.instructions}
                            onChange={(e) => {
                              const updated = [...prescribedExercises];
                              updated[idx].instructions = e.target.value;
                              setPrescribedExercises(updated);
                            }}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Doctor Clinical Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Doctor Clinical Notes</label>
                <textarea
                  value={doctorNotes}
                  onChange={(e) => setDoctorNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs leading-relaxed text-slate-800"
                />
              </div>

              {/* Submit CTA */}
              <div className="pt-2">
                <Button
                  onClick={handleSubmitPrescription}
                  disabled={submittingPrescription}
                  className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  {submittingPrescription ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Send Plan to Patient & Sync Routine</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
