"use client";

import { use, useEffect, useState, useRef } from "react";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import {
  Send,
  Loader2,
  Calendar,
  AlertCircle,
  Clock,
  ChevronLeft,
} from "lucide-react";
import { useAuth, useUser } from "@clerk/react";
import { getSocket } from "@/lib/socket";
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

interface ChatMessageItem {
  _id?: string;
  senderId: string;
  senderRole: "patient" | "doctor" | "system";
  content: string;
  createdAt: string;
}

interface UpcomingAppointmentInfo {
  _id: string;
  scheduledAt: string;
  requestedTime?: string;
  status: string;
}

export default function DirectChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const targetId = resolvedParams.id;
  const { getToken } = useAuth();
  const { user } = useUser();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingAppointmentInfo | null>(null);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadChat() {
      try {
        setLoading(true);
        const token = await getToken();
        const res = await fetch(`/api/chat/${targetId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await res.json();
        if (json.success && json.data) {
          setParticipant(json.data.participant);
          setMessages(json.data.messages || []);
          setUpcoming(json.data.upcomingAppointment || null);
        } else {
          setError(json.error || "Unable to load conversation.");
        }
      } catch (err) {
        console.error("Failed to load chat:", err);
        setError("Unable to connect to messaging service.");
      } finally {
        setLoading(false);
      }
    }
    loadChat();
  }, [targetId, getToken]);

  // Real-time socket message reception
  useEffect(() => {
    const socket = getSocket();
    const handleNewMessage = (msg: ChatMessageItem) => {
      if (
        (msg.senderId === targetId && user?.id) ||
        msg.senderId === user?.id
      ) {
        setMessages((prev) => {
          if (msg._id && prev.some((m) => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
      }
    };

    socket.on("new_message", handleNewMessage);
    return () => {
      socket.off("new_message", handleNewMessage);
    };
  }, [targetId, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || sending) return;

    const text = inputText.trim();
    setInputText("");
    setSending(true);

    try {
      const token = await getToken();
      const res = await fetch(`/api/chat/${targetId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content: text }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setMessages((prev) => [...prev, json.data]);
        const socket = getSocket();
        socket.emit("send_message", {
          ...json.data,
          targetUserId: targetId,
        });
      }
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setSending(false);
    }
  };

  return (
    <AppShell hideHeader>
      <div className="max-w-2xl mx-auto w-full flex flex-col h-[calc(100dvh-5rem)] md:h-[calc(100vh-7rem)] bg-white rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden my-1 sm:my-3">
        {/* Top Header */}
        <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3 bg-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/appointments"
              className="p-1 -ml-1 text-slate-400 hover:text-slate-700 transition-colors"
              aria-label="Back to appointments"
            >
              <ChevronLeft className="size-5" />
            </Link>

            <DoctorAvatar
              src={participant?.avatarUrl}
              name={participant?.name || "Doctor"}
              size="sm"
              isOnline={false}
              className="size-10 shrink-0"
            />

            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-slate-900 leading-snug truncate">
                {participant?.name || "Doctor"}
              </h1>
              <p className="text-[11px] text-slate-500 truncate">
                {participant?.specialization || "Clinical Physiotherapist"}
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 shrink-0">
            <Clock className="size-3.5 text-slate-400" />
            <span className="text-[11px]">Replies 9 AM – 6 PM</span>
          </div>
        </div>

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
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 bg-[#FBFBFD]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full space-y-2 text-slate-400">
              <Loader2 className="size-6 animate-spin text-slate-500" />
              <p className="text-xs">Loading conversation...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full space-y-2 text-center text-slate-500 p-6">
              <AlertCircle className="size-6 text-slate-400" />
              <p className="text-xs">{error}</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-1.5 p-6 text-slate-400">
              <p className="text-xs font-medium text-slate-700">
                Start a conversation with {participant?.name || "your therapist"}
              </p>
              <p className="text-[11px] text-slate-500 max-w-sm">
                Feel free to share recovery questions or symptoms. Messages are reviewed during clinic hours.
              </p>
            </div>
          ) : (
            messages.map((m, idx) => {
              const isMine = m.senderId === user?.id;
              return (
                <div
                  key={m._id || idx}
                  className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                      isMine
                        ? "bg-slate-900 text-white rounded-br-xs shadow-2xs"
                        : "bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs shadow-2xs"
                    }`}
                  >
                    {m.content}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 px-1">
                    {new Date(m.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleSendMessage}
          className="p-3 bg-white border-t border-slate-100 flex items-center gap-2 shrink-0"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message to your physiotherapist..."
            className="flex-1 h-10 px-3.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            className="h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-3.5" />}
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    </AppShell>
  );
}
