"use client";

import React from "react";
import { Phone, X } from "lucide-react";

import { IncomingCallData } from "@/types/consultation";

interface IncomingCallModalProps {
  incomingCall: IncomingCallData | null;
  onAccept: () => void;
  onReject: () => void;
}

export default function IncomingCallModal({
  incomingCall,
  onAccept,
  onReject,
}: IncomingCallModalProps) {
  if (!incomingCall) return null;

  return (
    <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50 bg-[#1A1C23]/95 backdrop-blur-xl border border-white/10 px-5 py-4 rounded-2xl shadow-[0_16px_40px_rgb(0,0,0,0.5)] flex items-center gap-5 animate-in slide-in-from-top-4 fade-in duration-300">
      <div className="flex flex-col">
        <span className="text-[13px] text-emerald-400 font-medium tracking-wide uppercase mb-0.5">Incoming Call</span>
        <span className="text-[17px] font-semibold text-white tracking-tight">{incomingCall.callerName}</span>
      </div>
      <div className="flex items-center gap-2 border-l border-white/10 pl-5">
        <button
          onClick={onReject}
          className="w-10 h-10 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500/20 flex items-center justify-center transition-colors"
          title="Decline"
        >
          <X className="w-5 h-5" />
        </button>
        <button
          onClick={onAccept}
          className="w-10 h-10 rounded-full bg-emerald-500 text-white hover:bg-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-900/30 transition-colors animate-pulse"
          title="Accept"
        >
          <Phone className="w-4 h-4 fill-current" />
        </button>
      </div>
    </div>
  );
}
