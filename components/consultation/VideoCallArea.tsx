"use client";

import React from "react";
import { Video, Loader2, MicOff, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/Button";

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
  onStartCall: () => void;
}

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
  onStartCall,
}: VideoCallAreaProps) {
  return (
    <div className="flex-1 relative bg-slate-900 w-full h-full flex items-center justify-center overflow-hidden">
      {/* Lobby / Idle State */}
      {!callActive && !callConnecting && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-slate-400 px-6 text-center">
          <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center mb-6 shadow-xl relative">
            <Video className="w-10 h-10 text-slate-500" />
            {onlineUsers > 1 && (
              <div className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-500 border-2 border-slate-800 rounded-full" />
            )}
          </div>
          <h2 className="text-2xl font-semibold text-slate-200 mb-2">
            Ready to join?
          </h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-8 leading-relaxed">
            {onlineUsers > 1
              ? `${peerName} is in the room. Start the call when you're ready.`
              : `Waiting for ${peerName} to join the consultation room.`}
          </p>
          {!isCompleted && (
            <Button
              onClick={onStartCall}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-6 rounded-full text-lg font-semibold shadow-emerald-900/50 shadow-xl transition-transform hover:scale-105"
            >
              Start Video Call
            </Button>
          )}
          {isCompleted && (
            <div className="bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-lg border border-emerald-500/20 text-sm font-medium mt-4">
              This consultation has been completed.
            </div>
          )}
        </div>
      )}

      {/* Connecting State */}
      {callConnecting && !callActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-10 text-slate-300">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-4" />
          <p className="text-lg font-medium animate-pulse">
            Connecting to secure WebRTC stream...
          </p>
        </div>
      )}

      {/* Remote Video (Main) */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className={`w-full h-full object-cover transition-opacity duration-500 ${
          callActive && hasRemoteStream ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* When call is active but waiting for peer's remote video */}
      {callActive && !hasRemoteStream && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 px-6 text-center z-10 pointer-events-none">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4 animate-pulse">
            <Video className="w-8 h-8 text-emerald-400" />
          </div>
          <h3 className="text-xl font-semibold text-slate-200 mb-1">
            Calling {peerName}...
          </h3>
          <p className="text-xs text-slate-400 max-w-sm">
            Waiting for {peerName} to connect video stream. Your camera and microphone are live.
          </p>
        </div>
      )}

      {/* Remote Info Banner */}
      {callActive && (
        <div className="absolute bottom-28 left-6 md:bottom-32 z-20">
          <div className="bg-slate-900/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-3 shadow-lg">
            <span className="text-white font-medium text-sm">{peerName}</span>
            <span className="text-slate-300 font-mono text-sm border-l border-slate-600 pl-3">
              {formatTime(callDuration)}
            </span>
          </div>
        </div>
      )}

      {/* Local Video (PIP) */}
      <div
        className={`absolute top-24 right-4 md:right-6 md:bottom-28 md:top-auto z-20 w-28 h-40 md:w-48 md:h-72 bg-slate-800 rounded-2xl overflow-hidden border-2 border-slate-700/50 shadow-2xl transition-all duration-300 ${
          callActive || callConnecting
            ? "opacity-100 scale-100"
            : "opacity-0 scale-95 pointer-events-none"
        }`}
      >
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover scale-x-[-1]"
        />
        <div className="absolute bottom-2 left-2 bg-slate-900/70 backdrop-blur-sm px-2 py-1 rounded text-[10px] text-white font-medium flex items-center gap-1.5">
          You {isMuted && <MicOff className="w-3 h-3 text-red-400" />}{" "}
          {isVideoDisabled && <VideoOff className="w-3 h-3 text-red-400" />}
        </div>
      </div>
    </div>
  );
}
