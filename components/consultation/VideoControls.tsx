"use client";

import React from "react";
import { Mic, MicOff, Video, VideoOff, Phone, MessageSquare } from "lucide-react";

interface VideoControlsProps {
  callActive: boolean;
  connectionStatus: "connecting" | "connected" | "disconnected";
  isMuted: boolean;
  isVideoDisabled: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
  onOpenChat: () => void;
}

export default function VideoControls({
  callActive,
  connectionStatus,
  isMuted,
  isVideoDisabled,
  onToggleMute,
  onToggleVideo,
  onEndCall,
  onOpenChat,
}: VideoControlsProps) {
  if (!callActive) return null;

  return (
    <div className="absolute bottom-6 md:bottom-8 left-0 right-0 z-20 flex justify-center pointer-events-none px-4">
      <div className="flex items-center gap-3 md:gap-4 bg-[#1A1C23]/90 backdrop-blur-xl px-4 py-3 md:px-5 md:py-3.5 rounded-2xl border border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.4)] pointer-events-auto">
        <button
          onClick={onToggleMute}
          title={isMuted ? "Unmute microphone" : "Mute microphone"}
          className={`w-11 h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all ${
            isMuted
              ? "bg-red-500/20 text-red-500 hover:bg-red-500/30"
              : "bg-white/10 text-white hover:bg-white/20"
          }`}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <button
          onClick={onToggleVideo}
          title={isVideoDisabled ? "Turn on camera" : "Turn off camera"}
          className={`w-11 h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all ${
            isVideoDisabled
              ? "bg-red-500/20 text-red-500 hover:bg-red-500/30"
              : "bg-white/10 text-white hover:bg-white/20"
          }`}
        >
          {isVideoDisabled ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </button>

        <div className="w-[1px] h-8 bg-white/10 mx-1 hidden md:block" />

        <button
          onClick={onEndCall}
          title="End call"
          className="w-16 h-11 md:w-20 md:h-12 rounded-xl bg-red-600 hover:bg-red-500 text-white flex items-center justify-center transition-all"
        >
          <Phone className="w-5 h-5 transform rotate-[135deg]" />
        </button>

        <div className="w-[1px] h-8 bg-white/10 mx-1 block md:hidden" />

        {/* Mobile Chat Toggle */}
        <button
          onClick={onOpenChat}
          title="Open conversation"
          className="md:hidden w-11 h-11 rounded-xl bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-all"
        >
          <MessageSquare className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
