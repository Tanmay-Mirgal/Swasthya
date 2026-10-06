"use client";

import React from "react";
import { FileText } from "lucide-react";
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
        <div className="bg-white border border-slate-300 rounded-lg overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 flex items-start gap-3">
            <div className="w-8 h-8 rounded-md bg-emerald-700 text-white flex items-center justify-center shrink-0 mt-0.5">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-800 text-base">Clinical Prescription</h4>
              <p className="text-[12px] text-slate-500 font-medium mt-0.5">
                Issued by {rx.doctorName || doctorName || "Doctor"} · {timeString}
              </p>
            </div>
          </div>
          
          <div className="p-4 space-y-4">
            {rx.medicines && rx.medicines.length > 0 && (
              <div>
                <h5 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                  Medicines
                </h5>
                <div className="space-y-1.5">
                  {rx.medicines.map((m, i) => (
                    <div key={i} className="text-sm leading-tight">
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
                <h5 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5 mt-4">
                  Exercises
                </h5>
                <div className="space-y-1.5">
                  {rx.exercises.map((ex, i) => (
                    <div key={i} className="text-sm leading-tight flex items-start gap-2">
                      <span aria-hidden="true" className="text-slate-500 mt-0.5">–</span>
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
                <h5 className="text-sm font-bold text-slate-900 mb-1.5 flex items-center gap-1.5">
                  Doctor’s notes
                </h5>
                <p className="hand">
                  “{rx.doctorNotes}”
                </p>
              </div>
            )}
          </div>
          
          <div className="border-t border-slate-100 px-4 py-2.5 bg-slate-50">
            <Link href="/" className="text-sm font-semibold text-emerald-700 underline underline-offset-4">
              View your plan
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
          <span className="text-xs font-medium text-slate-500 mb-1 ml-1">
            {msg.senderRole === "doctor" ? doctorName : patientName}
          </span>
        )}
        <div
          className={`px-3.5 py-2.5 text-base leading-relaxed ${
            isSelf
              ? "bg-emerald-700 text-white rounded-lg"
              : "bg-white text-slate-800 border border-slate-200 rounded-lg"
          }`}
        >
          {msg.content}
        </div>
        <span className={`text-xs text-slate-600 mt-1 font-medium ${isSelf ? "text-right mr-1" : "ml-1"}`}>
          {timeString}
          {isSelf && msg.status === "sending" && " · Sending…"}
          {isSelf && msg.status === "failed" && (
            <span className="text-red-600"> · Not sent</span>
          )}
          {isSelf && msg.status !== "sending" && msg.status !== "failed" && (msg.read ? " · Read" : " · Sent")}
        </span>
      </div>
    </div>
  );
}
