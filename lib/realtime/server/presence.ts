/**
 * lib/realtime/server/presence.ts
 *
 * Database-backed presence so counts are correct across serverless instances.
 */

import connectToDatabase from "@/lib/mongodb";
import RealtimePresence from "@/models/RealtimePresence";
import type { RealtimeIdentityInfo, RealtimeRole } from "../protocol/packets";

export const PRESENCE_TTL_MS = 90_000;

const expiry = () => new Date(Date.now() + PRESENCE_TTL_MS);

export async function addPresence(
  connectionId: string,
  roomId: string,
  identity: RealtimeIdentityInfo
): Promise<void> {
  try {
    await connectToDatabase();
    await RealtimePresence.findOneAndUpdate(
      { key: `${connectionId}:${roomId}` },
      {
        $set: {
          roomId,
          connectionId,
          userId: identity.userId,
          role: identity.role,
          name: identity.name,
          expireAt: expiry(),
        },
      },
      { upsert: true }
    );
  } catch (err) {
    console.warn("[Realtime Presence] add failed:", err);
  }
}

export async function removePresence(connectionId: string, roomId?: string): Promise<void> {
  try {
    await connectToDatabase();
    await RealtimePresence.deleteMany(roomId ? { key: `${connectionId}:${roomId}` } : { connectionId });
  } catch (err) {
    console.warn("[Realtime Presence] remove failed:", err);
  }
}

export async function touchPresence(connectionId: string): Promise<void> {
  try {
    await connectToDatabase();
    await RealtimePresence.updateMany({ connectionId }, { $set: { expireAt: expiry() } });
  } catch {
    /* presence is best-effort */
  }
}

/** Distinct users currently present in a room (any instance). */
export async function getRoomUsers(roomId: string): Promise<RealtimeIdentityInfo[]> {
  try {
    await connectToDatabase();
    const docs = await RealtimePresence.find({ roomId, expireAt: { $gt: new Date() } }).lean<
      { userId: string; role: string; name?: string }[]
    >();
    const byUser = new Map<string, RealtimeIdentityInfo>();
    for (const d of docs) {
      if (!byUser.has(d.userId)) {
        byUser.set(d.userId, { userId: d.userId, role: d.role as RealtimeRole, name: d.name });
      }
    }
    return [...byUser.values()];
  } catch {
    return [];
  }
}

export async function isUserPresent(roomId: string, userId: string): Promise<boolean> {
  try {
    await connectToDatabase();
    return Boolean(await RealtimePresence.exists({ roomId, userId, expireAt: { $gt: new Date() } }));
  } catch {
    return false;
  }
}
