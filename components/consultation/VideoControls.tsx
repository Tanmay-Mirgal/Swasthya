"use client";

import React from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/Button";

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
  return (
    <div className="h-20 md:h-24 bg-slate-950 border-t border-slate-800 flex items-center justify-between px-4 md:px-8 shrink-0 z-20 relative">
      <div className="flex-1 flex items-center justify-start">
        {/* Connection Status indicator */}
        <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 font-medium bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800">
          <div
            className={`w-2 h-2 rounded-full ${
              connectionStatus === "connected"
                ? "bg-emerald-500"
                : "bg-red-500 animate-pulse"
            }`}
          />
          {connectionStatus === "connected"
            ? "Socket Connected"
            : "Reconnecting..."}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center gap-3 md:gap-5">
        <Button
          onClick={onToggleMute}
          disabled={!callActive}
          variant="outline"
          className={`w-12 h-12 md:w-14 md:h-14 rounded-full border-0 shadow-lg flex items-center justify-center transition-all ${
            isMuted
              ? "bg-slate-200 text-slate-900 hover:bg-slate-300"
              : "bg-slate-800 text-white hover:bg-slate-700"
          }`}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </Button>
        <Button
          onClick={onToggleVideo}
          disabled={!callActive}
          variant="outline"
          className={`w-12 h-12 md:w-14 md:h-14 rounded-full border-0 shadow-lg flex items-center justify-center transition-all ${
            isVideoDisabled
              ? "bg-slate-200 text-slate-900 hover:bg-slate-300"
              : "bg-slate-800 text-white hover:bg-slate-700"
          }`}
        >
          {isVideoDisabled ? (
            <VideoOff className="w-5 h-5" />
          ) : (
            <Video className="w-5 h-5" />
          )}
        </Button>
        {callActive && (
          <Button
            onClick={onEndCall}
            className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-xl shadow-red-900/30 flex items-center justify-center"
          >
            <PhoneOff className="w-6 h-6" />
          </Button>
        )}
      </div>

      <div className="flex-1 flex items-center justify-end gap-3">
        {/* Mobile Chat Toggle */}
        <Button
          onClick={onOpenChat}
          variant="outline"
          className="md:hidden w-12 h-12 rounded-full bg-slate-800 border-0 text-white hover:bg-slate-700 relative shadow-lg"
        >
          <MessageSquare className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
