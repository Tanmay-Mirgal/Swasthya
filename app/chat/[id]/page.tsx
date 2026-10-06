"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import {
  Send,
  Loader2,
  Calendar,
  AlertCircle,
  Clock,
  ChevronLeft,
  Check,
  CheckCheck,
  RotateCcw,
  WifiOff,
} from "lucide-react";
import { useUser } from "@clerk/react";
import { useChat, type ConnectionStatus } from "@/lib/realtime/client";
import { Rooms, type ChatMessageDTO } from "@/lib/realtime/protocol";
import DoctorAvatar from "@/components/ui/DoctorAvatar";

interface Participant {
  clerkUserId: string;
  name: string;
  title: string;
  specialization: string;
  clinicName: string;
  avatarUrl: string;
  availabilityNotice: string;
}

interface UpcomingAppointmentInfo {
  _id: string;
  scheduledAt: string;
  requestedTime?: string;
  status: string;
}

interface ChatHistoryResponse {
  participant: Participant;
  messages: ChatMessageDTO[];
  upcomingAppointment: UpcomingAppointmentInfo | null;
}

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connected: "Live",
  connecting: "Connecting",
  reconnecting: "Reconnecting",
  disconnected: "Offline",
  auth_failed: "Sign in again",
};

export default function DirectChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const targetId = resolvedParams.id;
  const { user } = useUser();
  const selfId = user?.id;

  const [participant, setParticipant] = useState<Participant | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingAppointmentInfo | null>(null);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chat = useChat({
    room: selfId ? Rooms.conversation(selfId, targetId) : null,
    selfId,
    historyUrl: `/api/chat/${targetId}`,
    sendUrl: `/api/chat/${targetId}`,
    readUrl: `/api/chat/${targetId}/read`,
    extractMessages: (data) => (data as ChatHistoryResponse).messages || [],
    onHistory: (data) => {
      const d = data as ChatHistoryResponse;
      if (d.participant) setParticipant(d.participant);
      setUpcoming(d.upcomingAppointment || null);
    },
  });

  const { messages, loading, error, sendError, connectionStatus, peerTyping } = chat;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, peerTyping]);

  const handleInputChange = (text: string) => {
    setInputText(text);
    chat.notifyTyping(text.trim().length > 0);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || sending) return;
    const text = inputText;
    setInputText("");
    setSending(true);
    const ok = await chat.send(text);
    if (!ok) setInputText((current) => current || text);
    setSending(false);
  };

  const offline = connectionStatus !== "connected";

  return (
    <AppShell hideHeader>
      <div className="max-w-3xl mx-auto w-full flex flex-col h-[calc(100dvh-5rem)] md:h-[calc(100dvh-4rem)] bg-white rounded-lg border border-slate-900 overflow-hidden">
        {/* Top Header */}
        <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3 bg-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/appointments"
              className="p-1 -ml-1 text-slate-600 hover:text-slate-700 transition-colors"
              aria-label="Back to appointments"
            >
              <ChevronLeft className="size-5" />
            </Link>

            <DoctorAvatar
              src={participant?.avatarUrl}
              name={participant?.name || "Doctor"}
              size="sm"
              isOnline={chat.peerOnline}
              className="size-10 shrink-0"
            />

            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-slate-900 leading-snug truncate">
                {participant?.name || "Doctor"}
              </h1>
              <p className="text-xs text-slate-600 truncate">
                {participant?.specialization || "Clinical Physiotherapist"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200/60 text-xs"
              role="status"
              aria-live="polite"
            >
              <span
                className={`inline-block size-2 rounded-full ${
                  connectionStatus === "connected"
                    ? "bg-emerald-500"
                    : connectionStatus === "auth_failed"
                    ? "bg-red-500"
                    : connectionStatus === "disconnected"
                    ? "bg-slate-400"
                    : "bg-amber-500"
                }`}
              />
              <span className="text-xs text-slate-700">{STATUS_LABEL[connectionStatus]}</span>
            </div>

            {participant?.availabilityNotice && (
              <div className="hidden items-center gap-1.5 text-sm text-slate-700 sm:flex">
                <Clock className="size-3.5 text-slate-600" aria-hidden="true" />
                <span>{participant.availabilityNotice}</span>
              </div>
            )}
          </div>
        </div>

        {offline && !loading && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2 text-xs text-amber-800 shrink-0">
            <WifiOff className="size-3.5 shrink-0" />
            <span>
              {connectionStatus === "auth_failed"
                ? "Your session expired. Please sign in again to receive live messages."
                : "Live updates are paused while we reconnect. Your messages are still saved."}
            </span>
          </div>
        )}

        {/* Upcoming Consultation Reminder Banner (Contextual link, NOT a call room) */}
        {upcoming && (
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs text-slate-600 shrink-0">
            <div className="flex items-center gap-1.5 truncate">
              <Calendar className="size-3.5 text-slate-500 shrink-0" />
              <span className="truncate">
                Upcoming Consultation:{" "}
                <strong className="text-slate-800">
                  {new Date(upcoming.scheduledAt).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                  {upcoming.requestedTime ? ` · ${upcoming.requestedTime}` : ""}
                </strong>
              </span>
            </div>
            <Link
              href="/appointments"
              className="text-xs font-semibold text-slate-800 hover:text-emerald-800 underline underline-offset-2 shrink-0 ml-2"
            >
              View Appointment
            </Link>
          </div>
        )}

        {/* Messages Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 bg-slate-50">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full space-y-2 text-slate-600">
              <Loader2 className="size-6 animate-spin text-slate-500" />
              <p className="text-xs">Loading conversation...</p>
            </div>
          ) : error && messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full space-y-3 text-center text-slate-500 p-6">
              <AlertCircle className="size-6 text-slate-600" />
              <p className="text-xs max-w-xs">{error}</p>
              <button
                onClick={() => void chat.reload()}
                className="text-xs font-semibold text-slate-800 underline underline-offset-2 cursor-pointer"
              >
                Try again
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-1.5 p-6 text-slate-600">
              <p className="text-xs font-medium text-slate-700">
                Start a conversation with {participant?.name || "your therapist"}
              </p>
              <p className="text-xs text-slate-500 max-w-sm">
                Feel free to share recovery questions or symptoms. Messages are reviewed during clinic hours.
              </p>
            </div>
          ) : (
            messages.map((m) => {
              const isMine = m.senderId === selfId;
              return (
                <div key={m.clientId || m._id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                  <div
                    className={`max-w-[82%] px-3.5 py-2.5 rounded-lg text-sm leading-relaxed whitespace-pre-wrap break-words ${
                      isMine
                        ? `bg-emerald-700 text-white ${m.status === "failed" ? "opacity-70" : ""}`
                        : "bg-white text-slate-900 border border-slate-300"
                    }`}
                  >
                    {m.content}
                  </div>
                  <div className="text-xs text-slate-600 mt-1 px-1 flex items-center gap-1">
                    <span>
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {isMine && m.status === "sending" && <span>· Sending…</span>}
                    {isMine && m.status === "failed" && m.clientId && (
                      <button
                        onClick={() => void chat.retry(m.clientId!)}
                        className="flex items-center gap-1 text-red-600 font-semibold cursor-pointer"
                      >
                        <RotateCcw className="size-3" /> Not sent · Retry
                      </button>
                    )}
                    {isMine && m.status !== "sending" && m.status !== "failed" &&
                      (m.read ? (
                        <span className="flex items-center gap-0.5 text-emerald-700" aria-label="Read">
                          <CheckCheck className="size-3" /> Read
                        </span>
                      ) : (
                        <span className="flex items-center gap-0.5" aria-label="Delivered">
                          <Check className="size-3" /> Sent
                        </span>
                      ))}
                  </div>
                </div>
              );
            })
          )}
          {peerTyping && (
            <div
              className="flex items-center gap-1.5 text-xs text-slate-500 italic px-2 py-1 bg-slate-100/70 rounded-md w-fit"
              role="status"
            >
              <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-600" />
              <span>{participant?.name || "Therapist"} is typing...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {sendError && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-100 text-xs text-red-700 shrink-0" role="alert">
            {sendError}
          </div>
        )}

        {/* Input Bar */}
        <form
          onSubmit={handleSendMessage}
          className="p-3 bg-white border-t border-slate-100 flex items-center gap-2 shrink-0"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Type a message to your physiotherapist..."
            aria-label="Message"
            maxLength={4000}
            className="flex-1 h-10 px-3.5 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder:text-slate-500 hover:border-slate-500 focus-visible:border-emerald-600"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            className="h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-45 text-white text-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-3.5" />}
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    </AppShell>
  );
}
