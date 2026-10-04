"use client";

import React from "react";
import { ArrowLeft, ShieldCheck, UserCheck, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";

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
  callActive,
  onBack,
  onOpenPrescriptionModal,
}: ConsultationHeaderProps) {
  return (
    <div className="absolute top-0 left-0 right-0 p-4 md:p-6 z-10 flex items-center justify-between bg-linear-to-b from-slate-950/80 to-transparent pointer-events-none">
      <div className="flex items-center gap-4 pointer-events-auto">
        <Button
          onClick={onBack}
          variant="ghost"
          className="text-white hover:bg-white/10 rounded-full w-10 h-10 p-0 shadow-sm border border-white/10 backdrop-blur-md"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-lg md:text-xl font-semibold text-white drop-shadow-md flex items-center gap-2">
            {peerName}
            {activeRole === "patient" ? (
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            ) : (
              <UserCheck className="w-4 h-4 text-emerald-400" />
            )}
          </h1>
          <div className="flex items-center gap-2 text-xs md:text-sm text-slate-300 drop-shadow-sm font-medium">
            <div
              className={`w-2 h-2 rounded-full ${
                onlineUsers > 1 ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            <span>{onlineUsers > 1 ? "Online" : "Waiting for peer..."}</span>
            <span className="opacity-50">•</span>
            <span>
              {isCompleted
                ? "Completed"
                : callActive
                ? "Call Connected"
                : "Scheduled"}
            </span>
          </div>
        </div>
      </div>

      {/* Desktop Top Right Controls */}
      <div className="hidden md:flex items-center gap-3 pointer-events-auto">
        {activeRole === "doctor" && !isCompleted && onOpenPrescriptionModal && (
          <Button
            onClick={onOpenPrescriptionModal}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-full px-5 py-2 shadow-lg border border-emerald-500/50 transition-all"
          >
            <FileText className="w-4 h-4 mr-2" /> Write Prescription
          </Button>
        )}
      </div>
    </div>
  );
}
