/**
 * lib/realtime/server/chatService.ts
 *
 * Chat = MongoDB persistence (source of truth) + realtime delivery over the bus.
 * Used by the REST routes (single write path):
 *
 *   authenticate → authorize → persist (idempotent on clientId) → publish CHAT_MESSAGE
 */

import connectToDatabase from "@/lib/mongodb";
import ChatMessage from "@/models/ChatMessage";
import { publish } from "./bus";
import { RealtimeEvent } from "../protocol/events";
import { Rooms } from "../protocol/rooms";
import type { ChatMessageDTO, MessageReadPayload } from "../protocol/packets";
import { usersHaveRelationship, type VerifiedIdentity } from "../auth/verifier";

export const MAX_MESSAGE_LENGTH = 4000;
export const MAX_HISTORY = 500;

export class ChatServiceError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface ChatDoc {
  _id: { toString(): string };
  consultationId?: string;
  conversationId?: string;
  senderId: string;
  senderRole: "patient" | "doctor" | "system";
  receiverId?: string;
  content: string;
  type: ChatMessageDTO["type"];
  prescriptionData?: Record<string, unknown>;
  read: boolean;
  clientId?: string;
  createdAt: Date | string;
}

export function toChatDTO(doc: ChatDoc): ChatMessageDTO {
  return {
    _id: doc._id.toString(),
    consultationId: doc.consultationId,
    conversationId: doc.conversationId,
    senderId: doc.senderId,
    senderRole: doc.senderRole,
    receiverId: doc.receiverId,
    content: doc.content,
    type: doc.type,
    prescriptionData: doc.prescriptionData,
    read: Boolean(doc.read),
    clientId: doc.clientId,
    createdAt: new Date(doc.createdAt).toISOString(),
  };
}

export function cleanContent(content: unknown): string {
  if (typeof content !== "string") throw new ChatServiceError(400, "Message content required");
  const trimmed = content.trim();
  if (!trimmed) throw new ChatServiceError(400, "Message content required");
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new ChatServiceError(400, `Messages are limited to ${MAX_MESSAGE_LENGTH} characters`);
  }
  return trimmed;
}

export function cleanClientId(clientId: unknown): string | undefined {
  return typeof clientId === "string" && clientId.length > 0 && clientId.length <= 100 ? clientId : undefined;
}

interface CreateArgs {
  identity: VerifiedIdentity;
  content: string;
  clientId?: string;
  scope: { consultationId: string } | { conversationId: string };
  receiverId: string;
  room: string;
}

async function persistAndPublish(args: CreateArgs): Promise<ChatMessageDTO> {
  await connectToDatabase();
  const { identity, content, clientId, scope, receiverId, room } = args;

  let doc: ChatDoc | null = null;
  let created = true;
  try {
    doc = (await ChatMessage.create({
      ...scope,
      senderId: identity.userId,
      senderRole: identity.role === "doctor" ? "doctor" : "patient",
      receiverId,
      content,
      type: "text",
      read: false,
      clientId,
    })) as unknown as ChatDoc;
  } catch (err) {
    // Duplicate (senderId, clientId): the client retried — return the original, don't re-broadcast.
    if ((err as { code?: number })?.code === 11000 && clientId) {
      created = false;
      doc = (await ChatMessage.findOne({ senderId: identity.userId, clientId }).lean()) as unknown as ChatDoc | null;
    } else {
      throw err;
    }
  }
  if (!doc) throw new ChatServiceError(500, "Unable to save message");

  const dto = toChatDTO(doc);
  if (created) {
    await publish({
      roomId: room,
      event: RealtimeEvent.CHAT_MESSAGE,
      payload: dto,
      from: { userId: identity.userId, role: identity.role, name: identity.name },
    });
    // Also ring the recipient's private channel so navigation badges update on any page.
    if (receiverId) {
      await publish({
        roomId: Rooms.user(receiverId),
        event: RealtimeEvent.CHAT_MESSAGE,
        payload: dto,
        from: { userId: identity.userId, role: identity.role, name: identity.name },
      });
    }
  }
  return dto;
}

export async function sendConversationMessage(
  identity: VerifiedIdentity,
  otherUserId: string,
  rawContent: unknown,
  rawClientId?: unknown
): Promise<ChatMessageDTO> {
  const content = cleanContent(rawContent);
  if (!otherUserId || otherUserId === identity.userId) throw new ChatServiceError(400, "Invalid recipient");
  if (!(await usersHaveRelationship(identity.userId, otherUserId))) {
    throw new ChatServiceError(403, "You can message a physiotherapist after you have requested an appointment with them.");
  }
  return persistAndPublish({
    identity,
    content,
    clientId: cleanClientId(rawClientId),
    scope: { conversationId: Rooms.conversationId(identity.userId, otherUserId) },
    receiverId: otherUserId,
    room: Rooms.conversation(identity.userId, otherUserId),
  });
}

export async function sendConsultationMessage(
  identity: VerifiedIdentity,
  consultation: { _id: { toString(): string }; patientId: string; doctorId: string; status?: string },
  rawContent: unknown,
  rawClientId?: unknown
): Promise<ChatMessageDTO> {
  const content = cleanContent(rawContent);
  const isPatient = consultation.patientId === identity.userId;
  const isDoctor = consultation.doctorId === identity.userId;
  if (!isPatient && !isDoctor) throw new ChatServiceError(403, "Not a participant in this consultation");
  if (consultation.status === "CANCELLED") throw new ChatServiceError(409, "This consultation was cancelled");
  const id = consultation._id.toString();
  return persistAndPublish({
    identity,
    content,
    clientId: cleanClientId(rawClientId),
    scope: { consultationId: id },
    receiverId: isPatient ? consultation.doctorId : consultation.patientId,
    room: Rooms.consultation(id),
  });
}

/** Messages in a scope, oldest first. `since` (ISO date) returns only newer messages for reconnect resync. */
export async function listMessages(
  scope: { consultationId: string } | { conversationId: string },
  since?: string | null
): Promise<ChatMessageDTO[]> {
  await connectToDatabase();
  const query: Record<string, unknown> = { ...scope };
  if (since) {
    const d = new Date(since);
    if (!Number.isNaN(d.getTime())) query.createdAt = { $gt: d };
  }
  const docs = (await ChatMessage.find(query)
    .sort({ createdAt: -1 })
    .limit(MAX_HISTORY)
    .lean()) as unknown as ChatDoc[];
  return docs.reverse().map(toChatDTO);
}

/** Mark the caller's unread incoming messages in a scope as read and notify the room. */
export async function markScopeRead(
  identity: VerifiedIdentity,
  scope: { consultationId: string } | { conversationId: string },
  room: string
): Promise<string[]> {
  await connectToDatabase();
  const unread = await ChatMessage.find({ ...scope, receiverId: identity.userId, read: false }).select("_id").lean();
  if (unread.length === 0) return [];
  const ids = unread.map((m: { _id: { toString(): string } }) => m._id.toString());
  await ChatMessage.updateMany({ _id: { $in: ids } }, { $set: { read: true } });
  const payload: MessageReadPayload = {
    messageIds: ids,
    readerId: identity.userId,
    ...("consultationId" in scope ? { consultationId: scope.consultationId } : { conversationId: scope.conversationId }),
  };
  await publish({
    roomId: room,
    event: RealtimeEvent.MESSAGE_READ,
    payload,
    from: { userId: identity.userId, role: identity.role, name: identity.name },
  });
  return ids;
}
