/**
 * lib/webrtc/useWebRTC.ts
 *
 * Local/remote media + the active PeerSession for a call. Pure media concerns:
 * acquiring camera/mic (with the existing graceful fallbacks), mute/camera toggles,
 * attaching streams to <video> elements and releasing everything on cleanup.
 * Signaling lives in useConsultation.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getMediaStreamWithFallback } from "./media";
import { LocalStream, PeerSession, PeerSessionHandlers } from "./peerSession";

export interface UseWebRTCResult {
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  hasLocalStream: boolean;
  hasRemoteStream: boolean;
  /** True when real camera/mic access was refused or unavailable and a placeholder stream is used. */
  isFallbackMedia: boolean;
  mediaError: string | null;
  isMuted: boolean;
  isVideoDisabled: boolean;
  prepareMedia: () => Promise<boolean>;
  startSession: (handlers: PeerSessionHandlers) => PeerSession;
  getSession: () => PeerSession | null;
  toggleMute: () => void;
  toggleVideo: () => void;
  /** Close the peer connection, stop all tracks, reset state. Idempotent. */
  releaseCall: () => void;
}

export function useWebRTC(): UseWebRTCResult {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localRef = useRef<LocalStream | null>(null);
  const sessionRef = useRef<PeerSession | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isFallbackMedia, setIsFallbackMedia] = useState(false);
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

  const prepareMedia = useCallback(async (): Promise<boolean> => {
    const existing = localRef.current;
    if (existing && !existing.isFallback && existing.getTracks().some((t) => t.readyState === "live")) return true;

    const stream = (await getMediaStreamWithFallback()) as LocalStream | null;
    if (!stream) {
      setMediaError("Camera and microphone are not available in this browser.");
      return false;
    }
    existing?.getTracks().forEach((t) => t.stop());
    localRef.current = stream;
    setLocalStream(stream);
    setIsFallbackMedia(Boolean(stream.isFallback));
    setIsMuted(false);
    setIsVideoDisabled(false);
    setMediaError(null);
    return true;
  }, []);

  const startSession = useCallback((handlers: PeerSessionHandlers): PeerSession => {
    sessionRef.current?.close();
    const session = new PeerSession(
      {
        ...handlers,
        onRemoteStream: (stream) => {
          setRemoteStream(stream);
          handlers.onRemoteStream(stream);
        },
      },
      localRef.current
    );
    sessionRef.current = session;
    return session;
  }, []);

  const getSession = useCallback(() => sessionRef.current, []);

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

  const releaseCall = useCallback(() => {
    sessionRef.current?.close();
    sessionRef.current = null;
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setIsFallbackMedia(false);
    setIsMuted(false);
    setIsVideoDisabled(false);
  }, []);

  // Never leave camera/mic running after the page unmounts.
  useEffect(() => releaseCall, [releaseCall]);

  return {
    localVideoRef,
    remoteVideoRef,
    hasLocalStream: Boolean(localStream),
    hasRemoteStream: Boolean(remoteStream),
    isFallbackMedia,
    mediaError,
    isMuted,
    isVideoDisabled,
    prepareMedia,
    startSession,
    getSession,
    toggleMute,
    toggleVideo,
    releaseCall,
  };
}
