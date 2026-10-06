"use client";

import React from "react";
import { AlertCircle, Loader2, MicOff, ShieldAlert } from "lucide-react";

interface VideoCallAreaProps {
  callActive: boolean;
  callConnecting: boolean;
  hasRemoteStream?: boolean;
  isCompleted: boolean;
  peerName?: string;
  onlineUsers: number;
  callDuration: number;
  formatTime: (secs: number) => string;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  isMuted: boolean;
  isVideoDisabled: boolean;
  isFallbackMedia?: boolean;
  /** Replaces "Connecting securely..." while a call is ringing/negotiating (e.g. "Calling Dr. Sharma…"). */
  statusText?: string;
  /** Transient message: call ended/declined, connection problems, permission errors. */
  notice?: string | null;
  /** Realtime connection hint, shown when not fully connected. */
  connectionLabel?: string | null;
  onStartCall: () => void;
}

/** The call window: solid ink ground, hairline-bordered self view, plain status messages. */
export default function VideoCallArea({
  callActive,
  callConnecting,
  hasRemoteStream = false,
  isCompleted,
  peerName,
  onlineUsers,
  callDuration,
  formatTime,
  localVideoRef,
  remoteVideoRef,
  isMuted,
  isVideoDisabled,
  isFallbackMedia = false,
  statusText,
  notice,
  connectionLabel,
  onStartCall,
}: VideoCallAreaProps) {
  const initial = peerName ? peerName.charAt(0).toUpperCase() : "?";
  return (
    <div className="absolute inset-0 z-0 flex items-center justify-center overflow-hidden bg-slate-950">
      {isFallbackMedia && (
        <div role="alert" className="absolute left-1/2 top-16 z-30 flex max-w-[92%] -translate-x-1/2 items-start gap-2 rounded-md border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-[var(--ink)]">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>Your camera and microphone are blocked. Allow them from the icon in your browser’s address bar, then rejoin.</span>
        </div>
      )}

      {(notice || connectionLabel) && (
        <div role="status" aria-live="polite" className="absolute left-1/2 top-28 z-30 flex max-w-[92%] -translate-x-1/2 flex-col items-center gap-2">
          {connectionLabel && (
            <p className="flex items-center gap-2 rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-100">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> {connectionLabel}
            </p>
          )}
          {notice && (
            <p className="flex items-start gap-2 rounded-md border border-slate-600 bg-slate-900 px-3.5 py-2 text-center text-sm text-slate-100">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {notice}
            </p>
          )}
        </div>
      )}

      {!callActive && !callConnecting && (
        <div className="relative z-10 flex max-w-sm flex-col items-center px-6 text-center">
          <div className="relative mb-5">
            <div className="flex size-24 items-center justify-center rounded-full border border-slate-600 bg-slate-900">
              <span className="text-3xl font-semibold text-slate-200">{initial}</span>
            </div>
            <span
              className={`absolute bottom-1 right-1 size-4 rounded-full border-2 border-slate-950 ${onlineUsers > 1 ? "bg-emerald-400" : "bg-slate-500"}`}
              aria-hidden="true"
            />
          </div>
          <h2 className="mb-1 text-2xl font-semibold text-white">{peerName || "Participant"}</h2>
          <p className="mb-7 text-base leading-relaxed text-slate-300">{onlineUsers > 1 ? "is in the room and ready." : "Waiting for them to join…"}</p>
          {!isCompleted ? (
            <button onClick={onStartCall} className="h-12 rounded-lg bg-emerald-500 px-7 text-base font-semibold text-[var(--ink)] hover:bg-emerald-400">
              {onlineUsers > 1 ? "Start the call" : "Call anyway"}
            </button>
          ) : (
            <p className="rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-300">This consultation is completed.</p>
          )}
        </div>
      )}

      {callConnecting && !callActive && (
        <div className="flex flex-col items-center text-slate-200" role="status" aria-live="polite">
          <Loader2 className="mb-4 size-6 animate-spin" aria-hidden="true" />
          <p className="text-base font-medium">{statusText || "Connecting securely..."}</p>
        </div>
      )}

      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        aria-label={peerName ? `${peerName}'s video` : "Remote video"}
        className={`absolute inset-0 size-full object-cover transition-opacity duration-500 ${callActive && hasRemoteStream ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />

      {callActive && !hasRemoteStream && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950" role="status">
          <div className="mb-4 flex size-20 items-center justify-center rounded-full border border-slate-600 bg-slate-900">
            <span className="text-2xl text-slate-300">{initial}</span>
          </div>
          <p className="text-base text-slate-300">Waiting for {peerName}’s camera…</p>
        </div>
      )}

      {callActive && (
        <p className="absolute left-4 top-20 z-20 rounded-md bg-slate-900 px-2.5 py-1 font-mono text-sm tabular text-slate-100">{formatTime(callDuration)}</p>
      )}

      <div
        className={`absolute right-4 top-20 z-20 h-44 w-32 overflow-hidden rounded-lg border border-slate-600 bg-slate-900 md:h-40 md:w-56 ${callActive || callConnecting ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        <video ref={localVideoRef} autoPlay playsInline muted aria-label="Your camera" className={`size-full scale-x-[-1] object-cover ${isVideoDisabled ? "hidden" : "block"}`} />
        {isVideoDisabled && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
            <span className="text-sm font-medium text-slate-300">Camera off</span>
          </div>
        )}
        <div className="absolute bottom-2 left-2 flex gap-1.5">
          <span className="rounded bg-slate-900 px-2 py-0.5 text-xs font-medium text-white">You</span>
          {isMuted && (
            <span className="flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-xs font-medium text-white">
              <MicOff className="size-3" aria-hidden="true" /> Muted
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
