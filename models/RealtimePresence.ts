import mongoose, { Schema, Document } from "mongoose";

/**
 * One document per (websocket connection, room). Refreshed by client heartbeats and
 * removed by TTL if an instance dies without cleaning up, so presence never depends
 * on the memory of a single process.
 */
export interface IRealtimePresence extends Document {
  key: string;
  roomId: string;
  connectionId: string;
  userId: string;
  role: string;
  name?: string;
  expireAt: Date;
}

const RealtimePresenceSchema = new Schema({
  key: { type: String, required: true, unique: true },
  roomId: { type: String, required: true, index: true },
  connectionId: { type: String, required: true, index: true },
  userId: { type: String, required: true },
  role: { type: String, required: true },
  name: { type: String },
  expireAt: { type: Date, required: true, index: { expires: 0 } },
});

const RealtimePresence =
  mongoose.models.RealtimePresence ||
  mongoose.model<IRealtimePresence>("RealtimePresence", RealtimePresenceSchema);

export default RealtimePresence;
