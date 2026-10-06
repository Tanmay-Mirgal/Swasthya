"use client";

import React from "react";
import { Phone, X } from "lucide-react";
import { IncomingCallData } from "@/types/consultation";

interface IncomingCallModalProps {
  incomingCall: IncomingCallData | null;
  onAccept: () => void;
  onReject: () => void;
}

export default function IncomingCallModal({ incomingCall, onAccept, onReject }: IncomingCallModalProps) {
  if (!incomingCall) return null;
  return (
    <div
      role="alertdialog"
      aria-label={`Incoming call from ${incomingCall.callerName}`}
      className="absolute left-1/2 top-24 z-50 flex w-[min(24rem,calc(100%-2rem))] -translate-x-1/2 items-center gap-4 rounded-lg border border-slate-500 bg-slate-900 px-4 py-3"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-emerald-300">Incoming call</p>
        <p className="truncate text-lg font-semibold text-white">{incomingCall.callerName}</p>
      </div>
      <button onClick={onReject} title="Decline" aria-label="Decline call" className="flex h-11 items-center gap-1.5 rounded-lg bg-red-600 px-3 text-sm font-semibold text-white hover:bg-red-500">
        <X className="size-4" aria-hidden="true" /> Decline
      </button>
      <button onClick={onAccept} title="Accept" aria-label="Accept call" className="flex h-11 items-center gap-1.5 rounded-lg bg-emerald-500 px-3 text-sm font-semibold text-[var(--ink)] hover:bg-emerald-400">
        <Phone className="size-4 fill-current" aria-hidden="true" /> Accept
      </button>
    </div>
  );
}
