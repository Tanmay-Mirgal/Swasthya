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

const base = "flex h-12 min-w-12 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold";

/** Call controls: solid ink bar, labelled for screen readers, state shown by icon and fill. */
export default function VideoControls({ callActive, isMuted, isVideoDisabled, onToggleMute, onToggleVideo, onEndCall, onOpenChat }: VideoControlsProps) {
  if (!callActive) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center px-4 md:bottom-7">
      <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-900 p-2">
        <button
          onClick={onToggleMute}
          title={isMuted ? "Unmute microphone" : "Mute microphone"}
          aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
          aria-pressed={isMuted}
          className={`${base} ${isMuted ? "bg-red-600 text-white hover:bg-red-500" : "bg-slate-700 text-white hover:bg-slate-600"}`}
        >
          {isMuted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
        </button>
        <button
          onClick={onToggleVideo}
          title={isVideoDisabled ? "Turn on camera" : "Turn off camera"}
          aria-label={isVideoDisabled ? "Turn on camera" : "Turn off camera"}
          aria-pressed={isVideoDisabled}
          className={`${base} ${isVideoDisabled ? "bg-red-600 text-white hover:bg-red-500" : "bg-slate-700 text-white hover:bg-slate-600"}`}
        >
          {isVideoDisabled ? <VideoOff className="size-5" /> : <Video className="size-5" />}
        </button>
        <button onClick={onEndCall} title="End call" aria-label="End call" className={`${base} bg-red-600 px-5 text-white hover:bg-red-500`}>
          <Phone className="size-5 rotate-[135deg]" /> <span className="hidden sm:inline">End</span>
        </button>
        <button onClick={onOpenChat} title="Open conversation" aria-label="Open conversation" className={`${base} bg-slate-700 text-white hover:bg-slate-600 md:hidden`}>
          <MessageSquare className="size-5" />
        </button>
      </div>
    </div>
  );
}
