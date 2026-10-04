"use client";

import React from "react";
import { Loader2 } from "lucide-react";

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
  localVideoRef,
  remoteVideoRef,
  isMuted,
  isVideoDisabled,
  onStartCall,
}: VideoCallAreaProps) {
  return (
    <div className="absolute inset-0 z-0 bg-[#0B0C10] flex items-center justify-center overflow-hidden">
      {!callActive && !callConnecting && (
        <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 max-w-sm">
          <div className="relative mb-6">
            <div className="w-24 h-24 rounded-full bg-slate-800/50 flex items-center justify-center overflow-hidden border border-slate-700/50 shadow-sm">
              <span className="text-3xl font-medium text-slate-400">
                {peerName ? peerName.charAt(0).toUpperCase() : "?"}
              </span>
            </div>
            {onlineUsers > 1 && (
              <div className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 rounded-full border-[3px] border-[#0B0C10]" />
            )}
          </div>
          <h2 className="text-[22px] font-semibold text-white mb-2 tracking-tight">
            {peerName || "Participant"}
          </h2>
          <p className="text-[15px] text-slate-400 mb-8 leading-relaxed">
            {onlineUsers > 1
              ? "is ready for the consultation."
              : "Waiting for participant to join..."}
          </p>
          {!isCompleted && (
            <button
              onClick={onStartCall}
              className="bg-white hover:bg-slate-100 text-black px-6 py-2.5 rounded-lg text-[15px] font-medium transition-colors shadow-sm active:scale-[0.98]"
            >
              Join Call
            </button>
          )}
          {isCompleted && (
            <div className="text-sm text-slate-400 font-medium px-4 py-2 bg-slate-900/50 rounded-lg">
              Consultation completed.
            </div>
          )}
        </div>
      )}

      {callConnecting && !callActive && (
        <div className="flex flex-col items-center justify-center text-slate-300">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400 mb-4" />
          <p className="text-[15px] font-medium text-slate-400">Connecting securely...</p>
        </div>
      )}

      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out ${
          callActive && hasRemoteStream ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {callActive && !hasRemoteStream && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0B0C10]">
          <div className="w-20 h-20 rounded-full bg-slate-800/30 flex items-center justify-center mb-5 animate-pulse border border-slate-700/50">
            <span className="text-2xl text-slate-500">
              {peerName ? peerName.charAt(0).toUpperCase() : "?"}
            </span>
          </div>
          <p className="text-[15px] text-slate-400">
            Waiting for {peerName}&apos;s camera...
          </p>
        </div>
      )}

      <div
        className={`absolute top-6 right-6 z-20 w-32 h-44 md:w-[220px] md:h-[160px] bg-[#1A1C23] rounded-xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.4)] border border-white/10 transition-all duration-500 ${
          callActive || callConnecting
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full ${isVideoDisabled ? "hidden" : "block"} object-cover scale-x-[-1]`}
        />
        {isVideoDisabled && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#1A1C23]">
            <span className="text-slate-500 text-sm font-medium">Camera Off</span>
          </div>
        )}
        <div className="absolute bottom-2 left-2 flex gap-1.5 pointer-events-none">
          <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[11px] text-white font-medium">
            You
          </div>
          {isMuted && (
            <div className="bg-red-500/90 backdrop-blur-md px-1.5 py-1 rounded flex items-center justify-center">
               <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="2" y1="2" x2="22" y2="22"></line><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"></path><path d="M5 10v2a7 7 0 0 0 12 5l-1.5-1.5a5 5 0 0 1-9-3.5v-2"></path><path d="M9 9v3a3 3 0 0 0 5.12 2.12l-1.5-1.5A1 1 0 0 1 10 12V9.88l-1-1z"></path></svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
