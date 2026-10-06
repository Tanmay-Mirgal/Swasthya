/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState, useRef, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Clock, ArrowLeft } from "lucide-react";
import { Authorship, Button, Dialog, Notice, SectionHeading } from "@/components/ui";
import { useAuth, useUser } from "@clerk/react";
import { useChat, useConsultation, useRealtime, type ConnectionStatus } from "@/lib/realtime/client";
import { Rooms, RealtimeEvent, type ChatMessageDTO } from "@/lib/realtime/protocol";
import {
  ConsultationHeader,
  IncomingCallModal,
  VideoCallArea,
  VideoControls,
  ChatPanel,
} from "@/components/consultation";
import CallDebugPanel from "@/components/consultation/CallDebugPanel";
import {
  Message,
  ConsultationDetails,
  DoctorDetails,
  PatientDetails,
  PrescriptionMedicine,
  PrescriptionExercise,
  PrescriptionData,
} from "@/types/consultation";
import { formatDateKey } from "@/lib/rehab/dates";

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

  // Chat UI state
  const [inputText, setInputText] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // End consultation confirmation modal
  const [showEndModal, setShowEndModal] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  const canonicalId = consultation?._id?.toString() ?? null;
  const roomOpen = canJoinCall && !isCompleted && Boolean(canonicalId);
  const realtimeEnabled = Boolean(canonicalId) && roomOpen;
  const peerName = activeRole === "patient" ? doctor?.professionalName : patient?.name;

  // ── Consultation record (REST, authoritative) ────────────────────────
  const syncCallStateRef = useRef<(s: {
    callStatus: string;
    callInitiatorId?: string;
    callId?: string;
    callUpdatedAt?: string | Date;
    completed: boolean;
  }) => void>(() => undefined);

  const fetchConsultation = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        setError("Please sign in to access this consultation.");
        setLoading(false);
        return null;
      }

      const res = await fetch(`/api/consultation/${consultationId}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const json = await res.json();

      if (!res.ok) {
        if (json.status === "CANCELLED" || json.error === "APPOINTMENT_CANCELLED") {
          setError("This consultation appointment was cancelled.");
        } else {
          setError(json.error || "You do not have access to this consultation.");
        }
        setLoading(false);
        return null;
      }

      if (json.success && json.data) {
        const d = json.data;
        setConsultation(d.consultation);
        setDoctor(d.doctor);
        if (d.patient) setPatient(d.patient);
        if (d.prescription) setPrescription(d.prescription);
        if (d.currentUserRole) setActiveRole(d.currentUserRole);

        setCanJoinCall(Boolean(d.canJoinCall));
        setIsCompleted(Boolean(d.isCompleted));
        setTimeStatus(d.timeStatus || "IN_PROGRESS");
        setWindowMessage(d.message || null);
        if (d.scheduledAt) setScheduledAtTime(new Date(d.scheduledAt));
        return d;
      }
      return null;
    } catch (err) {
      console.error("Failed to load consultation:", err);
      setError("Unable to load consultation details. Please try again.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [consultationId, getToken]);

  // ── Realtime: chat + call (all socket/WebRTC logic lives in the hooks) ─
  const chat = useChat({
    room: roomOpen && canonicalId ? Rooms.consultation(canonicalId) : null,
    selfId: user?.id,
    selfRole: activeRole,
    historyUrl: roomOpen ? `/api/consultation/${canonicalId}/messages` : null,
    sendUrl: roomOpen ? `/api/consultation/${canonicalId}/messages` : null,
    readUrl: roomOpen ? `/api/consultation/${canonicalId}/messages/read` : null,
    extractMessages: (data) => (data as ChatMessageDTO[]) || [],
    enabled: roomOpen,
  });

  const cs = useConsultation({
    // The call controller lives as long as the consultation id does; `enabled` only gates new calls and the chat room.
    consultationId: canonicalId,
    selfId: user?.id,
    peerName,
    enabled: realtimeEnabled,
    loadCallState: async () => {
      const d = await fetchConsultation();
      return d
        ? {
            callStatus: d.consultation?.callStatus,
            callInitiatorId: d.consultation?.callInitiatorId,
            callId: d.consultation?.callId,
            callUpdatedAt: d.consultation?.callUpdatedAt,
            completed: Boolean(d.isCompleted),
          }
        : null;
    },
    onConsultationCompleted: () => {
      setIsCompleted(true);
      setCanJoinCall(false);
      void fetchConsultation();
    },
    onPrescription: (p) => {
      if (p.message) chat.ingest(p.message);
    },
  });

  useEffect(() => {
    syncCallStateRef.current = cs.syncServerCallState;
  });

  // The therapist saving the plan updates the summary the patient is looking at.
  const { client: rtClient } = useRealtime();
  useEffect(() => {
    const off = rtClient.on(RealtimeEvent.RECOVERY_PLAN_UPDATED, () => void fetchConsultation());
    return () => off();
  }, [rtClient, fetchConsultation]);

  useEffect(() => {
    void fetchConsultation().then((d) => {
      if (!d) return;
      // A call may already be ringing for us (e.g. we opened the page after they dialled).
      syncCallStateRef.current({
        callStatus: d.consultation?.callStatus,
        callInitiatorId: d.consultation?.callInitiatorId,
        callId: d.consultation?.callId,
        callUpdatedAt: d.consultation?.callUpdatedAt,
        completed: Boolean(d.isCompleted),
      });
    });
  }, [fetchConsultation]);

  // Arrived from the app-wide incoming-call banner ("Accept"): answer the ringing call once, then drop the flag.
  const autoAccept = useRef(false);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("accept") === "1") {
      autoAccept.current = true;
      url.searchParams.delete("accept");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
  }, []);
  const { isIncomingRing: ringing, acceptCall: answerCall } = cs;
  useEffect(() => {
    if (ringing && autoAccept.current) {
      autoAccept.current = false;
      void answerCall();
    }
  }, [ringing, answerCall]);

  // Camera preview as soon as the room is open (permission prompt happens before any call).
  const { startPreview } = cs;
  useEffect(() => {
    if (roomOpen) void startPreview();
  }, [roomOpen, startPreview]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages, chat.peerTyping, isChatOpen]);

  // Names kept for the view code below
  const callActive = cs.call.phase === "CONNECTED";
  const callConnecting = cs.call.phase === "OUTGOING_RINGING" || cs.call.phase === "INCOMING_RINGING" || cs.isConnecting;
  const incomingCall = cs.isIncomingRing
    ? {
        callerName: cs.incomingCallerName || peerName || (activeRole === "patient" ? "Doctor" : "Patient"),
        callerRole: activeRole === "patient" ? "doctor" : "patient",
      }
    : null;
  const connectionStatus: "connecting" | "connected" | "disconnected" = mapConnection(cs.connectionStatus);
  const connectionLabel =
    cs.connectionStatus === "connected"
      ? null
      : cs.connectionStatus === "auth_failed"
      ? "Your session expired — please sign in again"
      : cs.connectionStatus === "disconnected"
      ? "Offline — trying to reconnect…"
      : "Reconnecting to the consultation room…";
  const statusText =
    cs.call.phase === "OUTGOING_RINGING"
      ? `Calling ${peerName || "participant"}…`
      : cs.isConnecting
      ? "Connecting securely..."
      : undefined;
  const notice = cs.error || (cs.call.phase === "ENDED" ? cs.call.message : null) || null;

  const formatTime = (secs: number) =>
    `${Math.floor(secs / 60)
      .toString()
      .padStart(2, "0")}:${(secs % 60).toString().padStart(2, "0")}`;

  // Doctor concludes consultation (Rule 14): realtime CALL_END(conclude) → server completes it.
  const handleConfirmEndConsultation = async () => {
    try {
      setIsEnding(true);
      // One CALL_END(conclude): the server ends the call, completes the consultation and tells the patient.
      // It is routed to the patient's own channel, so flipping `isCompleted` below cannot swallow it.
      const sent = cs.endCall({ concludeConsultation: true });

      if (!sent && canonicalId) {
        // Realtime is unavailable: fall back to the REST endpoint.
        const token = await getToken();
        await fetch(`/api/consultation/${canonicalId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ status: "COMPLETED", duration: cs.callDuration }),
        });
      }

      setIsCompleted(true);
      setCanJoinCall(false);
      setShowEndModal(false);
    } catch (err) {
      console.error("Error completing consultation:", err);
    } finally {
      setIsEnding(false);
    }
  };

  const handlePatientLeave = () => {
    cs.endCall();
    router.push("/appointments");
  };

  const handleInputChange = (text: string) => {
    setInputText(text);
    chat.notifyTyping(text.trim().length > 0);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText;
    if (!text.trim()) return;
    setInputText("");
    const ok = await chat.send(text);
    if (!ok) setInputText((current) => current || text);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--paper)]" role="status" aria-live="polite">
        <Loader2 className="size-7 animate-spin text-emerald-600" aria-hidden="true" />
        <p className="text-sm font-medium text-slate-700">Checking your access to this consultation…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[var(--paper)] p-6">
        <div className="w-full max-w-md">
          <Notice tone="danger" title="You can’t open this consultation">{error}</Notice>
          <Button asChild className="mt-4">
            <Link href="/appointments">Back to appointments</Link>
          </Button>
        </div>
      </div>
    );
  }

  // ── VIEW 1: BEFORE THE ROOM OPENS ───────────────────────────────────
  if (!canJoinCall && !isCompleted && timeStatus === "BEFORE_WINDOW") {
    return (
      <div className="fixed inset-0 flex items-center justify-center overflow-y-auto bg-[var(--paper)] p-6">
        <div className="w-full max-w-md">
          <Clock className="size-6 text-emerald-700" aria-hidden="true" />
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Your consultation hasn’t started yet</h1>
          <p className="mt-2 text-base text-slate-700">
            With <strong>{doctor?.professionalName || "your physiotherapist"}</strong>
            {consultation?.issue ? <> about {consultation.issue}</> : null}.
          </p>
          <dl className="mt-5 border-t-2 border-slate-900">
            <div className="flex justify-between gap-4 border-b border-slate-300 py-3">
              <dt className="text-slate-600">Date</dt>
              <dd className="font-semibold">
                {scheduledAtTime?.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-slate-300 py-3">
              <dt className="text-slate-600">Starts</dt>
              <dd className="font-semibold tabular">
                {consultation?.requestedTime || scheduledAtTime?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-sm text-slate-600">{windowMessage || "The room opens 10 minutes before the scheduled time."}</p>
          <Button asChild variant="outline" className="mt-6">
            <Link href="/appointments">Back to appointments</Link>
          </Button>
        </div>
      </div>
    );
  }

  // ── VIEW 2: CONSULTATION SUMMARY ────────────────────────────────────
  if (isCompleted) {
    const rx = prescription;
    const note = consultation?.doctorNotes || rx?.doctorNotes;
    return (
      <div className="min-h-dvh overflow-y-auto bg-[var(--paper)] px-5 py-8">
        <div className="mx-auto w-full max-w-2xl">
          <Link href="/appointments" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-800 underline-offset-4 hover:underline">
            <ArrowLeft className="size-4" aria-hidden="true" /> Appointments
          </Link>

          <header className="mt-5 border-b border-slate-300 pb-5">
            <h1 className="text-3xl font-bold tracking-tight">Consultation summary</h1>
            <p className="mt-1 text-sm text-slate-700">
              With {doctor?.professionalName || "your physiotherapist"}
              {doctor?.clinicName ? ` · ${doctor.clinicName}` : ""} ·{" "}
              {consultation?.endedAt
                ? new Date(consultation.endedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
                : "completed"}
            </p>
          </header>

          {note && (
            <section aria-label="Therapist note" className="mt-6">
              <SectionHeading title="Your physiotherapist’s note" action={<Authorship by="therapist" name={doctor?.professionalName} />} />
              <p className="hand mt-3 max-w-prose">“{note}”</p>
            </section>
          )}

          {activeRole === "doctor" && (
            <section aria-label="Rehabilitation plan" className="mt-8 border-t-2 border-slate-900 pt-5">
              <SectionHeading title="Rehabilitation plan" description={rx ? "You wrote a plan after this consultation." : "Choose the exercises, sets and schedule. Your patient sees them on their sheet right away."} />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="lg">
                  <Link href={`/therapist/patient/${consultation?.patientId}/prescribe?consultation=${canonicalId}`}>{rx ? "Revise the plan" : "Create rehabilitation plan"}</Link>
                </Button>
                <Button asChild size="lg" variant="outline"><Link href={`/therapist/patient/${consultation?.patientId}`}>Open patient</Link></Button>
              </div>
            </section>
          )}

          {rx?.exercises && rx.exercises.length > 0 && (
            <section aria-label="Prescribed exercises" className="mt-8">
              <SectionHeading
                title="Your rehabilitation plan"
                description={rx.startDate && rx.endDate ? `${formatDateKey(rx.startDate, { day: "numeric", month: "short" })} to ${formatDateKey(rx.endDate, { day: "numeric", month: "short", year: "numeric" })}` : "Added to your daily sheet."}
              />
              <ol className="border-t border-slate-900">
                {rx.exercises.map((ex: PrescriptionExercise, idx: number) => (
                  <li key={idx} className="flex items-center justify-between gap-3 border-b border-slate-300 py-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900"><span className="tabular text-slate-500">{idx + 1}.</span> {ex.name}</p>
                      <p className="text-sm text-slate-600"><span className="tabular">{ex.sets} sets × {ex.reps} reps</span></p>
                    </div>
                  </li>
                ))}
              </ol>
              {activeRole === "patient" && (
                <Button asChild className="mt-4"><Link href="/">See today’s exercises</Link></Button>
              )}
            </section>
          )}

          {rx?.medicines && rx.medicines.length > 0 && (
            <section aria-label="Medications" className="mt-8">
              <SectionHeading title="Medication from your therapist" description="As written by your therapist. Swasthya does not suggest medication." />
              <ul className="border-t border-slate-900">
                {rx.medicines.map((med: PrescriptionMedicine, idx: number) => (
                  <li key={idx} className="flex items-start justify-between gap-3 border-b border-slate-300 py-3">
                    <div>
                      <p className="font-semibold text-slate-900">{med.name}</p>
                      <p className="text-sm text-slate-600">{[med.dosage, med.frequency].filter(Boolean).join(" · ")}</p>
                      {med.instructions && <p className="text-sm text-slate-600">{med.instructions}</p>}
                    </div>
                    {med.duration && <span className="text-sm text-slate-600">{med.duration}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {activeRole === "patient" && !rx && !note && (
            <p className="mt-6 text-sm text-slate-600">Your physiotherapist hasn’t created your plan yet. It will appear here, and on Today, as soon as they do.</p>
          )}

          <Button asChild className="mt-8">
            <Link href="/appointments">Back to appointments</Link>
          </Button>
        </div>
      </div>
    );
  }

  // ── VIEW 3: LIVE CONSULTATION ROOM (INSIDE VALID WINDOW) ────────────
  return (
    <div className="fixed inset-0 w-screen h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans flex">
      {/* === MAIN VIDEO AREA === */}
      <div className="flex-1 h-full relative bg-slate-950 overflow-hidden flex flex-col">
        <IncomingCallModal
          incomingCall={incomingCall && !callActive ? incomingCall : null}
          onAccept={cs.acceptCall}
          onReject={cs.rejectCall}
        />

        <VideoCallArea
          callActive={callActive}
          callConnecting={callConnecting}
          hasRemoteStream={cs.hasRemoteStream}
          isCompleted={isCompleted}
          peerName={peerName}
          onlineUsers={cs.onlineUsers}
          callDuration={cs.callDuration}
          formatTime={formatTime}
          localVideoRef={cs.localVideoRef}
          remoteVideoRef={cs.remoteVideoRef}
          isMuted={cs.isMuted}
          isVideoDisabled={cs.isVideoDisabled}
          isAudioOnly={cs.isAudioOnly}
          statusText={statusText}
          notice={notice}
          connectionLabel={connectionLabel}
          onStartCall={cs.requestCall}
        />

        <ConsultationHeader
          peerName={peerName}
          activeRole={activeRole}
          onlineUsers={cs.onlineUsers}
          isCompleted={isCompleted}
          callActive={callActive}
          onBack={activeRole === "doctor" ? () => setShowEndModal(true) : handlePatientLeave}
          planHref={consultation?.patientId && canonicalId ? `/therapist/patient/${consultation.patientId}/prescribe?consultation=${canonicalId}` : undefined}
        />

        <VideoControls
          callActive={callActive || callConnecting || cs.hasLocalStream}
          connectionStatus={connectionStatus}
          isMuted={cs.isMuted}
          isVideoDisabled={cs.isVideoDisabled}
          onToggleMute={cs.toggleMute}
          onToggleVideo={cs.toggleVideo}
          onEndCall={activeRole === "doctor" ? () => setShowEndModal(true) : handlePatientLeave}
          onOpenChat={() => setIsChatOpen(true)}
        />
        <CallDebugPanel debug={cs.debug} socket={cs.connectionStatus} hasLocalStream={cs.hasLocalStream} hasRemoteStream={cs.hasRemoteStream} />
      </div>

      {/* === SIDE CHAT PANEL === */}
      <ChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={chat.messages as unknown as Message[]}
        activeRole={activeRole}
        doctorName={doctor?.professionalName}
        patientName={patient?.name}
        peerTyping={chat.peerTyping}
        inputText={inputText}
        onInputChange={handleInputChange}
        onSendMessage={handleSendMessage}
        messagesEndRef={messagesEndRef}
      />

      {/* === END CONSULTATION CONFIRMATION (DOCTOR ONLY) === */}
      <Dialog
        open={showEndModal}
        onClose={() => !isEnding && setShowEndModal(false)}
        title="End the consultation?"
        description={`Conclude this session with ${patient?.name || "the patient"}? It will be marked completed and the room will close.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowEndModal(false)} disabled={isEnding}>Keep going</Button>
            <Button variant="danger" onClick={handleConfirmEndConsultation} disabled={isEnding}>
              {isEnding ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : "End consultation"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-700">You can create the rehabilitation plan right after.</p>
      </Dialog>
    </div>
  );
}

function mapConnection(status: ConnectionStatus): "connecting" | "connected" | "disconnected" {
  if (status === "connected") return "connected";
  if (status === "connecting" || status === "reconnecting") return "connecting";
  return "disconnected";
}
