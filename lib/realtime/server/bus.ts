/**
 * lib/realtime/server/bus.ts
 *
 * Cross-instance realtime bus backed by MongoDB.
 *
 * On Vercel a patient's and a therapist's WebSockets usually land on DIFFERENT function
 * instances, so process memory cannot be used to route events between them. Instead every
 * fan-out is written to the short-lived `RealtimeSignal` collection and every instance
 * tails it (MongoDB change stream; polling fallback when change streams are unavailable,
 * e.g. a standalone local mongod) and forwards to the sockets it holds.
 *
 * Instances deliver their own publishes locally right away and tag the document with
 * `originInstanceId` so their own watcher skips it (no double delivery).
 */

import connectToDatabase from "@/lib/mongodb";
import RealtimeSignal from "@/models/RealtimeSignal";
import type { RealtimeEventType } from "../protocol/events";
import type { RealtimeIdentityInfo } from "../protocol/packets";

export interface BusMessage {
  roomId: string;
  event: RealtimeEventType;
  payload: unknown;
  from?: RealtimeIdentityInfo;
  excludeUserId?: string;
  excludeConnectionId?: string;
}

type LocalDeliver = (msg: BusMessage) => void;

interface BusState {
  instanceId: string;
  deliver: LocalDeliver | null;
  watcherStarted: boolean;
  seen: Set<string>;
  lastSeen: number;
  pollTimer: ReturnType<typeof setInterval> | null;
  stream: { close: () => Promise<void> | void } | null;
}

const g = globalThis as unknown as { __rehablensBus?: BusState };

function state(): BusState {
  if (!g.__rehablensBus) {
    g.__rehablensBus = {
      instanceId: `inst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
      deliver: null,
      watcherStarted: false,
      seen: new Set(),
      lastSeen: Date.now(),
      pollTimer: null,
      stream: null,
    };
  }
  return g.__rehablensBus;
}

export function getInstanceId(): string {
  return state().instanceId;
}

export function setLocalDeliver(fn: LocalDeliver | null): void {
  state().deliver = fn;
}

/** Publish an event to a room on every instance (and to local sockets immediately). */
export async function publish(msg: BusMessage): Promise<void> {
  const s = state();
  try {
    s.deliver?.(msg);
  } catch (err) {
    console.warn("[Realtime Bus] Local delivery failed:", err);
  }
  try {
    await connectToDatabase();
    await RealtimeSignal.create({
      roomId: msg.roomId,
      event: msg.event,
      payload: msg.payload,
      from: msg.from,
      excludeUserId: msg.excludeUserId,
      excludeConnectionId: msg.excludeConnectionId,
      originInstanceId: s.instanceId,
    });
  } catch (err) {
    console.error("[Realtime Bus] Failed to publish signal:", err);
  }
}

interface SignalDoc {
  _id: { toString(): string };
  roomId: string;
  event: RealtimeEventType;
  payload: unknown;
  from?: RealtimeIdentityInfo;
  excludeUserId?: string;
  excludeConnectionId?: string;
  originInstanceId: string;
  createdAt?: Date;
}

function handleRemote(doc: SignalDoc): void {
  const s = state();
  if (!doc || doc.originInstanceId === s.instanceId) return;
  const id = doc._id.toString();
  if (s.seen.has(id)) return;
  s.seen.add(id);
  if (s.seen.size > 5000) {
    const first = s.seen.values().next().value;
    if (first) s.seen.delete(first);
  }
  if (doc.createdAt) s.lastSeen = Math.max(s.lastSeen, new Date(doc.createdAt).getTime());
  try {
    s.deliver?.({
      roomId: doc.roomId,
      event: doc.event,
      payload: doc.payload,
      from: doc.from,
      excludeUserId: doc.excludeUserId,
      excludeConnectionId: doc.excludeConnectionId,
    });
  } catch (err) {
    console.warn("[Realtime Bus] Remote delivery failed:", err);
  }
}

function startPolling(): void {
  const s = state();
  if (s.pollTimer) return;
  console.warn("[Realtime Bus] Change streams unavailable — falling back to polling");
  s.lastSeen = Date.now();
  s.pollTimer = setInterval(async () => {
    try {
      const docs = (await RealtimeSignal.find({ createdAt: { $gte: new Date(s.lastSeen - 1500) } })
        .sort({ createdAt: 1 })
        .limit(500)
        .lean()) as unknown as SignalDoc[];
      for (const d of docs) handleRemote(d);
    } catch (err) {
      console.warn("[Realtime Bus] Poll failed:", err);
    }
  }, 700);
}

function stopPolling(): void {
  const s = state();
  if (s.pollTimer) {
    clearInterval(s.pollTimer);
    s.pollTimer = null;
  }
}

/** Idempotent. Starts tailing the signal collection for this process. */
export function startBusWatcher(): void {
  const s = state();
  if (s.watcherStarted) return;
  s.watcherStarted = true;
  void openStream();
}

async function openStream(): Promise<void> {
  const s = state();
  try {
    await connectToDatabase();
    // Make sure the TTL index exists before the first publish.
    await RealtimeSignal.init().catch(() => undefined);
    const stream = RealtimeSignal.watch([{ $match: { operationType: "insert" } }]);
    s.stream = stream;
    stopPolling();
    stream.on("change", (change: { fullDocument?: SignalDoc }) => {
      if (change.fullDocument) handleRemote(change.fullDocument);
    });
    const recover = (err?: unknown) => {
      if (s.stream !== stream) return;
      s.stream = null;
      console.warn("[Realtime Bus] Change stream closed:", err instanceof Error ? err.message : err);
      startPolling();
      setTimeout(() => void openStream(), 15_000);
    };
    stream.on("error", recover);
    stream.on("close", () => recover());
  } catch (err) {
    console.warn("[Realtime Bus] Could not open change stream:", err instanceof Error ? err.message : err);
    startPolling();
    setTimeout(() => void openStream(), 30_000);
  }
}

export async function stopBusWatcher(): Promise<void> {
  const s = state();
  stopPolling();
  if (s.stream) {
    try {
      await s.stream.close();
    } catch {
      /* ignore */
    }
    s.stream = null;
  }
  s.watcherStarted = false;
}
