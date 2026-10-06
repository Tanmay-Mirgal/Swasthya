/**
 * lib/webrtc/useWebRTC.ts
 *
 * The media half of a call as React state: the local camera/mic stream, the remote stream,
 * the <video> elements, mute / camera toggles. It holds NO peer connection and no signaling:
 * those belong to CallController. `release()` stops every local track and clears both
 * streams, and is safe to call repeatedly.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { acquireMedia } from "./media";
import type { MediaPrepareResult } from "./callController";

export interface UseWebRTCResult {
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  hasLocalStream: boolean;
  hasRemoteStream: boolean;
  /** True when we joined without a camera (blocked or missing). */
  isAudioOnly: boolean;
  mediaError: string | null;
  isMuted: boolean;
  isVideoDisabled: boolean;
  /** Camera/mic for the controller. Reuses a live stream rather than opening a second one. */
  prepareMedia: () => Promise<MediaPrepareResult>;
  setRemoteStream: (stream: MediaStream | null) => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  /** Stop all local tracks and clear both streams. Idempotent. */
  release: () => void;
}

export function useWebRTC(): UseWebRTCResult {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localRef = useRef<MediaStream | null>(null);
  const audioOnlyRef = useRef(false);
  const inflight = useRef<Promise<MediaPrepareResult> | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemote] = useState<MediaStream | null>(null);
  const [isAudioOnly, setIsAudioOnly] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);

  // Keep <video> elements in sync with streams across re-renders/remounts.
  useEffect(() => {
    const local = localVideoRef.current;
    if (local && local.srcObject !== localStream) {
      local.srcObject = localStream;
      if (localStream) void local.play().catch(() => undefined);
    }
    const remote = remoteVideoRef.current;
    if (remote && remote.srcObject !== remoteStream) {
      remote.srcObject = remoteStream;
      if (remoteStream) void remote.play().catch(() => undefined);
    }
  });

  const prepareMedia = useCallback((): Promise<MediaPrepareResult> => {
    const existing = localRef.current;
    if (existing && existing.getTracks().some((t) => t.readyState === "live")) {
      return Promise.resolve({ ok: true, stream: existing, notice: audioOnlyRef.current ? "Your camera is blocked, so you're joining with audio only." : undefined });
    }
    if (inflight.current) return inflight.current; // a preview and a call must not open the devices twice
    const p = (async (): Promise<MediaPrepareResult> => {
      const r = await acquireMedia();
      if (!r.ok) {
        setMediaError(r.message);
        return { ok: false, message: r.message };
      }
      localRef.current = r.stream;
      audioOnlyRef.current = r.stream.getVideoTracks().length === 0;
      setLocalStream(r.stream);
      setIsAudioOnly(audioOnlyRef.current);
      setIsMuted(false);
      setIsVideoDisabled(audioOnlyRef.current);
      setMediaError(null);
      return { ok: true, stream: r.stream, notice: r.notice };
    })().finally(() => {
      inflight.current = null;
    });
    inflight.current = p;
    return p;
  }, []);

  const toggleMute = useCallback(() => {
    const track = localRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsMuted(!track.enabled);
  }, []);

  const toggleVideo = useCallback(() => {
    const track = localRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsVideoDisabled(!track.enabled);
  }, []);

  const release = useCallback(() => {
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    audioOnlyRef.current = false;
    setLocalStream(null);
    setRemote(null);
    setIsAudioOnly(false);
    setIsMuted(false);
    setIsVideoDisabled(false);
  }, []);

  // Never leave the camera or microphone running after the page unmounts.
  useEffect(() => release, [release]);

  return {
    localVideoRef,
    remoteVideoRef,
    hasLocalStream: Boolean(localStream),
    hasRemoteStream: Boolean(remoteStream),
    isAudioOnly,
    mediaError,
    isMuted,
    isVideoDisabled,
    prepareMedia,
    setRemoteStream: setRemote,
    toggleMute,
    toggleVideo,
    release,
  };
}
