import mongoose, { Schema, Document } from "mongoose";

/**
 * A rate-limit counter for language-model calls, per user and time bucket. Counters are
 * kept in the database (not in process memory) so the limit holds across Vercel instances.
 * Documents expire on their own via the TTL index.
 */
export interface ILlmUsage extends Document {
  key: string;
  count: number;
  expiresAt: Date;
}

const LlmUsageSchema = new Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});
LlmUsageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const LlmUsage = mongoose.models.LlmUsage || mongoose.model<ILlmUsage>("LlmUsage", LlmUsageSchema);
export default LlmUsage;
