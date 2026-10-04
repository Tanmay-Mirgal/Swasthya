"use client";

import React from "react";
import { FileText, ChevronLeft } from "lucide-react";

interface ConsultationHeaderProps {
  peerName?: string;
  activeRole: "patient" | "doctor";
  onlineUsers: number;
  isCompleted: boolean;
  callActive: boolean;
  onBack: () => void;
  onOpenPrescriptionModal?: () => void;
}

export default function ConsultationHeader({
  peerName,
  activeRole,
  onlineUsers,
  isCompleted,
  onBack,
  onOpenPrescriptionModal,
}: ConsultationHeaderProps) {
  return (
    <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-5 pt-5 pb-12 bg-gradient-to-b from-[#0B0C10]/80 via-[#0B0C10]/40 to-transparent pointer-events-none">
      <div className="flex items-center gap-4 pointer-events-auto">
        <button
          onClick={onBack}
          className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg p-2 transition-colors flex items-center justify-center -ml-2"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-[17px] font-semibold text-white tracking-tight leading-tight">
            {peerName || (activeRole === "patient" ? "Doctor" : "Patient")}
          </h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                onlineUsers > 1 ? "bg-emerald-500" : "bg-amber-500 opacity-60"
              }`}
            />
            <span className="text-[13px] font-medium text-slate-300">
              {isCompleted
                ? "Completed"
                : onlineUsers > 1
                ? "Connected"
                : "Waiting..."}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 pointer-events-auto">
        {activeRole === "doctor" && !isCompleted && onOpenPrescriptionModal && (
          <button
            onClick={onOpenPrescriptionModal}
            className="hidden md:flex items-center gap-2 bg-[#1A1C23]/90 hover:bg-[#252830] text-white px-4 py-2 rounded-lg text-[13px] font-medium border border-white/10 transition-colors shadow-sm backdrop-blur-md"
          >
            <FileText className="w-4 h-4 text-slate-300" />
            Write Prescription
          </button>
        )}
      </div>
    </div>
  );
}
