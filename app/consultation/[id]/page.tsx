"use client";

import { useEffect, useState, useRef, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "@/components/navigation/AppShell";
import {
  ArrowLeft, Loader2, Video, VideoOff, Mic, MicOff, PhoneOff, Send, Sparkles, FileText,
  CheckCircle2, Plus, Trash2, Pill, Lightbulb, Dumbbell, ShieldCheck, UserCheck,
  PhoneCall, MessageSquare, X, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth, useUser } from "@clerk/react";
import { getSocket, joinConsultationRoom } from "@/lib/socket";

interface Message {
  _id?: string;
  senderId: string;
  senderRole: "patient" | "doctor" | "system";
  content: string;
  type: "text" | "prescription" | "system";
  prescriptionData?: { doctorName?: string; medicines?: { name: string; dosage: string; frequency: string; duration: string }[]; exercises?: { name: string; sets: number; reps: number }[]; healthyTips?: string[] };
  createdAt: string | Date;
}

export default function ConsultationPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const consultationId = resolvedParams.id;
  const router = useRouter();
  const { getToken } = useAuth();
  const { user } = useUser();

  // Consultation, Doctor & Patient details
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [consultation, setConsultation] = useState<{ doctorId?: string; patientId?: string; status?: string } | null>(null);
  const [doctor, setDoctor] = useState<{ professionalName?: string; clerkUserId?: string; user?: { imageUrl?: string; firstName?: string; lastName?: string } } | null>(null);
  const [patient, setPatient] = useState<{ name?: string } | null>(null);

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
  const [incomingCall, setIncomingCall] = useState<{ callerName: string; callerRole: string; offer: RTCSessionDescriptionInit } | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(1);
  const [connectionStatus, setConnectionStatus] = useState<"connecting"|"connected"|"disconnected">("connecting");

  // WebRTC refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Prescription modal state
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [submittingPrescription, setSubmittingPrescription] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [prescriptionSaved, setPrescriptionSaved] = useState(false);

  // Prescription form fields (with templates)
  const [medicines, setMedicines] = useState([{ name: "Aceclofenac + Paracetamol", dosage: "1 tablet", frequency: "Twice daily after meals", duration: "5 days", instructions: "Take with water." }]);
  const [healthyTips, setHealthyTips] = useState(["Maintain correct upright seated posture", "Apply cold gel pack for 10-15 minutes"]);
  const [newTipInput, setNewTipInput] = useState("");
  const [prescribedExercises, setPrescribedExercises] = useState([
    { exerciseId: "seated-knee-extension", name: "Seated Leg Extension", sets: 3, reps: 10, duration: "10 mins", frequency: "Daily", instructions: "Hold top extension for 2 seconds." },
    { exerciseId: "straight-leg-raise", name: "Straight Leg Raise", sets: 3, reps: 10, duration: "8 mins", frequency: "Daily", instructions: "Keep knee straight." }
  ]);
  const [doctorNotes, setDoctorNotes] = useState("Patient presented with mild patellofemoral irritation. Prescribed targeted quadriceps loading.");

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
            if (user.id === json.data.consultation?.doctorId || user.id === json.data.doctor?.clerkUserId) {
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
    setCallActive(false); setCallConnecting(false); setIncomingCall(null);
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach((t) => t.stop()); localStreamRef.current = null; }
    if (peerConnectionRef.current) { peerConnectionRef.current.close(); peerConnectionRef.current = null; }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }

  // Socket.IO realtime connection
  useEffect(() => {
    const socket = getSocket();
    const currentUserId = user?.id || "guest_user";
    
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConnectionStatus("connected");

    socket.on("connect", () => setConnectionStatus("connected"));
    socket.on("disconnect", () => setConnectionStatus("disconnected"));

    joinConsultationRoom(consultationId, currentUserId, activeRole);

    const onPresence = (data: { activeUserCount: number }) => { if (data.activeUserCount) setOnlineUsers(data.activeUserCount); };
    const onNewMessage = (msg: Message) => setMessages((prev) => prev.some((m) => m._id && m._id === msg._id) ? prev : [...prev, msg]);
    const onTyping = (data: { role: string; isTyping: boolean }) => { if (data.role !== activeRole) setPeerTyping(data.isTyping); };
    const onIncomingCall = (data: { callerRole: string; callerName: string; offer: RTCSessionDescriptionInit }) => { if (data.callerRole !== activeRole) setIncomingCall(data); };
    const onCallAccepted = async (data: { answer: RTCSessionDescriptionInit }) => {
      setCallConnecting(false);
      setCallActive(true);
      if (peerConnectionRef.current && data.answer) {
        try { await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer)); } 
        catch (err) { console.warn("RTC setRemote error:", err); }
      }
    };
    const onIceCandidate = async (data: { candidate: RTCIceCandidateInit }) => {
      if (peerConnectionRef.current && data.candidate) {
        try { await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate)); } 
        catch (err) { console.warn("RTC addIceCandidate error:", err); }
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
      socket.off("disconnect");
    };
  }, [consultationId, activeRole, user?.id]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, peerTyping, isChatOpen]);

  useEffect(() => {
    if (callActive) {
      callTimerRef.current = setInterval(() => setCallDuration((prev) => prev + 1), 1000);
    } else {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCallDuration(0);
    }
    return () => { if (callTimerRef.current) clearInterval(callTimerRef.current); };
  }, [callActive]);

  const formatTime = (secs: number) => `${Math.floor(secs / 60).toString().padStart(2, "0")}:${(secs % 60).toString().padStart(2, "0")}`;

  // WebRTC
  const startVideoCall = async () => {
    try {
      setCallConnecting(true);
      const socket = getSocket();
      const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      peerConnectionRef.current = pc;

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch {
        console.warn("Camera fallback used.");
        const canvas = document.createElement("canvas");
        canvas.width = 640; canvas.height = 480;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#1e293b"; ctx.fillRect(0, 0, 640, 480);
          ctx.fillStyle = "#ffffff"; ctx.font = "24px sans-serif"; ctx.fillText("Camera Unavailable", 220, 240);
        }
        stream = (canvas as HTMLCanvasElement & { captureStream: (fps: number) => MediaStream }).captureStream(30);
      }
      localStreamRef.current = stream;
      if (localVideoRef.current && stream) localVideoRef.current.srcObject = stream;
      if (stream) stream.getTracks().forEach((track) => pc.addTrack(track, stream!));

      pc.ontrack = (event) => { if (remoteVideoRef.current && event.streams[0]) remoteVideoRef.current.srcObject = event.streams[0]; };
      pc.onicecandidate = (event) => { if (event.candidate) socket.emit("ice_candidate", { consultationId, candidate: event.candidate }); };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("call_user", { consultationId, offer, callerName: activeRole === "patient" ? user?.fullName || "Patient" : doctor?.professionalName || "Doctor", callerRole: activeRole });
      
      fetch(`/api/consultation/${consultationId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callStatus: "calling" }) }).catch(console.warn);

      setTimeout(() => {
        if (callConnecting) { setCallConnecting(false); setCallActive(true); }
      }, 3000); // Dev fallback
    } catch (err) {
      console.error("Failed to start call", err);
      setCallConnecting(false);
    }
  };

  const acceptIncomingCall = async () => {
    if (!incomingCall) return;
    try {
      setCallConnecting(true);
      const socket = getSocket();
      const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      peerConnectionRef.current = pc;

      let stream: MediaStream | null = null;
      try { stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); } 
      catch { console.warn("Local camera fallback in answer."); }

      localStreamRef.current = stream;
      if (localVideoRef.current && stream) localVideoRef.current.srcObject = stream;
      if (stream) stream.getTracks().forEach((track) => pc.addTrack(track, stream!));

      pc.ontrack = (event) => { if (remoteVideoRef.current && event.streams[0]) remoteVideoRef.current.srcObject = event.streams[0]; };
      pc.onicecandidate = (event) => { if (event.candidate) socket.emit("ice_candidate", { consultationId, candidate: event.candidate }); };

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("call_accepted", { consultationId, answer });
      setIncomingCall(null); setCallConnecting(false); setCallActive(true);

      fetch(`/api/consultation/${consultationId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callStatus: "connected" }) }).catch(console.warn);
    } catch (err) { console.error("Error accepting", err); setCallConnecting(false); setIncomingCall(null); }
  };

  const rejectIncomingCall = () => { getSocket().emit("call_rejected", { consultationId, reason: "Call declined" }); setIncomingCall(null); };

  const endVideoCall = async () => {
    getSocket().emit("end_call", { consultationId, duration: callDuration });
    cleanupCall();
    if (activeRole === "doctor") setShowPrescriptionModal(true);
    fetch(`/api/consultation/${consultationId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callStatus: "ended", duration: callDuration }) }).catch(console.warn);
  };



  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) { audioTrack.enabled = !audioTrack.enabled; setIsMuted(!audioTrack.enabled); }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) { videoTrack.enabled = !videoTrack.enabled; setIsVideoDisabled(!videoTrack.enabled); }
    }
  };

  // Chat Send
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const text = inputText.trim(); setInputText("");
    
    // Generate a temporary ID so we can deduplicate if the socket echoes it back
    const tempId = `temp-${Date.now()}`;
    const newMsg: Message = { _id: tempId, senderId: user?.id || (activeRole === "patient" ? "patient_id" : "doctor_id"), senderRole: activeRole, content: text, type: "text", createdAt: new Date().toISOString() };
    
    // Optimistic UI Update
    setMessages(prev => [...prev, newMsg]);

    getSocket().emit("send_message", { ...newMsg, consultationId });
    getSocket().emit("typing", { consultationId, userId: user?.id || "user", role: activeRole, isTyping: false });
    
    fetch(`/api/consultation/${consultationId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newMsg) }).catch(console.warn);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    const socket = getSocket();
    if (!isTyping) {
      setIsTyping(true);
      socket.emit("typing", { consultationId, userId: user?.id || "user", role: activeRole, isTyping: true });
    }
    setTimeout(() => { setIsTyping(false); socket.emit("typing", { consultationId, userId: user?.id || "user", role: activeRole, isTyping: false }); }, 2000);
  };

  const handleSubmitPrescription = async () => {
    setSubmittingPrescription(true);
    try {
      const res = await fetch(`/api/consultation/${consultationId}/prescription`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medicines, healthyTips, exercises: prescribedExercises, doctorNotes }),
      });
      const json = await res.json();
      if (json.success) {
        setPrescriptionSaved(true); setShowPrescriptionModal(false);
        getSocket().emit("prescription_published", { consultationId, prescription: json.data.prescription, message: json.data.message });
      }
    } catch { alert("Error sending prescription."); } 
    finally { setSubmittingPrescription(false); }
  };

  if (loading) return (
    <AppShell hideNav hideHeader>
      <div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
    </AppShell>
  );

  if (error) return (
    <AppShell hideNav hideHeader>
      <div className="flex flex-col h-screen items-center justify-center bg-slate-50 gap-4">
        <AlertCircle className="w-10 h-10 text-red-500" />
        <p className="text-slate-800 font-medium">{error}</p>
        <Button onClick={() => router.push("/")} className="bg-emerald-600">Return Home</Button>
      </div>
    </AppShell>
  );

  const isCompleted = consultation?.status === "COMPLETED";
  const peerName = activeRole === "patient" ? doctor?.professionalName : patient?.name;

  return (
    <AppShell hideNav hideHeader>
      <div className="flex h-dvh bg-slate-950 text-slate-100 overflow-hidden font-sans">
        
        {/* === MAIN VIDEO AREA === */}
        <div className="flex-1 flex flex-col relative transition-all duration-300">
          
          {/* Header Bar */}
          <div className="absolute top-0 left-0 right-0 p-4 md:p-6 z-10 flex items-center justify-between bg-linear-to-b from-slate-950/80 to-transparent pointer-events-none">
            <div className="flex items-center gap-4 pointer-events-auto">
              <Button onClick={() => router.back()} variant="ghost" className="text-white hover:bg-white/10 rounded-full w-10 h-10 p-0 shadow-sm border border-white/10 backdrop-blur-md">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-lg md:text-xl font-semibold text-white drop-shadow-md flex items-center gap-2">
                  {peerName}
                  {activeRole === "patient" ? <ShieldCheck className="w-4 h-4 text-emerald-400" /> : <UserCheck className="w-4 h-4 text-emerald-400" />}
                </h1>
                <div className="flex items-center gap-2 text-xs md:text-sm text-slate-300 drop-shadow-sm font-medium">
                   <div className={`w-2 h-2 rounded-full ${onlineUsers > 1 ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                   <span>{onlineUsers > 1 ? 'Online' : 'Waiting for peer...'}</span>
                   <span className="opacity-50">•</span>
                   <span>{isCompleted ? 'Completed' : (callActive ? 'Call Connected' : 'Scheduled')}</span>
                </div>
              </div>
            </div>

            {/* Desktop Top Right Controls */}
            <div className="hidden md:flex items-center gap-3 pointer-events-auto">
              {activeRole === "doctor" && !isCompleted && (
                <Button onClick={() => setShowPrescriptionModal(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-full px-5 py-2 shadow-lg border border-emerald-500/50 transition-all">
                  <FileText className="w-4 h-4 mr-2" /> Write Prescription
                </Button>
              )}
            </div>
          </div>

          {/* Incoming Call Overlay */}
          {incomingCall && !callActive && (
            <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 bg-slate-800/90 backdrop-blur-xl border border-slate-600 p-6 rounded-3xl shadow-2xl flex flex-col items-center gap-4 min-w-[320px] animate-in fade-in slide-in-from-top-10">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center animate-pulse">
                 <PhoneCall className="w-8 h-8 text-emerald-400" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-white">Incoming Call</h3>
                <p className="text-slate-300 text-sm mt-1">from {incomingCall.callerName}</p>
              </div>
              <div className="flex gap-4 w-full mt-2">
                 <Button onClick={rejectIncomingCall} className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-2xl h-12">Decline</Button>
                 <Button onClick={acceptIncomingCall} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl h-12 shadow-lg shadow-emerald-900/50">Accept</Button>
              </div>
            </div>
          )}

          {/* Video Feeds container */}
          <div className="flex-1 relative bg-slate-900 w-full h-full flex items-center justify-center overflow-hidden">
            
            {/* Lobby / Idle State */}
            {!callActive && !callConnecting && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 px-6 text-center">
                <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center mb-6 shadow-xl relative">
                   <Video className="w-10 h-10 text-slate-500" />
                   {onlineUsers > 1 && <div className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-500 border-2 border-slate-800 rounded-full"></div>}
                </div>
                <h2 className="text-2xl font-semibold text-slate-200 mb-2">Ready to join?</h2>
                <p className="text-sm text-slate-500 max-w-md mx-auto mb-8 leading-relaxed">
                  {onlineUsers > 1 
                    ? `${peerName} is in the room. Start the call when you're ready.` 
                    : `Waiting for ${peerName} to join the consultation room.`}
                </p>
                {!isCompleted && (
                  <Button onClick={startVideoCall} disabled={onlineUsers < 2 && activeRole === 'patient'} className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-6 rounded-full text-lg font-semibold shadow-emerald-900/50 shadow-xl transition-transform hover:scale-105">
                    Start Video Call
                  </Button>
                )}
                {isCompleted && (
                  <div className="bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-lg border border-emerald-500/20 text-sm font-medium mt-4">
                    This consultation has been completed.
                  </div>
                )}
              </div>
            )}

            {callConnecting && !callActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-10 text-slate-300">
                 <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-4" />
                 <p className="text-lg font-medium animate-pulse">Connecting to secure WebRTC stream...</p>
              </div>
            )}

            {/* Remote Video (Main) */}
            <video ref={remoteVideoRef} autoPlay playsInline className={`w-full h-full object-cover transition-opacity duration-500 ${callActive ? 'opacity-100' : 'opacity-0'}`} />
            
            {/* Remote Info Banner */}
            {callActive && (
              <div className="absolute bottom-28 left-6 md:bottom-32 z-20">
                 <div className="bg-slate-900/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-3 shadow-lg">
                    <span className="text-white font-medium text-sm">{peerName}</span>
                    <span className="text-slate-300 font-mono text-sm border-l border-slate-600 pl-3">{formatTime(callDuration)}</span>
                 </div>
              </div>
            )}

            {/* Local Video (PIP) */}
            <div className={`absolute top-24 right-4 md:right-6 md:bottom-28 md:top-auto z-20 w-28 h-40 md:w-48 md:h-72 bg-slate-800 rounded-2xl overflow-hidden border-2 border-slate-700/50 shadow-2xl transition-all duration-300 ${callActive || callConnecting ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
              <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
              <div className="absolute bottom-2 left-2 bg-slate-900/70 backdrop-blur-sm px-2 py-1 rounded text-[10px] text-white font-medium flex items-center gap-1.5">
                You {isMuted && <MicOff className="w-3 h-3 text-red-400" />} {isVideoDisabled && <VideoOff className="w-3 h-3 text-red-400" />}
              </div>
            </div>

          </div>

          {/* Bottom Controls Bar */}
          <div className="h-20 md:h-24 bg-slate-950 border-t border-slate-800 flex items-center justify-between px-4 md:px-8 shrink-0 z-20 relative">
            
            <div className="flex-1 flex items-center justify-start">
               {/* Connection Status indicator */}
               <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 font-medium bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800">
                 <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`}></div>
                 {connectionStatus === 'connected' ? 'Socket Connected' : 'Reconnecting...'}
               </div>
            </div>

            <div className="flex-1 flex items-center justify-center gap-3 md:gap-5">
              <Button onClick={toggleMute} disabled={!callActive} variant="outline" className={`w-12 h-12 md:w-14 md:h-14 rounded-full border-0 shadow-lg flex items-center justify-center transition-all ${isMuted ? 'bg-slate-200 text-slate-900 hover:bg-slate-300' : 'bg-slate-800 text-white hover:bg-slate-700'}`}>
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </Button>
              <Button onClick={toggleVideo} disabled={!callActive} variant="outline" className={`w-12 h-12 md:w-14 md:h-14 rounded-full border-0 shadow-lg flex items-center justify-center transition-all ${isVideoDisabled ? 'bg-slate-200 text-slate-900 hover:bg-slate-300' : 'bg-slate-800 text-white hover:bg-slate-700'}`}>
                {isVideoDisabled ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </Button>
              {callActive && (
                <Button onClick={endVideoCall} className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-xl shadow-red-900/30 flex items-center justify-center">
                  <PhoneOff className="w-6 h-6" />
                </Button>
              )}
            </div>

            <div className="flex-1 flex items-center justify-end gap-3">
               {/* Mobile Chat Toggle */}
               <Button onClick={() => setIsChatOpen(true)} variant="outline" className="md:hidden w-12 h-12 rounded-full bg-slate-800 border-0 text-white hover:bg-slate-700 relative shadow-lg">
                 <MessageSquare className="w-5 h-5" />
                 {/* Notification dot could go here */}
               </Button>
            </div>
          </div>
        </div>

        {/* === SIDE CHAT PANEL (Desktop Sidebar / Mobile Bottom Sheet) === */}
        <div className={`fixed inset-y-0 right-0 z-40 w-full md:w-[380px] lg:w-[420px] bg-white text-slate-900 flex flex-col shadow-2xl transition-transform duration-300 ease-out md:relative md:translate-x-0 ${isChatOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          
          {/* Chat Header */}
          <div className="h-16 border-b border-slate-100 flex items-center justify-between px-5 shrink-0 bg-white z-10">
            <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-600" />
              Consultation Chat
            </h2>
            <div className="flex items-center gap-2">
              <Button onClick={() => setIsChatOpen(false)} variant="ghost" className="md:hidden w-8 h-8 p-0 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50/50">
            
            <div className="text-center my-4">
               <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-1.5 rounded-full text-xs font-semibold">
                  <Sparkles className="w-3.5 h-3.5" /> Secure end-to-end encrypted chat
               </div>
            </div>

            {messages.length === 0 && (
               <div className="h-32 flex flex-col items-center justify-center text-slate-400 opacity-60">
                 <MessageSquare className="w-8 h-8 mb-2" />
                 <p className="text-sm">No messages yet.</p>
               </div>
            )}

            {messages.map((msg, idx) => {
              const isSelf = msg.senderRole === activeRole;
              
              if (msg.type === "prescription" && msg.prescriptionData) {
                const rx = msg.prescriptionData;
                return (
                  <div key={msg._id || idx} className="my-6 bg-white rounded-2xl border border-emerald-200 shadow-sm overflow-hidden">
                    <div className="bg-emerald-600 px-4 py-3 flex items-center gap-3 text-white">
                       <FileText className="w-5 h-5" />
                       <div>
                         <h4 className="font-bold text-sm">Official Prescription</h4>
                         <p className="text-[10px] text-emerald-100 font-medium">Issued by {rx.doctorName}</p>
                       </div>
                    </div>
                    <div className="p-4 space-y-4">
                      {rx.medicines && rx.medicines.length > 0 && (
                        <div>
                           <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Pill className="w-3 h-3 text-emerald-600"/> Medications</h5>
                           <div className="space-y-2">
                             {rx.medicines?.map((m: { name: string; dosage: string; frequency: string; duration: string }, i: number) => (
                               <div key={i} className="bg-slate-50 p-2 rounded-lg text-xs border border-slate-100">
                                 <p className="font-bold text-slate-800">{m.name}</p>
                                 <p className="text-slate-500 text-[11px] mt-0.5">{m.dosage} • {m.frequency} • {m.duration}</p>
                               </div>
                             ))}
                           </div>
                        </div>
                      )}
                      
                      {rx.exercises && rx.exercises.length > 0 && (
                        <div>
                           <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Dumbbell className="w-3 h-3 text-emerald-600"/> Recovery Exercises</h5>
                           <ul className="space-y-1.5">
                             {rx.exercises?.map((ex: { name: string; sets: number; reps: number }, i: number) => (
                               <li key={i} className="text-xs text-slate-700 flex items-start gap-2">
                                 <span className="text-emerald-500 mt-0.5">•</span>
                                 <span><strong className="text-slate-800">{ex.name}</strong> - {ex.sets} sets × {ex.reps} reps</span>
                               </li>
                             ))}
                           </ul>
                        </div>
                      )}

                      {rx.healthyTips && rx.healthyTips.length > 0 && (
                        <div>
                           <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Lightbulb className="w-3 h-3 text-amber-500"/> Clinical Advice</h5>
                           <ul className="text-xs text-slate-600 space-y-1">
                             {rx.healthyTips?.map((tip:string, i:number) => <li key={i} className="pl-2 border-l-2 border-amber-200">{tip}</li>)}
                           </ul>
                        </div>
                      )}
                      
                      <div className="pt-3 border-t border-slate-100">
                         <Button asChild className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-9 text-xs">
                           <Link href="/">View on Dashboard</Link>
                         </Button>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={msg._id || idx} className={`flex flex-col ${isSelf ? "items-end" : "items-start"}`}>
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    <span className="text-[10px] font-semibold text-slate-400">
                      {isSelf ? "You" : (msg.senderRole === "doctor" ? doctor?.professionalName : patient?.name)}
                    </span>
                  </div>
                  <div className={`max-w-[85%] px-4 py-2.5 text-sm leading-relaxed shadow-sm ${isSelf ? "bg-emerald-600 text-white rounded-2xl rounded-tr-sm" : "bg-white text-slate-800 border border-slate-200 rounded-2xl rounded-tl-sm"}`}>
                    {msg.content}
                  </div>
                  <span className="text-[9px] text-slate-400 mt-1 px-1">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              );
            })}

            {peerTyping && (
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-100 px-4 py-2 rounded-2xl rounded-tl-sm w-fit shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-4 bg-white border-t border-slate-100 shrink-0">
            <form onSubmit={handleSendMessage} className="flex items-end gap-2 relative">
              <textarea
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  const socket = getSocket();
                  if (!isTyping) { setIsTyping(true); socket.emit("typing", { consultationId, userId: user?.id, role: activeRole, isTyping: true }); }
                  setTimeout(() => { setIsTyping(false); socket.emit("typing", { consultationId, userId: user?.id, role: activeRole, isTyping: false }); }, 2000);
                }}
                onKeyDown={(e) => { if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); handleSendMessage(e); } }}
                placeholder="Type a message..."
                rows={1}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none max-h-32 min-h-[46px]"
              />
              <Button type="submit" disabled={!inputText.trim()} className="h-[46px] w-[46px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 disabled:opacity-50 transition-transform active:scale-95">
                <Send className="w-5 h-5 ml-1" />
              </Button>
            </form>
          </div>
        </div>
        
        {/* Mobile Chat Overlay Backdrop */}
        {isChatOpen && (
           <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 md:hidden" onClick={() => setIsChatOpen(false)} />
        )}

        {/* === DOCTOR PRESCRIPTION MODAL === */}
        {showPrescriptionModal && activeRole === "doctor" && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 flex flex-col font-sans animate-in zoom-in-95 duration-200">
              
              <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-600" /> Clinical Prescription
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">This will automatically sync with the patient&apos;s recovery dashboard.</p>
                </div>
                <button onClick={() => setShowPrescriptionModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-8">
                {/* Medicines */}
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2"><Pill className="w-4 h-4 text-emerald-600"/> Medications</h4>
                    <button type="button" onClick={() => setMedicines([...medicines, { name: "", dosage: "1 tablet", frequency: "Daily", duration: "5 days", instructions: "" }])} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-lg transition-colors"><Plus className="w-3.5 h-3.5" /> Add</button>
                  </div>
                  <div className="space-y-3">
                    {medicines.map((med, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-4 relative group">
                        <button type="button" onClick={() => setMedicines(medicines.filter((_, i) => i !== idx))} className="absolute top-3 right-3 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></button>
                        <input type="text" value={med.name} onChange={(e) => { const u=[...medicines]; u[idx].name=e.target.value; setMedicines(u); }} placeholder="Medication name..." className="w-[90%] bg-transparent border-b border-slate-200 pb-1 mb-3 text-sm font-bold text-slate-800 focus:outline-none focus:border-emerald-500" />
                        <div className="grid grid-cols-3 gap-3">
                          <div><label className="text-[10px] font-bold text-slate-400 uppercase">Dosage</label><input type="text" value={med.dosage} onChange={(e) => { const u=[...medicines]; u[idx].dosage=e.target.value; setMedicines(u); }} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500" /></div>
                          <div><label className="text-[10px] font-bold text-slate-400 uppercase">Frequency</label><input type="text" value={med.frequency} onChange={(e) => { const u=[...medicines]; u[idx].frequency=e.target.value; setMedicines(u); }} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500" /></div>
                          <div><label className="text-[10px] font-bold text-slate-400 uppercase">Duration</label><input type="text" value={med.duration} onChange={(e) => { const u=[...medicines]; u[idx].duration=e.target.value; setMedicines(u); }} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500" /></div>
                        </div>
                      </div>
                    ))}
                    {medicines.length === 0 && <p className="text-xs text-slate-400 italic">No medications added.</p>}
                  </div>
                </section>

                {/* Exercises */}
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2"><Dumbbell className="w-4 h-4 text-emerald-600"/> Prescribed Exercises</h4>
                    <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{prescribedExercises.length} Syncing</span>
                  </div>
                  <div className="space-y-3">
                    {prescribedExercises.map((ex, idx) => (
                      <div key={idx} className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 relative group">
                        <button type="button" onClick={() => setPrescribedExercises(prescribedExercises.filter((_, i) => i !== idx))} className="absolute top-3 right-3 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></button>
                        <p className="font-bold text-sm text-slate-800 mb-3 w-[90%]">{ex.name}</p>
                        <div className="grid grid-cols-3 gap-3">
                          <div><label className="text-[10px] font-bold text-slate-400 uppercase">Sets</label><input type="number" value={ex.sets} onChange={(e) => { const u=[...prescribedExercises]; u[idx].sets=parseInt(e.target.value)||1; setPrescribedExercises(u); }} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500" /></div>
                          <div><label className="text-[10px] font-bold text-slate-400 uppercase">Reps</label><input type="number" value={ex.reps} onChange={(e) => { const u=[...prescribedExercises]; u[idx].reps=parseInt(e.target.value)||1; setPrescribedExercises(u); }} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500" /></div>
                          <div><label className="text-[10px] font-bold text-slate-400 uppercase">Frequency</label><input type="text" value={ex.frequency} onChange={(e) => { const u=[...prescribedExercises]; u[idx].frequency=e.target.value; setPrescribedExercises(u); }} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500" /></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Advice */}
                <section>
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2"><Lightbulb className="w-4 h-4 text-amber-500"/> Clinical Notes & Tips</h4>
                  <textarea value={doctorNotes} onChange={(e) => setDoctorNotes(e.target.value)} rows={3} placeholder="Add specific notes for the patient..." className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 mb-3" />
                  <div className="space-y-2">
                    {healthyTips.map((tip, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg text-xs text-slate-700 border border-slate-100">
                        <span className="flex-1">• {tip}</span>
                        <button type="button" onClick={() => setHealthyTips(healthyTips.filter((_, i) => i !== idx))} className="text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                    <div className="flex gap-2 mt-2">
                      <input type="text" value={newTipInput} onChange={(e) => setNewTipInput(e.target.value)} placeholder="Add another tip..." className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                      <Button type="button" onClick={() => { if(newTipInput.trim()){ setHealthyTips([...healthyTips, newTipInput.trim()]); setNewTipInput(""); } }} className="bg-slate-800 hover:bg-slate-700 text-white rounded-lg px-4 h-[34px] text-xs font-semibold">Add</Button>
                    </div>
                  </div>
                </section>
              </div>

              <div className="sticky bottom-0 bg-slate-50 border-t border-slate-100 p-6 flex gap-4">
                <Button onClick={() => setShowPrescriptionModal(false)} variant="outline" className="flex-1 bg-white border-slate-200 text-slate-700 rounded-xl h-12 font-bold hover:bg-slate-100">Cancel</Button>
                <Button onClick={handleSubmitPrescription} disabled={submittingPrescription} className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl h-12 font-bold shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2">
                  {submittingPrescription ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> Publish & Synchronize</>}
                </Button>
              </div>

            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
