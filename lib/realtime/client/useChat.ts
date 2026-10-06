/**
 * lib/realtime/client/useChat.ts
 *
 * Chat over "REST persistence + realtime delivery":
 *   send → POST (authenticated, authorized, saved in MongoDB) → server publishes CHAT_MESSAGE
 *   receive → CHAT_MESSAGE over the realtime socket
 * MongoDB stays the source of truth: history loads over REST on mount and any messages
 * missed while offline are re-fetched (`since` cursor) every time the socket re-authenticates.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { RealtimeEvent } from "../protocol/events";
import type { ChatMessageDTO } from "../protocol/packets";
import { ConnectionStatus } from "./realtimeClient";
import { useRealtime } from "./useRealtime";

export type ChatDeliveryStatus = "sending" | "sent" | "failed";
export interface ChatMessageView extends ChatMessageDTO {
  status?: ChatDeliveryStatus;
}

export interface UseChatOptions {
  /** Requested realtime room (server resolves to the canonical id). Falsy → hook idle. */
  room: string | null | undefined;
  /** Current user's Clerk id (used to tell my messages from the peer's). */
  selfId: string | undefined;
  selfRole?: "patient" | "doctor";
  historyUrl: string | null;
  sendUrl: string | null;
  readUrl: string | null;
  /** Pull the message array out of the history response. */
  extractMessages: (json: unknown) => ChatMessageDTO[];
  /** Called with the full history response (e.g. to read participant info). */
  onHistory?: (json: unknown) => void;
  /** Set false while the room is not open (e.g. consultation window closed). */
  enabled?: boolean;
}

export interface UseChatResult {
  messages: ChatMessageView[];
  loading: boolean;
  error: string | null;
  sendError: string | null;
  connectionStatus: ConnectionStatus;
  peerTyping: boolean;
  peerOnline: boolean;
  send: (content: string) => Promise<boolean>;
  retry: (clientId: string) => Promise<boolean>;
  notifyTyping: (hasText: boolean) => void;
  markRead: () => void;
  reload: () => Promise<void>;
  /** Merge a message that arrived through another channel (e.g. a prescription). */
  ingest: (message: ChatMessageDTO) => void;
}

const TYPING_IDLE_MS = 3000;
const TYPING_SAFETY_MS = 6000;

function keyOf(m: ChatMessageDTO): string {
  return m.clientId ? `c:${m.clientId}` : `i:${m._id}`;
}

