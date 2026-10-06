/**
 * lib/storage/recordingStorage.ts
 *
 * The only module that talks to object storage for recordings. Videos are stored in a
 * PRIVATE Vercel Blob store: uploaded by the browser directly (with a short-lived,
 * server-issued, narrowly scoped token) and read back only by the server, which streams
 * them to an authorised caller. Needs BLOB_READ_WRITE_TOKEN; without it recording is
 * reported as unavailable rather than failing at upload time.
 */
import "server-only";
import { del, get, head } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

export const ALLOWED_RECORDING_TYPES = ["video/webm", "video/mp4"] as const;
/** A short exercise clip. Generous for a 60 s phone recording; blocks anything bulk. */
export const MAX_RECORDING_BYTES = 80 * 1024 * 1024;

export interface StoredObject {
  size: number;
  contentType: string;
}

export interface OpenedObject {
  stream: ReadableStream<Uint8Array>;
  headers: Headers;
  status: number;
  contentType: string;
  size: number;
}

export interface RecordingStorage {
  available(): boolean;
  /** Issues a client-upload token after the caller has been authorised. */
  issueUploadToken(args: { body: HandleUploadBody; request: Request; pathnamePrefix: string; tokenPayload: string }): Promise<unknown>;
  head(pathname: string): Promise<StoredObject | null>;
  open(pathname: string, range?: string | null): Promise<OpenedObject | null>;
  remove(pathname: string): Promise<void>;
}

const blobStorage: RecordingStorage = {
  available: () => Boolean(process.env.BLOB_READ_WRITE_TOKEN),

  async issueUploadToken({ body, request, pathnamePrefix, tokenPayload }) {
    return handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(pathnamePrefix) || pathname.includes("..")) {
          throw new Error("Upload path is not allowed.");
        }
        return {
          allowedContentTypes: [...ALLOWED_RECORDING_TYPES],
          maximumSizeInBytes: MAX_RECORDING_BYTES,
          addRandomSuffix: true,
          tokenPayload,
          validUntil: Date.now() + 15 * 60 * 1000,
        };
      },
    });
  },

  async head(pathname) {
    try {
      const h = await head(pathname);
      return { size: h.size, contentType: h.contentType };
    } catch {
      return null;
    }
  },

  async open(pathname, range) {
    const res = await get(pathname, {
      access: "private",
      useCache: false,
      ...(range ? { headers: { range } } : {}),
    });
    if (!res || res.statusCode !== 200) return null;
    return { stream: res.stream, headers: res.headers as unknown as Headers, status: range && res.headers.get("content-range") ? 206 : 200, contentType: res.blob.contentType, size: res.blob.size };
  },

  async remove(pathname) {
    await del(pathname);
  },
};

let current: RecordingStorage = blobStorage;

export const recordingStorage = (): RecordingStorage => current;

/** Test seam: the real Vercel Blob implementation, to test its token rules offline. */
export function __realStorageForTests(): RecordingStorage {
  return blobStorage;
}

/** Test seam: swap the storage backend (never used in application code). */
export function __setRecordingStorageForTests(s: RecordingStorage | null): void {
  current = s ?? blobStorage;
}
