/**
 * lib/rehab/rateLimit.ts
 *
 * A small fixed-window limiter backed by MongoDB, so it is shared by every serverless
 * instance. Used to stop one account from spending the language-model budget.
 */
import LlmUsage from "@/models/LlmUsage";

export interface LimitWindow {
  name: string;
  seconds: number;
  max: number;
}

/** Counts one use in every window; returns false (and does not count further) if any window is full. */
export async function consume(userId: string, scope: string, windows: LimitWindow[], now = Date.now()): Promise<boolean> {
  for (const w of windows) {
    const bucket = Math.floor(now / (w.seconds * 1000));
    const doc = await LlmUsage.findOneAndUpdate(
      { key: `${scope}:${userId}:${w.name}:${bucket}` },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 2) * w.seconds * 1000) } },
      { upsert: true, returnDocument: "after" }
    ).lean<{ count: number }>();
    if (!doc || doc.count > w.max) return false;
  }
  return true;
}
