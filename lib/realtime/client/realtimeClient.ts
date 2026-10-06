/**
 * lib/realtime/client/realtimeClient.ts
 *
 * Browser realtime client for RehabLens. Native WebSocket, no dependencies.
 *
 *  - Authenticates with a fresh Clerk JWT on every (re)connect (`?token=`); the server
 *    answers AUTHENTICATED, and only then are rooms re-joined.
 *  - Automatic reconnect with exponential backoff + jitter, connect timeout, heartbeat
 *    with dead-connection detection, and immediate retry when the browser comes back
 *    online / the tab becomes visible.
 *  - Typed events only (see protocol/events.ts). Components should use the hooks
 *    (useRealtime / useChat / useConsultation) rather than this class directly.
 *  - Nothing is queued while offline: realtime state (typing, signaling) is ephemeral
 *    and durable data is re-fetched from MongoDB after reconnect via `onReady`.
 */

import { RealtimeEvent, RealtimeEventType } from "../protocol/events";
import type { RealtimePacket, ServerEventPayloads } from "../protocol/packets";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "reconnecting" | "auth_failed";

export type RealtimeHandler<E extends keyof ServerEventPayloads> = (
  payload: ServerEventPayloads[E],
  packet: RealtimePacket<ServerEventPayloads[E]>
) => void;

export interface RealtimeClientOptions {
  url?: string;
  tokenProvider?: () => Promise<string | null>;
  maxReconnectAttempts?: number;
}

const CONNECT_TIMEOUT_MS = 10_000;
const HEARTBEAT_MS = 25_000;
const PONG_TIMEOUT_MS = 10_000;
const MAX_AUTH_FAILURES = 3;

export class RealtimeClient {
  private ws: WebSocket | null = null;
  private status: ConnectionStatus = "disconnected";
  private tokenProvider: (() => Promise<string | null>) | null = null;
  private url: string | null = null;

  private handlers = new Map<string, Set<(payload: never, packet: never) => void>>();
  private statusListeners = new Set<() => void>();
  private readyListeners = new Set<(info: { reconnected: boolean }) => void>();

  /** Rooms the app wants to be in (requested id → canonical id once the server confirms). */
  private desiredRooms = new Map<string, string | null>();
  /** Several hooks may want the same room; only leave it when the last one lets go. */
  private roomRefs = new Map<string, number>();
  private pendingJoins = new Map<string, { resolve: (roomId: string) => void; reject: (err: Error) => void }[]>();

  private reconnectAttempts = 0;
  private authFailures = 0;
  private maxReconnectAttempts = 30;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private hasConnectedBefore = false;
  private manualDisconnect = false;
  private connecting = false;
  private browserHooksInstalled = false;

  public constructor(options?: RealtimeClientOptions) {
    if (options?.tokenProvider) this.tokenProvider = options.tokenProvider;
    if (options?.url) this.url = options.url;
    if (options?.maxReconnectAttempts !== undefined) this.maxReconnectAttempts = options.maxReconnectAttempts;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  public setTokenProvider(provider: () => Promise<string | null>): void {
    this.tokenProvider = provider;
  }

  public getStatus = (): ConnectionStatus => this.status;

  public get connected(): boolean {
    return this.status === "connected" && this.ws?.readyState === WebSocket.OPEN;
  }

  public subscribeStatus = (listener: () => void): (() => void) => {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  };

  /** Fires after every successful (re)authentication. Use it to resync durable state from MongoDB. */
  public onReady(listener: (info: { reconnected: boolean }) => void): () => void {
    this.readyListeners.add(listener);
    if (this.connected) listener({ reconnected: false });
    return () => {
      this.readyListeners.delete(listener);
    };
  }

  public on<E extends keyof ServerEventPayloads>(event: E, handler: RealtimeHandler<E>): () => void {
    let set = this.handlers.get(event);
    if (!set) this.handlers.set(event, (set = new Set()));
    set.add(handler as unknown as (payload: never, packet: never) => void);
    return () => {
      set!.delete(handler as unknown as (payload: never, packet: never) => void);
    };
  }

  public async connect(): Promise<void> {
    if (typeof window === "undefined" || this.connecting) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    if (!this.tokenProvider) return;

    this.installBrowserHooks();
    this.manualDisconnect = false;
    this.connecting = true;
    this.setStatus(this.hasConnectedBefore || this.reconnectAttempts > 0 ? "reconnecting" : "connecting");

    let token: string | null = null;
    try {
      token = await this.tokenProvider();
    } catch {
      token = null;
    }
    if (!token) {
      this.connecting = false;
      this.scheduleReconnect();
      return;
    }
    if (this.manualDisconnect) {
      this.connecting = false;
      return;
    }

    try {
      const ws = new WebSocket(this.resolveUrl(token));
      this.ws = ws;
      this.connecting = false;

      this.connectTimer = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN || this.status !== "connected") ws.close();
      }, CONNECT_TIMEOUT_MS);

