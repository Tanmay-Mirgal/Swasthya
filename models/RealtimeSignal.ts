import mongoose, { Schema, Document } from "mongoose";

/**
 * Cross-instance realtime bus.
 *
 * Every realtime fan-out (chat delivery, typing, signaling, presence) is written here.
 * Each running Next.js instance tails this collection (change stream, with a polling
 * fallback) and forwards matching documents to the WebSockets it holds locally.
 * Documents are short-lived (TTL) — MongoDB messages/consultations remain the durable
 * source of truth, never this collection.
 */
export interface IRealtimeSignal extends Document {
  roomId: string;
  event: string;
  payload: unknown;
  from?: { userId: string; role: string; name?: string };
  excludeUserId?: string;
  excludeConnectionId?: string;
  originInstanceId: string;
  createdAt: Date;
}

const RealtimeSignalSchema = new Schema({
  roomId: { type: String, required: true, index: true },
  event: { type: String, required: true },
  payload: { type: Schema.Types.Mixed },
  from: { type: Schema.Types.Mixed },
  excludeUserId: { type: String },
  excludeConnectionId: { type: String },
  originInstanceId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 120 },
});

const RealtimeSignal =
  mongoose.models.RealtimeSignal ||
  mongoose.model<IRealtimeSignal>("RealtimeSignal", RealtimeSignalSchema);

export default RealtimeSignal;
