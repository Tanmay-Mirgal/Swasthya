/**
 * lib/rehab/chunkOutbox.ts
 *
 * A small browser-side outbox for rep chunks, so a dropped connection or a closed tab
 * never loses reps the patient really did. A chunk is written here BEFORE it is sent and
 * removed once the server accepts it. Each chunk carries its own id, and the server
 * ignores an id it has already counted, so re-sending after a failure cannot double-count.
 * The server stays the source of truth; this only retries.
 */

export interface OutboxChunk {
  chunkId: string;
  prescriptionId: string;
  exerciseKey: string;
  setIndex: number;
  reps: number;
  startedAt?: string;
  endedAt?: string;
  rom?: number;
  formScore?: number;
  issues?: Record<string, number>;
  /** Local calendar day it was done; a chunk from a past day is dropped rather than credited to today. */
  day: string;
}

const KEY = "swasthya.chunkOutbox.v1";

function read(): OutboxChunk[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
function write(list: OutboxChunk[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-50)));
  } catch {
    /* storage can be unavailable (private mode); the request is still attempted */
  }
}

export const outbox = {
  add(chunk: OutboxChunk) {
    write([...read().filter((c) => c.chunkId !== chunk.chunkId), chunk]);
  },
  remove(chunkId: string) {
    write(read().filter((c) => c.chunkId !== chunkId));
  },
  all: read,
};

export type SendResult = "sent" | "retry" | "drop";

/** Sends every pending chunk. A rejected chunk (409/404: no longer valid) is dropped, a network failure stays queued. */
export async function flushOutbox(send: (c: OutboxChunk) => Promise<SendResult>): Promise<number> {
  let sent = 0;
  for (const chunk of outbox.all()) {
    const r = await send(chunk);
    if (r === "retry") break;
    outbox.remove(chunk.chunkId);
    if (r === "sent") sent++;
  }
  return sent;
}
