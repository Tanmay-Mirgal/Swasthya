/**
 * lib/realtime/protocol/rooms.ts
 *
 * Deterministic room identifiers. Clients never invent rooms: the server derives
 * and authorizes them from database records.
 *
 *   user:<clerkUserId>            private notification channel
 *   conversation:<idA>_<idB>      direct chat (ids sorted, joined with "_")
 *   consultation:<consultationId> one consultation / call context (Mongo _id)
 */

export type RoomKind = "user" | "conversation" | "consultation";

export const Rooms = {
  user: (userId: string) => `user:${userId}`,
  consultation: (consultationId: string) => `consultation:${consultationId}`,
  conversationId: (a: string, b: string) => [a, b].sort().join("_"),
  conversation: (a: string, b: string) => `conversation:${[a, b].sort().join("_")}`,
};

export function parseRoom(roomId: string): { kind: RoomKind; id: string } | null {
  if (typeof roomId !== "string") return null;
  const idx = roomId.indexOf(":");
  if (idx <= 0) return null;
  const kind = roomId.slice(0, idx);
  const id = roomId.slice(idx + 1).trim();
  if (!id || id.length > 200) return null;
  if (kind === "user" || kind === "conversation" || kind === "consultation") {
    return { kind, id };
  }
  return null;
}

/**
 * Clerk ids contain underscores, so a conversation id cannot be split on "_".
 * Instead, the other participant is whatever remains once `userId` is removed
 * from the start or end of the sorted join.
 */
export function otherParticipantOfConversation(conversationId: string, userId: string): string | null {
  let other: string | null = null;
  if (conversationId.startsWith(`${userId}_`)) other = conversationId.slice(userId.length + 1);
  else if (conversationId.endsWith(`_${userId}`)) other = conversationId.slice(0, -(userId.length + 1));
  if (!other) return null;
  return Rooms.conversationId(userId, other) === conversationId ? other : null;
}
