"use client";

import React from "react";
import { FileText, ClipboardList, Dumbbell, Info } from "lucide-react";
import { Message } from "@/types/consultation";
import Link from "next/link";

interface ChatMessageItemProps {
  msg: Message;
  activeRole: "patient" | "doctor";
  doctorName?: string;
  patientName?: string;
}

export default function ChatMessageItem({
  msg,
  activeRole,
  doctorName,
  patientName,
}: ChatMessageItemProps) {
  const isSelf = msg.senderRole === activeRole;
  
  const timeString = new Date(msg.createdAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  if (msg.type === "prescription" && msg.prescriptionData) {
    const rx = msg.prescriptionData;
    return (
      <div className="my-4 px-1">
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
          <div className="border-b border-slate-100 bg-[#F8FAFC] px-4 py-3 flex items-start gap-3">
            <div className="w-8 h-8 rounded-md bg-slate-800 text-white flex items-center justify-center shrink-0 mt-0.5">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-800 text-[14px]">Clinical Prescription</h4>
              <p className="text-[12px] text-slate-500 font-medium mt-0.5">
                Issued by {rx.doctorName || doctorName || "Doctor"} • {timeString}
              </p>
            </div>
          </div>
          
          <div className="p-4 space-y-4">
            {rx.medicines && rx.medicines.length > 0 && (
              <div>
                <h5 className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <ClipboardList className="w-3 h-3" /> Medicines
                </h5>
                <div className="space-y-1.5">
                  {rx.medicines.map((m, i) => (
                    <div key={i} className="text-[13px] leading-tight">
                      <span className="font-medium text-slate-800">{m.name}</span>
                      <span className="text-slate-500 ml-1.5">
                        — {m.dosage}, {m.frequency}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {rx.exercises && rx.exercises.length > 0 && (
              <div>
                <h5 className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5 mt-4">
                  <Dumbbell className="w-3 h-3" /> Exercises
                </h5>
                <div className="space-y-1.5">
                  {rx.exercises.map((ex, i) => (
                    <div key={i} className="text-[13px] leading-tight flex items-start gap-2">
                      <span className="text-slate-400 mt-0.5">•</span>
                      <div>
                        <span className="font-medium text-slate-800">{ex.name}</span>
                        <span className="text-slate-500 ml-1.5">
                          — {ex.sets} sets × {ex.reps} reps
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {rx.doctorNotes && (
              <div className="pt-3 border-t border-slate-100">
                <h5 className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <Info className="w-3 h-3" /> Doctor&apos;s Notes
                </h5>
                <p className="text-[13px] text-slate-700 leading-relaxed italic">
                  &quot;{rx.doctorNotes}&quot;
                </p>
              </div>
            )}
          </div>
          
          <div className="border-t border-slate-100 px-4 py-2.5 bg-[#F8FAFC]">
            <Link href="/" className="text-[12px] font-medium text-blue-600 hover:text-blue-700 transition-colors">
              View full details →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Regular Chat Message
  return (
    <div className={`flex flex-col ${isSelf ? "items-end" : "items-start"} w-full mb-3`}>
      <div className="flex flex-col max-w-[85%]">
        {!isSelf && (
          <span className="text-[11px] font-medium text-slate-500 mb-1 ml-1">
            {msg.senderRole === "doctor" ? doctorName : patientName}
          </span>
        )}
        <div
          className={`px-3.5 py-2.5 text-[14px] leading-relaxed shadow-sm ${
            isSelf
              ? "bg-slate-800 text-white rounded-2xl rounded-tr-sm"
              : "bg-white text-slate-800 border border-slate-200 rounded-2xl rounded-tl-sm"
          }`}
        >
          {msg.content}
        </div>
        <span className={`text-[10px] text-slate-400 mt-1 font-medium ${isSelf ? "text-right mr-1" : "ml-1"}`}>
          {timeString}
        </span>
      </div>
    </div>
  );
}
