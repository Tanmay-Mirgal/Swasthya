/**
 * lib/rehab/chunking.ts
 *
 * Rep chunking. The therapist prescribes `reps` per set and the patient cannot lower
 * that target; what the patient controls is how they split a set into chunks
 * (8 reps, rest, 7 reps = one complete set of 15). A chunk is submitted once, with
 * a client-generated `chunkId`, so a retried request never counts the same reps twice,
 * and a set can never be credited with more than its prescribed reps.
 */

import { clampQuality, type ChunkQuality } from "./chunkQuality";

export interface ChunkRecord extends ChunkQuality {
  chunkId: string;
  reps: number;
  startedAt?: Date;
  endedAt?: Date;
  /** Largest range of motion measured in this chunk, degrees. */
  rom?: number;
  /** Share of reps in this chunk that met the exercise's form rules, 0-100. */
  formScore?: number;
  /** Count of each movement-feedback code the engine raised during this chunk. */
  issues?: Record<string, number>;
}

export interface SetRecord {
  index: number;
  completedReps: number;
  chunks: ChunkRecord[];
  completedAt?: Date;
}

export type ChunkResult =
  | { ok: true; sets: SetRecord[]; credited: number; setComplete: boolean; duplicate: false }
  | { ok: true; sets: SetRecord[]; credited: 0; setComplete: boolean; duplicate: true }
  | { ok: false; error: string };

export interface ApplyChunkInput {
  sets: SetRecord[];
  targetSets: number;
  targetReps: number;
  setIndex: number;
  chunk: ChunkRecord;
}

/** Applies one chunk to a day's set records without mutating the input. */
export function applyChunk({ sets, targetSets, targetReps, setIndex, chunk }: ApplyChunkInput): ChunkResult {
  if (!Number.isInteger(setIndex) || setIndex < 0 || setIndex >= targetSets) {
    return { ok: false, error: "That set is not part of this prescription." };
  }
  if (!chunk.chunkId || typeof chunk.chunkId !== "string" || chunk.chunkId.length > 80) {
    return { ok: false, error: "Missing chunk id." };
  }
  if (!Number.isInteger(chunk.reps) || chunk.reps < 0 || chunk.reps > targetReps) {
    return { ok: false, error: "Rep count is out of range." };
  }

  // Idempotency: the same chunk id anywhere in today's record is a retry.
  for (const s of sets) {
    if (s.chunks.some((c) => c.chunkId === chunk.chunkId)) {
      const own = sets.find((x) => x.index === setIndex);
      return { ok: true, sets, credited: 0, duplicate: true, setComplete: (own?.completedReps ?? 0) >= targetReps };
    }
  }

  // Sets are done in order: set N+1 cannot start until set N is complete.
  for (let i = 0; i < setIndex; i++) {
    const prev = sets.find((s) => s.index === i);
    if ((prev?.completedReps ?? 0) < targetReps) {
      return { ok: false, error: `Finish set ${i + 1} before set ${setIndex + 1}.` };
    }
  }

  const next = sets.map((s) => ({ ...s, chunks: [...s.chunks] }));
  let target = next.find((s) => s.index === setIndex);
  if (!target) {
    target = { index: setIndex, completedReps: 0, chunks: [] };
    next.push(target);
  }
  if (target.completedReps >= targetReps) {
    return { ok: false, error: `Set ${setIndex + 1} is already complete.` };
  }

  const credited = Math.min(chunk.reps, targetReps - target.completedReps);
  if (credited <= 0) return { ok: false, error: "No reps to record." };

  target.completedReps += credited;
  target.chunks.push(clampQuality({ ...chunk, reps: credited }, credited));
  const setComplete = target.completedReps >= targetReps;
  if (setComplete) target.completedAt = chunk.endedAt ?? new Date();
  next.sort((a, b) => a.index - b.index);

  return { ok: true, sets: next, credited, setComplete, duplicate: false };
}

export function totalRepsOf(sets: SetRecord[], targetReps: number): number {
  return sets.reduce((sum, s) => sum + Math.min(targetReps, s.completedReps), 0);
}
