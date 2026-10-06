/**
 * lib/realtime/server/realtimeServer.ts
 *
 * Realtime engine for RehabLens (runs inside the Next.js app: `server.ts` locally,
 * `app/api/ws/route.ts` on Vercel).
 *
 * - Identity comes only from a verified Clerk JWT; roles from MongoDB.
 * - Rooms are authorized server-side on join; every later packet must target a room
 *   the connection actually joined.
 * - Process memory is only a per-instance socket index. Cross-instance delivery,
 *   presence and call state live in MongoDB (see bus.ts, presence.ts, callService.ts).
 * - Clients may only send events in CLIENT_TO_SERVER_EVENTS; chat messages are
 *   persisted over REST (chatService.ts) and delivered through the same bus.
 */

import type { WebSocket as WSWebSocket } from "ws";
import { CLIENT_TO_SERVER_EVENTS, RealtimeErrorCode, RealtimeEvent, RealtimeEventType } from "../protocol/events";
import { parseRoom, Rooms } from "../protocol/rooms";
import type {
  AuthenticatedPayload,
  ErrorPayload,
  PresenceUpdatePayload,
  RealtimeIdentityInfo,
  RoomJoinedPayload,
  TypingRelayPayload,
} from "../protocol/packets";
import {
  parseEnvelope,
  validateAnswer,
  validateCallAccept,
  validateCallCancel,
  validateCallCreate,
  validateCallEnd,
  validateCallReject,
  validateIce,
  validateOffer,
} from "../protocol/validate";
import { authorizeUserForRoom, verifyRealtimeToken, VerifiedIdentity } from "../auth/verifier";
import { BusMessage, publish, setLocalDeliver, startBusWatcher } from "./bus";
import { addPresence, getRoomUsers, removePresence, touchPresence } from "./presence";
import * as calls from "./callService";

export interface ClientSession {
  connectionId: string;
  ws: WSWebSocket;
  identity: VerifiedIdentity | null;
  joinedRooms: Set<string>;
  ready: Promise<void>;
  closed: boolean;
  createdAt: number;
  windowStart: number;
  windowCount: number;
}

const RATE_WINDOW_MS = 10_000;
const RATE_LIMIT = 400;
const OPEN = 1;

const g = globalThis as unknown as { __rehablensRealtime?: RealtimeServer };

export class RealtimeServer {
  private sessions = new Map<string, ClientSession>();
  /** roomId → local connectionIds (per-instance socket index only). */
  private rooms = new Map<string, Set<string>>();

  private constructor() {
    setLocalDeliver((msg) => this.deliverLocal(msg));
    startBusWatcher();
    console.log("[Realtime Server] Engine initialised (MongoDB-backed bus)");
  }

  public static getInstance(): RealtimeServer {
    if (!g.__rehablensRealtime) g.__rehablensRealtime = new RealtimeServer();
    return g.__rehablensRealtime;
  }

  public get connectionCount(): number {
    return this.sessions.size;
  }

  // ── Connection lifecycle ──────────────────────────────────────────────────