      ws.onmessage = (event) => this.onMessage(event.data);
      ws.onclose = (event) => this.onClose(ws, event);
      ws.onerror = () => {
        /* onclose follows and drives reconnect */
      };
    } catch {
      this.connecting = false;
      this.scheduleReconnect();
    }
  }

  public disconnect(): void {
    this.manualDisconnect = true;
    this.clearTimers();
    this.ws?.close();
    this.ws = null;
    this.hasConnectedBefore = false;
    this.setStatus("disconnected");
  }

  /** Send a typed client event. Returns false if the socket is not ready (ephemeral events are dropped). */
  public emit(event: RealtimeEventType, payload: Record<string, unknown> = {}, roomId?: string): boolean {
    if (!this.connected || !this.ws) return false;
    this.ws.send(JSON.stringify({ event, roomId, payload, timestamp: Date.now() }));
    return true;
  }

  /**
   * Subscribe to a room. Resolves with the canonical room id once the server has authorized
   * the join; rejects if access is denied. The subscription survives reconnects.
   */
  public joinRoom(requestedRoomId: string): Promise<string> {
    if (!requestedRoomId) return Promise.reject(new Error("Room is required"));
    this.roomRefs.set(requestedRoomId, (this.roomRefs.get(requestedRoomId) ?? 0) + 1);
    const known = this.desiredRooms.get(requestedRoomId);
    if (!this.desiredRooms.has(requestedRoomId)) this.desiredRooms.set(requestedRoomId, null);

    const promise = new Promise<string>((resolve, reject) => {
      if (known && this.connected) {
        resolve(known);
        return;
      }
      const list = this.pendingJoins.get(requestedRoomId) ?? [];
      list.push({ resolve, reject });
      this.pendingJoins.set(requestedRoomId, list);
    });

    if (this.connected && !known) this.emit(RealtimeEvent.JOIN_ROOM, { roomId: requestedRoomId });
    else if (!this.connected) void this.connect();
    return promise;
  }

  public leaveRoom(requestedRoomId: string): void {
    const refs = (this.roomRefs.get(requestedRoomId) ?? 1) - 1;
    if (refs > 0) {
      this.roomRefs.set(requestedRoomId, refs);
      return;
    }
    this.roomRefs.delete(requestedRoomId);
    const canonical = this.desiredRooms.get(requestedRoomId);
    this.desiredRooms.delete(requestedRoomId);
    this.pendingJoins.delete(requestedRoomId);
    if (canonical) this.emit(RealtimeEvent.LEAVE_ROOM, { roomId: canonical }, canonical);
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private resolveUrl(token: string): string {
    const q = `token=${encodeURIComponent(token)}`;
    const base =
      this.url ||
      process.env.NEXT_PUBLIC_WS_URL ||
      // Trailing slash matters: next.config has trailingSlash:true and WebSockets cannot follow the 308 redirect.
      `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/api/ws/`;
    return `${base}${base.includes("?") ? "&" : "?"}${q}`;
  }

  private onMessage(data: unknown): void {
    let packet: RealtimePacket;
    try {
      packet = JSON.parse(String(data));
    } catch {
      return;
    }
    if (!packet?.event) return;

    switch (packet.event) {
      case RealtimeEvent.PONG:
        if (this.pongTimer) clearTimeout(this.pongTimer);
        this.pongTimer = null;
        return;
      case RealtimeEvent.AUTHENTICATED:
        this.onAuthenticated();
        break;
      case RealtimeEvent.ROOM_JOINED: {
        const p = packet.payload as ServerEventPayloads["ROOM_JOINED"];
        const requested = p.requestedRoomId || p.roomId;
        this.desiredRooms.set(requested, p.roomId);
        const waiting = this.pendingJoins.get(requested);
        this.pendingJoins.delete(requested);
        waiting?.forEach((w) => w.resolve(p.roomId));
        break;
      }
      case RealtimeEvent.ERROR: {
        const p = packet.payload as ServerEventPayloads["ERROR"];
        if (p.roomId) {
          const waiting = this.pendingJoins.get(p.roomId);
          this.pendingJoins.delete(p.roomId);
          this.desiredRooms.delete(p.roomId);
          waiting?.forEach((w) => w.reject(new Error(p.message)));
        }
        break;
      }
    }
    this.dispatch(packet.event, packet);
  }

  private onAuthenticated(): void {
    if (this.connectTimer) clearTimeout(this.connectTimer);
    this.connectTimer = null;
    const reconnected = this.hasConnectedBefore;
    this.hasConnectedBefore = true;
    this.reconnectAttempts = 0;
    this.authFailures = 0;
    this.setStatus("connected");
    this.startHeartbeat();

    for (const requested of this.desiredRooms.keys()) {
      this.emit(RealtimeEvent.JOIN_ROOM, { roomId: requested });
    }
    for (const listener of Array.from(this.readyListeners)) {
      try {
        listener({ reconnected });
      } catch (err) {
        console.error("[RealtimeClient] onReady listener failed:", err);
      }
    }
  }

  private onClose(ws: WebSocket, event: CloseEvent): void {
    if (this.ws !== ws) return;
    this.ws = null;
    this.clearTimers();

    // Rooms must be re-confirmed by the server after the next authentication.
    for (const key of this.desiredRooms.keys()) this.desiredRooms.set(key, null);

    if (this.manualDisconnect) {
      this.setStatus("disconnected");
      return;
    }
    if (event.code === 4401) {
      this.authFailures++;
      if (this.authFailures >= MAX_AUTH_FAILURES) {
        this.setStatus("auth_failed");
        this.rejectAllPending(new Error("Your session could not be verified. Please sign in again."));
        return;
      }
    }
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.manualDisconnect) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setStatus("disconnected");
      return;
    }
    this.setStatus("reconnecting");
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.6, this.reconnectAttempts - 1), 15_000) + Math.random() * 500;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => void this.connect(), delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.connected) return;
      this.emit(RealtimeEvent.PING);
      if (this.pongTimer) clearTimeout(this.pongTimer);
      this.pongTimer = setTimeout(() => this.ws?.close(), PONG_TIMEOUT_MS);
    }, HEARTBEAT_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.pongTimer) clearTimeout(this.pongTimer);
    this.heartbeatTimer = null;
    this.pongTimer = null;
  }

  private clearTimers(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.connectTimer) clearTimeout(this.connectTimer);
    this.reconnectTimer = null;
    this.connectTimer = null;
  }

  private rejectAllPending(err: Error): void {
    for (const list of this.pendingJoins.values()) list.forEach((w) => w.reject(err));
    this.pendingJoins.clear();
  }

  private installBrowserHooks(): void {
    if (this.browserHooksInstalled || typeof window === "undefined") return;
    this.browserHooksInstalled = true;
    const retryNow = () => {
      if (this.manualDisconnect || this.connected || this.status === "auth_failed") return;
      this.reconnectAttempts = 0;
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      void this.connect();
    };
    window.addEventListener("online", retryNow);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") retryNow();
    });
  }

  private setStatus(next: ConnectionStatus): void {
    if (this.status === next) return;
    this.status = next;
    for (const l of Array.from(this.statusListeners)) l();
  }

  private dispatch(event: string, packet: RealtimePacket): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of Array.from(set)) {
      try {
        (handler as (p: unknown, k: unknown) => void)(packet.payload, packet);
      } catch (err) {
        console.error(`[RealtimeClient] Listener for ${event} failed:`, err);
      }
    }
  }
}

let defaultClient: RealtimeClient | null = null;

export function getRealtimeClient(): RealtimeClient {
  if (!defaultClient) defaultClient = new RealtimeClient();
  return defaultClient;
}
