"use client";

/**
 * lib/rehab/useReviewRecording.ts
 *
 * Records ONE short clip of the review exercise, only after the patient says yes, and
 * uploads it straight to private storage. Nothing is recorded in the background: the
 * recorder starts when a set starts and stops by itself after MAX_SECONDS or when the
 * patient finishes. The clip is the raw camera picture (no skeleton overlay).
 */

import { useCallback, useEffect, useRef, useState } from "react";

export const MAX_RECORDING_SECONDS = 90;

export type RecordingState = "idle" | "recording" | "ready" | "uploading" | "sent" | "failed";

const MIME_CANDIDATES = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
}

export function recordingSupported(): boolean {
  return typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && Boolean(pickMime());
}

interface Options {
  reviewId: string | null;
  userId: string | null | undefined;
  getToken: () => Promise<string | null>;
}

export function useReviewRecording({ reviewId, userId, getToken }: Options) {
  const [state, setState] = useState<RecordingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const partsRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const startedRef = useRef(0);
  const secondsRef = useRef(0);
  const capRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedRef = useRef<Promise<void> | null>(null);

  const attachStream = useCallback((s: MediaStream | null) => {
    streamRef.current = s;
  }, []);

  const stop = useCallback((): Promise<void> => {
    if (capRef.current) clearTimeout(capRef.current);
    const rec = recorderRef.current;
    if (!rec || rec.state === "inactive") return stoppedRef.current ?? Promise.resolve();
    stoppedRef.current = new Promise<void>((resolve) => {
      rec.onstop = () => {
        secondsRef.current = Math.round((Date.now() - startedRef.current) / 1000);
        const blob = new Blob(partsRef.current, { type: (rec.mimeType || "video/webm").split(";")[0] });
        partsRef.current = [];
        // Under 3 seconds is not worth sending.
        blobRef.current = secondsRef.current >= 3 && blob.size > 0 ? blob : null;
        setState(blobRef.current ? "ready" : "idle");
        resolve();
      };
      rec.stop();
    });
    return stoppedRef.current;
  }, []);

  /** Starts recording the camera. Safe to call once per exercise; later calls are ignored. */
  const start = useCallback((): boolean => {
    const stream = streamRef.current;
    const mime = pickMime();
    if (!stream || !mime || recorderRef.current) return false;
    try {
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1_200_000 });
      partsRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) partsRef.current.push(e.data);
      };
      rec.start(1000);
      recorderRef.current = rec;
      startedRef.current = Date.now();
      setState("recording");
      capRef.current = setTimeout(() => void stop(), MAX_RECORDING_SECONDS * 1000);
      return true;
    } catch {
      setError("This device couldn’t start a recording. Your sets are still saved.");
      setState("failed");
      return false;
    }
  }, [stop]);

  const upload = useCallback(async (): Promise<boolean> => {
    const blob = blobRef.current;
    if (!blob || !reviewId || !userId) return false;
    setState("uploading");
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Please sign in again.");
      const { upload: blobUpload } = await import("@vercel/blob/client");
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      const stored = await blobUpload(`recordings/${userId}/${reviewId}/clip.${ext}`, blob, {
        access: "private",
        handleUploadUrl: "/api/recordings/upload",
        clientPayload: JSON.stringify({ reviewId }),
        headers: { Authorization: `Bearer ${token}` },
        contentType: blob.type,
        multipart: blob.size > 8 * 1024 * 1024,
      });
      const res = await fetch("/api/recordings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${(await getToken()) ?? token}` },
        body: JSON.stringify({ reviewId, pathname: stored.pathname, durationSeconds: secondsRef.current }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "confirm");
      blobRef.current = null;
      setState("sent");
      return true;
    } catch (e) {
      setError(e instanceof Error && e.message !== "confirm" ? e.message : "The recording couldn’t be sent. Check your connection and try again.");
      setState("failed");
      return false;
    }
  }, [getToken, reviewId, userId]);

  const discard = useCallback(() => {
    blobRef.current = null;
    partsRef.current = [];
    setState("idle");
  }, []);

  const hasClip = useCallback(() => Boolean(blobRef.current), []);

  useEffect(
    () => () => {
      if (capRef.current) clearTimeout(capRef.current);
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") {
        rec.onstop = null;
        rec.stop();
      }
    },
    []
  );

  return { state, error, attachStream, start, stop, upload, discard, hasClip };
}