  public registerClient(ws: WSWebSocket, initialToken?: string): string {
    const connectionId = `conn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const session: ClientSession = {
      connectionId,
      ws,
      identity: null,
      joinedRooms: new Set(),
      ready: Promise.resolve(),
      closed: false,
      createdAt: Date.now(),
      windowStart: Date.now(),
      windowCount: 0,
    };
    this.sessions.set(connectionId, session);

    if (initialToken) {
      session.ready = this.authenticate(session, initialToken);
    }

    ws.on("message", (raw: unknown) => {
      const text = typeof raw === "string" ? raw : (raw as { toString?: () => string })?.toString?.() || "";
      void this.onRawMessage(session, text);
    });
    ws.on("close", () => void this.onDisconnect(session));
    ws.on("error", () => {
      /* close handler performs cleanup; never log raw errors to clients */
    });

    return connectionId;
  }

  private async onRawMessage(session: ClientSession, text: string): Promise<void> {
    const now = Date.now();
    if (now - session.windowStart > RATE_WINDOW_MS) {
      session.windowStart = now;
      session.windowCount = 0;
    }
    if (++session.windowCount > RATE_LIMIT) {
      this.sendError(session, RealtimeErrorCode.RATE_LIMITED, "You are sending events too quickly.");
      return;
    }

    const envelope = parseEnvelope(text);
    if (!envelope) {
      this.sendError(session, RealtimeErrorCode.MALFORMED, "Malformed message.");
      return;
    }
    if (!CLIENT_TO_SERVER_EVENTS.has(envelope.event)) {
      this.sendError(session, RealtimeErrorCode.UNKNOWN_EVENT, "Unsupported event.");
      return;
    }

    try {
      if (envelope.event === RealtimeEvent.AUTHENTICATE) {
        const token = typeof envelope.payload.token === "string" ? envelope.payload.token : "";
        session.ready = this.authenticate(session, token);
        await session.ready;
        return;
      }
      await session.ready;
      if (session.closed) return;
      if (!session.identity) {
        this.sendError(session, RealtimeErrorCode.AUTH_REQUIRED, "Please sign in to continue.");
        return;
      }
      await this.dispatch(session, session.identity, envelope.event, envelope.payload, envelope.roomId);
    } catch (err) {
      if (err instanceof calls.CallError) {
        this.sendError(session, err.code, err.message);
      } else {
        console.error("[Realtime Server] Handler error:", err);
        this.sendError(session, RealtimeErrorCode.INTERNAL, "Something went wrong. Please try again.");
      }
    }
  }

  private async authenticate(session: ClientSession, token: string): Promise<void> {
    if (!token) {
      this.sendError(session, RealtimeErrorCode.AUTH_REQUIRED, "Authentication required.");
      return;
    }
    const identity = await verifyRealtimeToken(token);
    if (!identity) {
      this.sendError(session, RealtimeErrorCode.AUTH_FAILED, "Your session could not be verified. Please sign in again.");
      try {
        session.ws.close(4401, "unauthorized");
      } catch {
        /* already closed */
      }
      return;
    }
    if (session.closed) return;
    session.identity = identity;
    // Private notification channel — always allowed, and never announced via presence.
    this.addLocal(`user:${identity.userId}`, session);
    const payload: AuthenticatedPayload = {
      userId: identity.userId,
      role: identity.role,
      name: identity.name,
      sessionId: session.connectionId,
    };
    this.send(session, RealtimeEvent.AUTHENTICATED, payload);
  }

  // ── Dispatch ──────────────────────────────────────────────────────────────

  private async dispatch(
    session: ClientSession,
    me: VerifiedIdentity,
    event: RealtimeEventType,
    payload: Record<string, unknown>,
    roomId?: string
  ): Promise<void> {
    switch (event) {
      case RealtimeEvent.PING:
        void touchPresence(session.connectionId);
        this.send(session, RealtimeEvent.PONG, { timestamp: Date.now() });
        return;

      case RealtimeEvent.JOIN_ROOM:
        return this.joinRoom(session, me, String(payload.roomId ?? roomId ?? ""));

      case RealtimeEvent.LEAVE_ROOM:
        return this.leaveRoom(session, me, String(payload.roomId ?? roomId ?? ""));

      case RealtimeEvent.TYPING_START:
      case RealtimeEvent.TYPING_STOP:
        return this.relayTyping(session, me, event === RealtimeEvent.TYPING_START, String(payload.roomId ?? roomId ?? ""));

      case RealtimeEvent.CALL_CREATE: {
        const p = validateCallCreate(payload);
        if (!p) return this.malformed(session);
        this.requireRoom(session, Rooms.consultation(p.consultationId));
        const ctx = await calls.createCall(me, p.consultationId);
        this.requireRoom(session, ctx.roomId);
        await this.relay(ctx.roomId, RealtimeEvent.CALL_CREATE, { consultationId: ctx.consultationId }, me, true);
        return;
      }
      case RealtimeEvent.CALL_ACCEPT: {
        const p = validateCallAccept(payload);
        if (!p) return this.malformed(session);
        this.requireRoom(session, Rooms.consultation(p.consultationId));
        const ctx = await calls.acceptCall(me, p.consultationId);
        this.requireRoom(session, ctx.roomId);
        await this.relay(ctx.roomId, RealtimeEvent.CALL_ACCEPT, { consultationId: ctx.consultationId }, me, true);
        return;
      }
      case RealtimeEvent.CALL_REJECT: {
        const p = validateCallReject(payload);
        if (!p) return this.malformed(session);
        this.requireRoom(session, Rooms.consultation(p.consultationId));
        const ctx = await calls.rejectCall(me, p.consultationId);
        this.requireRoom(session, ctx.roomId);
        await this.relay(
          ctx.roomId,
          RealtimeEvent.CALL_REJECT,
          { consultationId: ctx.consultationId, reason: p.reason || "The call was declined." },
          me,
          true
        );
        return;
      }
      case RealtimeEvent.CALL_CANCEL: {
        const p = validateCallCancel(payload);
        if (!p) return this.malformed(session);
        this.requireRoom(session, Rooms.consultation(p.consultationId));
        const ctx = await calls.cancelCall(me, p.consultationId);
        this.requireRoom(session, ctx.roomId);
        await this.relay(ctx.roomId, RealtimeEvent.CALL_CANCEL, { consultationId: ctx.consultationId }, me, true);
        return;
      }
      case RealtimeEvent.CALL_END: {
        const p = validateCallEnd(payload);
        if (!p) return this.malformed(session);
        this.requireRoom(session, Rooms.consultation(p.consultationId));
        const ctx = await calls.endCall(me, p.consultationId, {
          duration: p.duration,
          concludeConsultation: p.concludeConsultation,
        });
        this.requireRoom(session, ctx.roomId);
        await this.relay(
          ctx.roomId,
          RealtimeEvent.CALL_END,
          {
            consultationId: ctx.consultationId,
            duration: p.duration,
            reason: p.reason || "hangup",
            consultationCompleted: Boolean(p.concludeConsultation),
          },
          me,
          true
        );
        return;
      }
      case RealtimeEvent.WEBRTC_OFFER: {
        const p = validateOffer(payload);
        if (!p) return this.malformed(session);
        this.requireRoom(session, Rooms.consultation(p.consultationId));
        const ctx = await calls.authorizeOffer(me, p.consultationId);
        this.requireRoom(session, ctx.roomId);
        await this.relay(ctx.roomId, RealtimeEvent.WEBRTC_OFFER, { consultationId: ctx.consultationId, sdp: p.sdp }, me, true);
        return;
      }
      case RealtimeEvent.WEBRTC_ANSWER: {
        const p = validateAnswer(payload);
        if (!p) return this.malformed(session);
        this.requireRoom(session, Rooms.consultation(p.consultationId));
        const ctx = await calls.authorizeAnswer(me, p.consultationId);
        this.requireRoom(session, ctx.roomId);
        await this.relay(ctx.roomId, RealtimeEvent.WEBRTC_ANSWER, { consultationId: ctx.consultationId, sdp: p.sdp }, me, true);
        return;
      }
      case RealtimeEvent.WEBRTC_ICE_CANDIDATE: {
        const p = validateIce(payload);
        if (!p) return this.malformed(session);
        this.requireRoom(session, Rooms.consultation(p.consultationId));
        const ctx = await calls.authorizeIce(me, p.consultationId);
        this.requireRoom(session, ctx.roomId);
        await this.relay(
          ctx.roomId,
          RealtimeEvent.WEBRTC_ICE_CANDIDATE,
          { consultationId: ctx.consultationId, candidate: p.candidate },
          me,
          true
        );
        return;
      }
      default:
        this.sendError(session, RealtimeErrorCode.UNKNOWN_EVENT, "Unsupported event.");
    }
  }

  // ── Rooms & presence ──────────────────────────────────────────────────────

  private async joinRoom(session: ClientSession, me: VerifiedIdentity, requested: string): Promise<void> {
    const parsed = parseRoom(requested);
    if (!parsed) {
      this.sendError(session, RealtimeErrorCode.FORBIDDEN, "You don't have access to this conversation.", requested || undefined);
      return;
    }

    const auth = await authorizeUserForRoom(me.userId, requested, me.role);
    if (!auth.authorized || !auth.roomId) {
      this.sendError(session, RealtimeErrorCode.FORBIDDEN, "You don't have access to this conversation.", requested);
      return;
    }
    if (session.closed) return;

    const roomId = auth.roomId;
    this.addLocal(roomId, session);
    const joined: RoomJoinedPayload & { requestedRoomId: string } = { roomId, requestedRoomId: requested };
    this.send(session, RealtimeEvent.ROOM_JOINED, joined, roomId);

    if (parsed.kind !== "user") {
      const who: RealtimeIdentityInfo = { userId: me.userId, role: me.role, name: me.name };
      await addPresence(session.connectionId, roomId, who);
      await this.announce(roomId, RealtimeEvent.USER_JOINED, who);
    }
  }

  private async leaveRoom(session: ClientSession, me: VerifiedIdentity, roomId: string): Promise<void> {
    if (!session.joinedRooms.has(roomId)) return;
    this.removeLocal(roomId, session);
    const parsed = parseRoom(roomId);
    if (parsed && parsed.kind !== "user") {
      await removePresence(session.connectionId, roomId);
      await this.announce(roomId, RealtimeEvent.USER_LEFT, { userId: me.userId, role: me.role, name: me.name });
    }
  }

  private async announce(
    roomId: string,
    event: typeof RealtimeEvent.USER_JOINED | typeof RealtimeEvent.USER_LEFT,
    who: RealtimeIdentityInfo
  ): Promise<void> {
    const users = await getRoomUsers(roomId);
    const presence: PresenceUpdatePayload = { roomId, activeUserCount: users.length, online: users.length > 0, users };
    await publish({ roomId, event: RealtimeEvent.PRESENCE_UPDATE, payload: presence });
    await publish({ roomId, event, payload: { roomId, userId: who.userId, role: who.role }, from: who });
  }

  private async onDisconnect(session: ClientSession): Promise<void> {
    session.closed = true;
    this.sessions.delete(session.connectionId);
    const rooms = [...session.joinedRooms];
    for (const roomId of rooms) this.removeLocal(roomId, session);
    const me = session.identity;
    if (!me) return;

    await removePresence(session.connectionId);
    for (const roomId of rooms) {
      const parsed = parseRoom(roomId);
      if (parsed && parsed.kind !== "user") {
        await this.announce(roomId, RealtimeEvent.USER_LEFT, { userId: me.userId, role: me.role, name: me.name });
      }
    }
  }

  private requireRoom(session: ClientSession, roomId: string): void {
    if (!session.joinedRooms.has(roomId)) {
      throw new calls.CallError(RealtimeErrorCode.NOT_IN_ROOM, "Join the consultation room first.");
    }
  }

  // ── Relays ────────────────────────────────────────────────────────────────

  private async relayTyping(session: ClientSession, me: VerifiedIdentity, isTyping: boolean, roomId: string): Promise<void> {
    const parsed = parseRoom(roomId);
    if (!parsed || parsed.kind === "user") return this.malformed(session);
    this.requireRoom(session, roomId);
    const payload: TypingRelayPayload = { roomId, userId: me.userId, role: me.role === "doctor" ? "doctor" : "patient", isTyping };
    await this.relay(roomId, isTyping ? RealtimeEvent.TYPING_START : RealtimeEvent.TYPING_STOP, payload, me, true);
  }

  private async relay(
    roomId: string,
    event: RealtimeEventType,
    payload: unknown,
    me: VerifiedIdentity,
    excludeSender: boolean
  ): Promise<void> {
    await publish({
      roomId,
      event,
      payload,
      from: { userId: me.userId, role: me.role, name: me.name },
      excludeUserId: excludeSender ? me.userId : undefined,
    });
  }

  // ── Local socket index & delivery ─────────────────────────────────────────

  private addLocal(roomId: string, session: ClientSession): void {
    let set = this.rooms.get(roomId);
    if (!set) this.rooms.set(roomId, (set = new Set()));
    set.add(session.connectionId);
    session.joinedRooms.add(roomId);
  }

  private removeLocal(roomId: string, session: ClientSession): void {
    session.joinedRooms.delete(roomId);
    const set = this.rooms.get(roomId);
    if (set) {
      set.delete(session.connectionId);
      if (set.size === 0) this.rooms.delete(roomId);
    }
  }

  private deliverLocal(msg: BusMessage): void {
    const ids = this.rooms.get(msg.roomId);
    if (!ids || ids.size === 0) return;
    const text = JSON.stringify({
      event: msg.event,
      roomId: msg.roomId,
      payload: msg.payload,
      from: msg.from,
      timestamp: Date.now(),
    });
    for (const id of ids) {
      if (msg.excludeConnectionId && id === msg.excludeConnectionId) continue;
      const s = this.sessions.get(id);
      if (!s || s.ws.readyState !== OPEN) continue;
      if (msg.excludeUserId && s.identity?.userId === msg.excludeUserId) continue;
      try {
        s.ws.send(text);
      } catch {
        /* socket closing; cleanup happens in close handler */
      }
    }
  }

  // ── Outbound helpers ──────────────────────────────────────────────────────

  private send(session: ClientSession, event: RealtimeEventType, payload: unknown, roomId?: string): void {
    if (session.ws.readyState !== OPEN) return;
    try {
      session.ws.send(JSON.stringify({ event, roomId, payload, timestamp: Date.now() }));
    } catch {
      /* ignore */
    }
  }

  private sendError(session: ClientSession, code: string, message: string, roomId?: string): void {
    const payload: ErrorPayload = { code, message, roomId };
    this.send(session, RealtimeEvent.ERROR, payload);
  }

  private malformed(session: ClientSession): void {
    this.sendError(session, RealtimeErrorCode.MALFORMED, "Malformed message.");
  }
}
