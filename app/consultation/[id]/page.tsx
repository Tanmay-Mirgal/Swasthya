"use client";

import { useEffect, useState, useRef, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  AlertCircle,
  Clock,
  ArrowLeft,
  Calendar, Dumbbell,
  Play
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth, useUser } from "@clerk/react";
import { getSocket, joinConsultationRoom } from "@/lib/socket";
import { DEFAULT_RTC_CONFIG, getMediaStreamWithFallback } from "@/lib/webrtc";
import {
  ConsultationHeader,
  VideoCallArea,
  VideoControls,
  ChatPanel,
  PrescriptionModal,
} from "@/components/consultation";
import {
  Message,
  ConsultationDetails,
  DoctorDetails,
  PatientDetails,
  PrescriptionMedicine,
  PrescriptionExercise,
  PrescriptionData,
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

  // Consultation data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [consultation, setConsultation] = useState<ConsultationDetails | null>(null);
  const [doctor, setDoctor] = useState<DoctorDetails | null>(null);
  const [patient, setPatient] = useState<PatientDetails | null>(null);
  const [prescription, setPrescription] = useState<PrescriptionData | null>(null);

  // Time Window & Lifecycle status
  const [canJoinCall, setCanJoinCall] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [timeStatus, setTimeStatus] = useState<string>("IN_PROGRESS");
  const [windowMessage, setWindowMessage] = useState<string | null>(null);
  const [scheduledAtTime, setScheduledAtTime] = useState<Date | null>(null);

  // Role
  const [activeRole, setActiveRole] = useState<"patient" | "doctor">("patient");

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [peerTyping, setPeerTyping] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Video call state
  const [callActive, setCallActive] = useState(false);
  const [callConnecting, setCallConnecting] = useState(false);
  const [hasRemoteStream, setHasRemoteStream] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(1);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");

  // End consultation confirmation modal
  const [showEndModal, setShowEndModal] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

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

  // Prescription form fields
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
      exerciseId: "neck-rotation",
      name: "Neck Rotation",
      sets: 3,
      reps: 15,
      duration: "5 mins",
      frequency: "Daily",
      instructions: "Gentle controlled rotation.",
    },
  ]);
  const [doctorNotes, setDoctorNotes] = useState(
    "Patient presented with cervical stiffness and range of motion restriction. Recommended daily mobility exercises."
  );
  const [hasLocalStream, setHasLocalStream] = useState(false);

  // Set up local camera preview
  const setupLocalMediaStream = async () => {
    try {
      if (localStreamRef.current) return;
      const stream = await getMediaStreamWithFallback();
      localStreamRef.current = stream;
      if (stream) {
        setHasLocalStream(true);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {});
        }
      }
    } catch (e) {
      console.warn("Could not acquire camera for room preview:", e);
    }
  };

  const cleanupCall = () => {
    setCallActive(false);
    setCallConnecting(false);
    setHasRemoteStream(false);
    setHasLocalStream(false);
    setCallDuration(0);
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
  };

  const initiatePeerConnection = useCallback(async () => {
    try {
      setCallConnecting(true);
      const socket = getSocket();
      const pc = new RTCPeerConnection(DEFAULT_RTC_CONFIG);
      peerConnectionRef.current = pc;

      if (!localStreamRef.current) {
        localStreamRef.current = await getMediaStreamWithFallback();
        if (localStreamRef.current) setHasLocalStream(true);
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
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

      socket.emit("peer_offer", { consultationId, offer });
    } catch (err) {
      console.error("Failed to initiate room connection:", err);
      setCallConnecting(false);
    }
  }, [consultationId]);

  // 1. Fetch initial consultation and validate access
  useEffect(() => {
    const fetchConsultation = async () => {
      try {
        const token = await getToken();
        if (!token) {
          setError("Please sign in to access this consultation.");
          setLoading(false);
          return;
        }

        const res = await fetch(`/api/consultation/${consultationId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();

        if (!res.ok) {
          if (json.status === "CANCELLED" || json.error === "APPOINTMENT_CANCELLED") {
            setError("This consultation appointment was cancelled.");
          } else {
            setError(json.error || "You do not have access to this consultation.");
          }
          setLoading(false);
          return;
        }

        if (json.success && json.data) {
          const d = json.data;
          setConsultation(d.consultation);
          setDoctor(d.doctor);
          if (d.patient) setPatient(d.patient);
          if (d.messages) setMessages(d.messages);
          if (d.prescription) {
            setPrescription(d.prescription);
          }
          if (d.currentUserRole) setActiveRole(d.currentUserRole);

          setCanJoinCall(Boolean(d.canJoinCall));
          setIsCompleted(Boolean(d.isCompleted));
          setTimeStatus(d.timeStatus || "IN_PROGRESS");
          setWindowMessage(d.message || null);
          if (d.scheduledAt) setScheduledAtTime(new Date(d.scheduledAt));

          // If inside valid join window, auto-start camera for the room
          if (d.canJoinCall && !d.isCompleted) {
            setupLocalMediaStream();
          }
        }
      } catch (err) {
        console.error("Failed to load consultation:", err);
        setError("Unable to load consultation details. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchConsultation();
  }, [consultationId, getToken]);

  // 2. Real-time signaling & direct room peer connection
  useEffect(() => {
    if (!canJoinCall || isCompleted) return;

    const socket = getSocket();
    const currentUserId = user?.id || "user";

    socket.on("connect", () => setConnectionStatus("connected"));
    socket.on("connect_error", () => setConnectionStatus("disconnected"));
    socket.on("disconnect", () => setConnectionStatus("disconnected"));

    // Join room without ringing or call requests (Rule 7 & 8)
    joinConsultationRoom(consultationId, currentUserId, activeRole);

    const onPresence = (data: { activeUserCount: number }) => {
      if (data.activeUserCount) {
        setOnlineUsers(data.activeUserCount);
        // If 2 people are in the room, start WebRTC negotiation automatically if not already active
        if (data.activeUserCount >= 2 && !callActive && !callConnecting && activeRole === "patient") {
          initiatePeerConnection();
        }
      }
    };

    const onPeerOffer = async (data: { offer: RTCSessionDescriptionInit }) => {
      if (!data.offer) return;
      try {
        setCallConnecting(true);
        const pc = new RTCPeerConnection(DEFAULT_RTC_CONFIG);
        peerConnectionRef.current = pc;

        // Attach local tracks
        if (!localStreamRef.current) {
          localStreamRef.current = await getMediaStreamWithFallback();
        }
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((track) => {
            pc.addTrack(track, localStreamRef.current!);
          });
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

        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        while (iceCandidateQueueRef.current.length > 0) {
          const candidate = iceCandidateQueueRef.current.shift();
          if (candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
          }
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit("peer_answer", { consultationId, answer });
        setCallConnecting(false);
        setCallActive(true);
      } catch (err) {
        console.error("Error answering peer offer:", err);
        setCallConnecting(false);
      }
    };

    const onPeerAnswer = async (data: { answer: RTCSessionDescriptionInit }) => {
      if (peerConnectionRef.current && data.answer) {
        try {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(data.answer)
          );
          while (iceCandidateQueueRef.current.length > 0) {
            const candidate = iceCandidateQueueRef.current.shift();
            if (candidate) {
              await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
            }
          }
          setCallConnecting(false);
          setCallActive(true);
        } catch (err) {
          console.error("Error setting peer answer:", err);
        }
      }
    };

    const onIceCandidate = async (data: { candidate: RTCIceCandidateInit }) => {
      if (peerConnectionRef.current && data.candidate) {
        try {
          if (peerConnectionRef.current.remoteDescription) {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
          } else {
            iceCandidateQueueRef.current.push(data.candidate);
          }
        } catch (err) {
          console.warn("RTC addIceCandidate error:", err);
        }
      }
    };

    const onCallEnded = () => {
      cleanupCall();
      setIsCompleted(true);
      setCanJoinCall(false);
    };

    const onPrescriptionReceived = (data: { prescription?: PrescriptionData; message?: Message }) => {
      if (data.prescription) setPrescription(data.prescription);
      if (data.message) {
        setMessages((prev) => [...prev, data.message!]);
      }
    };

    const onNewMessage = (msg: Message) =>
      setMessages((prev) =>
        prev.some((m) => m._id && m._id === msg._id) ? prev : [...prev, msg]
      );

    const onTyping = (data: { role: string; isTyping: boolean }) => {
      if (data.role !== activeRole) setPeerTyping(data.isTyping);
    };

    socket.on("presence_update", onPresence);
    socket.on("peer_offer", onPeerOffer);
    socket.on("peer_answer", onPeerAnswer);
    socket.on("ice_candidate", onIceCandidate);
    socket.on("call_ended", onCallEnded);
    socket.on("prescription_received", onPrescriptionReceived);
    socket.on("new_message", onNewMessage);
    socket.on("typing_update", onTyping);

    return () => {
      socket.off("presence_update", onPresence);
      socket.off("peer_offer", onPeerOffer);
      socket.off("peer_answer", onPeerAnswer);
      socket.off("ice_candidate", onIceCandidate);
      socket.off("call_ended", onCallEnded);
      socket.off("prescription_received", onPrescriptionReceived);
      socket.off("new_message", onNewMessage);
      socket.off("typing_update", onTyping);
      socket.off("connect");
      socket.off("connect_error");
      socket.off("disconnect");
    };
  }, [consultationId, canJoinCall, isCompleted, activeRole, user?.id, callActive, callConnecting, initiatePeerConnection]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, peerTyping, isChatOpen]);

  useEffect(() => {
    if (callActive) {
      callTimerRef.current = setInterval(() => setCallDuration((prev) => prev + 1), 1000);
    }
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, [callActive]);

  const formatTime = (secs: number) =>
    `${Math.floor(secs / 60)
      .toString()
      .padStart(2, "0")}:${(secs % 60).toString().padStart(2, "0")}`;

  // Doctor concludes consultation (Rule 14)
  const handleConfirmEndConsultation = async () => {
    try {
      setIsEnding(true);
      const token = await getToken();
      const socket = getSocket();

      socket.emit("end_call", { consultationId, duration: callDuration });
      cleanupCall();

      await fetch(`/api/consultation/${consultationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          status: "COMPLETED",
          callStatus: "ended",
          duration: callDuration,
        }),
      });

      setIsCompleted(true);
      setCanJoinCall(false);
      setShowEndModal(false);
      setShowPrescriptionModal(true);
    } catch (err) {
      console.error("Error completing consultation:", err);
    } finally {
      setIsEnding(false);
    }
  };

  const handlePatientLeave = () => {
    cleanupCall();
    router.push("/appointments");
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setIsMuted(!track.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getVideoTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setIsVideoDisabled(!track.enabled);
      }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const text = inputText.trim();
    setInputText("");

    const newMsg: Message = {
      _id: `msg-${Date.now()}`,
      senderId: user?.id || "user",
      senderRole: activeRole,
      content: text,
      type: "text",
      read: false,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newMsg]);
    getSocket().emit("send_message", { ...newMsg, consultationId });

    fetch(`/api/consultation/${consultationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newMsg),
    }).catch(console.warn);
  };

  const handleSubmitPrescription = async () => {
    setSubmittingPrescription(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/consultation/${consultationId}/prescription`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          medicines,
          healthyTips,
          exercises: prescribedExercises,
          doctorNotes,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowPrescriptionModal(false);
        if (json.data.prescription) setPrescription(json.data.prescription);
        getSocket().emit("prescription_published", {
          consultationId,
          prescription: json.data.prescription,
          message: json.data.message,
        });
      }
    } catch {
      alert("Error saving prescription.");
    } finally {
      setSubmittingPrescription(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 w-screen h-screen bg-slate-900 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="size-8 animate-spin text-slate-400" />
        <p className="text-xs text-slate-400 font-medium">Verifying consultation access...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 w-screen h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 shadow-xs space-y-4">
          <AlertCircle className="size-10 text-slate-400 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Access Restricted</h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{error}</p>
          <Button asChild className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl">
            <Link href="/appointments">Return to Appointments</Link>
          </Button>
        </div>
      </div>
    );
  }

  // ── VIEW 1: BEFORE WINDOW / NOT YET OPEN ────────────────────────────
  if (!canJoinCall && !isCompleted && timeStatus === "BEFORE_WINDOW") {
    return (
      <div className="fixed inset-0 w-screen h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200/90 p-7 shadow-xs space-y-5 text-center">
          <div className="size-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-700">
            <Clock className="size-6" />
          </div>

          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Upcoming Consultation
            </span>
            <h1 className="text-xl font-bold text-slate-900 mt-1">
              Consultation Scheduled
            </h1>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              With <strong>{doctor?.professionalName || "Physiotherapist"}</strong> for{" "}
              {consultation?.issue || "Rehabilitation"}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700 space-y-1">
            <div className="font-semibold text-slate-900 flex items-center justify-center gap-1.5">
              <Calendar className="size-3.5 text-slate-500" />
              <span>
                {scheduledAtTime?.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
            <p className="text-slate-500">
              Starts at{" "}
              <strong className="text-slate-800">
                {consultation?.requestedTime ||
                  scheduledAtTime?.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
              </strong>
            </p>
            <p className="text-[11px] text-slate-400 pt-1">
              {windowMessage || "The consultation room opens 10 minutes prior to your scheduled time."}
            </p>
          </div>

          <Button asChild variant="outline" className="w-full rounded-xl border-slate-200">
            <Link href="/appointments">Back to Appointments</Link>
          </Button>
        </div>
      </div>
    );
  }

  // ── VIEW 2: COMPLETED CONSULTATION SUMMARY ──────────────────────────
  if (isCompleted) {
    const rx = prescription;
    return (
      <div className="min-h-screen bg-[#F8FAFC] py-8 px-4 flex flex-col items-center">
        <div className="max-w-2xl w-full space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <Button asChild variant="ghost" className="text-xs text-slate-500 hover:text-slate-900 p-0 h-auto">
              <Link href="/appointments" className="flex items-center gap-1">
                <ArrowLeft className="size-4" />
                <span>Appointments</span>
              </Link>
            </Button>
            <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full">
              Consultation Concluded
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-7 shadow-xs space-y-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Clinical Summary
                </span>
                <h1 className="text-2xl font-bold text-slate-900 mt-1">
                  Rehabilitation Consultation
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Practitioner: <strong>{doctor?.professionalName || "Physiotherapist"}</strong> •{" "}
                  {doctor?.clinicName || "Swasthya Care"}
                </p>
              </div>

              <div className="text-xs text-slate-500 font-medium">
                {consultation?.endedAt
                  ? new Date(consultation.endedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "Completed"}
              </div>
            </div>

            {/* Doctor's Clinical Note */}
            {(consultation?.doctorNotes || rx?.doctorNotes) && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700 leading-relaxed">
                <span className="font-semibold text-slate-900 block mb-1">
                  Doctor&apos;s Clinical Advice:
                </span>
                <p>&ldquo;{consultation?.doctorNotes || rx?.doctorNotes}&rdquo;</p>
              </div>
            )}

            {/* Prescribed Exercises */}
            {rx?.exercises && rx.exercises.length > 0 && (
              <div className="space-y-2 pt-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Dumbbell className="size-3.5 text-slate-600" />
                  <span>Assigned Exercises ({rx.exercises.length})</span>
                </h2>
                <div className="space-y-2">
                  {rx.exercises.map((ex: PrescriptionExercise, idx: number) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">{ex.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {ex.sets} sets · {ex.reps} reps · {ex.frequency || "Daily"}
                        </p>
                      </div>
                      {ex.exerciseId && (
                        <Button asChild size="sm" className="h-8 text-xs bg-slate-900 hover:bg-slate-800 text-white rounded-lg">
                          <Link href={`/exercise/${ex.exerciseId}/setup`} className="flex items-center gap-1">
                            <Play className="size-3" />
                            <span>Practice</span>
                          </Link>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Prescribed Medicines */}
            {rx?.medicines && rx.medicines.length > 0 && (
              <div className="space-y-2 pt-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Prescribed Medications
                </h2>
                <div className="space-y-1.5">
                  {rx.medicines.map((med: PrescriptionMedicine, idx: number) => (
                    <div key={idx} className="p-3 rounded-lg border border-slate-100 text-xs flex justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{med.name}</p>
                        <p className="text-[11px] text-slate-500">{med.dosage} · {med.frequency}</p>
                      </div>
                      <span className="text-[11px] text-slate-400">{med.duration}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <Button asChild className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl">
                <Link href="/appointments">Return to Appointments</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── VIEW 3: LIVE CONSULTATION ROOM (INSIDE VALID WINDOW) ────────────
  const peerName = activeRole === "patient" ? doctor?.professionalName : patient?.name;

  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#0B0C10] text-slate-100 overflow-hidden font-sans flex select-none">
      {/* === MAIN VIDEO AREA === */}
      <div className="flex-1 h-full relative bg-[#0B0C10] overflow-hidden flex flex-col">
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
          onStartCall={initiatePeerConnection}
        />

        <ConsultationHeader
          peerName={peerName}
          activeRole={activeRole}
          onlineUsers={onlineUsers}
          isCompleted={isCompleted}
          callActive={callActive}
          onBack={activeRole === "doctor" ? () => setShowEndModal(true) : handlePatientLeave}
          onOpenPrescriptionModal={() => setShowPrescriptionModal(true)}
        />

        <VideoControls
          callActive={callActive || hasLocalStream}
          connectionStatus={connectionStatus}
          isMuted={isMuted}
          isVideoDisabled={isVideoDisabled}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
          onEndCall={activeRole === "doctor" ? () => setShowEndModal(true) : handlePatientLeave}
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
        onInputChange={setInputText}
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

      {/* === END CONSULTATION CONFIRMATION MODAL (DOCTOR ONLY) === */}
      {showEndModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 text-slate-900 shadow-xl">
            <h3 className="text-base font-bold">End Consultation?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Conclude this session with {patient?.name || "the patient"}? The appointment will be marked completed and the room will close.
            </p>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowEndModal(false)}
                disabled={isEnding}
                className="flex-1 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmEndConsultation}
                disabled={isEnding}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl"
              >
                {isEnding ? <Loader2 className="size-4 animate-spin" /> : "End Session"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
