"use client";

import React from "react";
import { PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/Button";
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
    <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 bg-slate-800/90 backdrop-blur-xl border border-slate-600 p-6 rounded-3xl shadow-2xl flex flex-col items-center gap-4 min-w-[320px] animate-in fade-in slide-in-from-top-10">
      <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center animate-pulse">
        <PhoneCall className="w-8 h-8 text-emerald-400" />
      </div>
      <div className="text-center">
        <h3 className="text-lg font-bold text-white">Incoming Call</h3>
        <p className="text-slate-300 text-sm mt-1">
          from {incomingCall.callerName}
        </p>
      </div>
      <div className="flex gap-4 w-full mt-2">
        <Button
          onClick={onReject}
          className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-2xl h-12"
        >
          Decline
        </Button>
        <Button
          onClick={onAccept}
          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl h-12 shadow-lg shadow-emerald-900/50"
        >
          Accept
        </Button>
      </div>
    </div>
  );
}