function merge(prev: ChatMessageView[], incoming: ChatMessageView[]): ChatMessageView[] {
  const map = new Map<string, ChatMessageView>();
  const byId = new Map<string, string>();
  for (const m of prev) {
    map.set(keyOf(m), m);
    byId.set(m._id, keyOf(m));
  }
  for (const m of incoming) {
    const existingKey = byId.get(m._id) ?? keyOf(m);
    const old = map.get(existingKey);
    const next: ChatMessageView = { ...old, ...m, read: Boolean(old?.read || m.read) };
    if (!m.status) next.status = m._id.startsWith("local-") ? old?.status : "sent";
    map.delete(existingKey);
    map.set(keyOf(next), next);
    byId.set(next._id, keyOf(next));
  }
  return [...map.values()].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

export function useChat(options: UseChatOptions): UseChatResult {
  const { room, historyUrl, enabled = true } = options;
  const { client, status } = useRealtime();
  const { getToken } = useAuth();

  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [peerTyping, setPeerTyping] = useState(false);
  const [peerOnline, setPeerOnline] = useState(false);
  const [canonicalRoom, setCanonicalRoom] = useState<string | null>(null);

  // Latest options/callbacks without re-subscribing every render.
  const optsRef = useRef(options);
  const getTokenRef = useRef(getToken);
  const messagesRef = useRef<ChatMessageView[]>([]);
  const typingStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingSafetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iAmTyping = useRef(false);
  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    optsRef.current = options;
    getTokenRef.current = getToken;
    messagesRef.current = messages;
  });

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = await getTokenRef.current();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const load = useCallback(
    async (resync: boolean) => {
      const o = optsRef.current;
      if (!o.historyUrl || o.enabled === false) return;
      try {
        let url = o.historyUrl;
        if (resync) {
          const lastServer = [...messagesRef.current].reverse().find((m) => !m._id.startsWith("local-"));
          if (lastServer) url += `${url.includes("?") ? "&" : "?"}since=${encodeURIComponent(lastServer.createdAt)}`;
        }
        const res = await fetch(url, { headers: await authHeaders(), cache: "no-store" });
        const json = await res.json();
        if (!res.ok) {
          setError(json?.error || "Unable to load messages. Please try again.");
          return;
        }
        o.onHistory?.(json.data);
        setMessages((prev) => merge(prev, o.extractMessages(json.data) as ChatMessageView[]));
        setError(null);
      } catch {
        setError("Unable to reach the messaging service. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    },
    [authHeaders]
  );

  const markRead = useCallback(() => {
    if (readTimer.current) clearTimeout(readTimer.current);
    readTimer.current = setTimeout(async () => {
      const o = optsRef.current;
      if (!o.readUrl || o.enabled === false) return;
      const hasUnread = messagesRef.current.some((m) => m.receiverId === o.selfId && !m.read);
      if (!hasUnread) return;
      try {
        await fetch(o.readUrl, { method: "POST", headers: await authHeaders() });
        setMessages((prev) => prev.map((m) => (m.receiverId === o.selfId ? { ...m, read: true } : m)));
      } catch {
        /* retried on next incoming message */
      }
    }, 400);
  }, [authHeaders]);

  // Initial history (REST — works even before the socket is up).
  useEffect(() => {
    if (!historyUrl || !enabled) return;
    void load(false);
  }, [historyUrl, enabled, load]);

  // Room membership + realtime events.
  useEffect(() => {
    if (!room || !enabled) return;
    let cancelled = false;

    client
      .joinRoom(room)
      .then((canonical) => {
        if (!cancelled) setCanonicalRoom(canonical);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || "You don't have access to this conversation.");
      });

    const offs = [
      client.on(RealtimeEvent.CHAT_MESSAGE, (msg) => {
        setMessages((prev) => merge(prev, [msg as ChatMessageView]));
        if (msg.senderId !== optsRef.current.selfId) {
          setPeerTyping(false);
          markRead();
        }
      }),
      client.on(RealtimeEvent.MESSAGE_READ, (p) => {
        if (p.readerId === optsRef.current.selfId) return;
        const ids = new Set(p.messageIds);
        setMessages((prev) => prev.map((m) => (ids.has(m._id) ? { ...m, read: true } : m)));
      }),
      client.on(RealtimeEvent.TYPING_START, (p) => {
        if (p.userId === optsRef.current.selfId) return;
        setPeerTyping(true);
        if (typingSafetyTimer.current) clearTimeout(typingSafetyTimer.current);
        typingSafetyTimer.current = setTimeout(() => setPeerTyping(false), TYPING_SAFETY_MS);
      }),
      client.on(RealtimeEvent.TYPING_STOP, (p) => {
        if (p.userId !== optsRef.current.selfId) setPeerTyping(false);
      }),
      client.on(RealtimeEvent.PRESENCE_UPDATE, (p) => {
        setPeerOnline(p.users.some((u) => u.userId !== optsRef.current.selfId));
      }),
      client.onReady(({ reconnected }) => {
        if (reconnected) void load(true);
      }),
    ];

    return () => {
      cancelled = true;
      offs.forEach((off) => off());
      client.leaveRoom(room);
      setCanonicalRoom(null);
      setPeerTyping(false);
      setPeerOnline(false);
    };
  }, [client, room, enabled, load, markRead]);

  // Mark messages read once history is visible.
  useEffect(() => {
    if (!loading) markRead();
  }, [loading, markRead]);

  useEffect(
    () => () => {
      if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
      if (typingSafetyTimer.current) clearTimeout(typingSafetyTimer.current);
      if (readTimer.current) clearTimeout(readTimer.current);
    },
    []
  );

  const stopTyping = useCallback(() => {
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    if (iAmTyping.current && canonicalRoom) {
      client.emit(RealtimeEvent.TYPING_STOP, { roomId: canonicalRoom }, canonicalRoom);
    }
    iAmTyping.current = false;
  }, [client, canonicalRoom]);

  const notifyTyping = useCallback(
    (hasText: boolean) => {
      if (!canonicalRoom) return;
      if (!hasText) return stopTyping();
      if (!iAmTyping.current) {
        iAmTyping.current = true;
        client.emit(RealtimeEvent.TYPING_START, { roomId: canonicalRoom }, canonicalRoom);
      }
      if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
      typingStopTimer.current = setTimeout(stopTyping, TYPING_IDLE_MS);
    },
    [client, canonicalRoom, stopTyping]
  );

  const post = useCallback(
    async (content: string, clientId: string): Promise<boolean> => {
      const o = optsRef.current;
      if (!o.sendUrl) return false;
      try {
        const res = await fetch(o.sendUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await authHeaders()) },
          body: JSON.stringify({ content, clientId }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) {
          setSendError(json?.error || "Message could not be sent.");
          setMessages((prev) => prev.map((m) => (m.clientId === clientId ? { ...m, status: "failed" } : m)));
          return false;
        }
        setSendError(null);
        setMessages((prev) => merge(prev, [{ ...(json.data as ChatMessageDTO), status: "sent" }]));
        return true;
      } catch {
        setSendError("You appear to be offline. Your message was not sent — tap retry.");
        setMessages((prev) => prev.map((m) => (m.clientId === clientId ? { ...m, status: "failed" } : m)));
        return false;
      }
    },
    [authHeaders]
  );

  const send = useCallback(
    async (content: string): Promise<boolean> => {
      const text = content.trim();
      const o = optsRef.current;
      if (!text || !o.selfId) return false;
      stopTyping();
      const clientId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const optimistic: ChatMessageView = {
        _id: `local-${clientId}`,
        clientId,
        senderId: o.selfId,
        senderRole: o.selfRole ?? "patient",
        content: text,
        type: "text",
        read: false,
        createdAt: new Date().toISOString(),
        status: "sending",
      };
      setMessages((prev) => merge(prev, [optimistic]));
      return post(text, clientId);
    },
    [post, stopTyping]
  );

  const retry = useCallback(
    async (clientId: string): Promise<boolean> => {
      const failed = messagesRef.current.find((m) => m.clientId === clientId);
      if (!failed) return false;
      setMessages((prev) => prev.map((m) => (m.clientId === clientId ? { ...m, status: "sending" } : m)));
      return post(failed.content, clientId);
    },
    [post]
  );

  const reload = useCallback(() => load(true), [load]);
  const ingest = useCallback((message: ChatMessageDTO) => {
    setMessages((prev) => merge(prev, [message as ChatMessageView]));
  }, []);

  return {
    messages,
    loading,
    error,
    sendError,
    connectionStatus: status,
    peerTyping,
    peerOnline,
    send,
    retry,
    notifyTyping,
    markRead,
    reload,
    ingest,
  };
}
