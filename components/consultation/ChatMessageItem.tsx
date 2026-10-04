"use client";

import React from "react";
import Link from "next/link";
import { FileText, Pill, Dumbbell, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Message } from "@/types/consultation";

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

  if (msg.type === "prescription" && msg.prescriptionData) {
    const rx = msg.prescriptionData;
    return (
      <div className="my-6 bg-white rounded-2xl border border-emerald-200 shadow-sm overflow-hidden">
        <div className="bg-emerald-600 px-4 py-3 flex items-center gap-3 text-white">
          <FileText className="w-5 h-5" />
          <div>
            <h4 className="font-bold text-sm">Official Prescription</h4>
            <p className="text-[10px] text-emerald-100 font-medium">
              Issued by {rx.doctorName || doctorName || "Doctor"}
            </p>
          </div>
        </div>
        <div className="p-4 space-y-4">
          {rx.medicines && rx.medicines.length > 0 && (
            <div>
              <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Pill className="w-3 h-3 text-emerald-600" /> Medications
              </h5>
              <div className="space-y-2">
                {rx.medicines.map((m, i) => (
                  <div
                    key={i}
                    className="bg-slate-50 p-2 rounded-lg text-xs border border-slate-100"
                  >
                    <p className="font-bold text-slate-800">{m.name}</p>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      {m.dosage} • {m.frequency} • {m.duration}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {rx.exercises && rx.exercises.length > 0 && (
            <div>
              <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Dumbbell className="w-3 h-3 text-emerald-600" /> Recovery
                Exercises
              </h5>
              <ul className="space-y-1.5">
                {rx.exercises.map((ex, i) => (
                  <li
                    key={i}
                    className="text-xs text-slate-700 flex items-start gap-2"
                  >
                    <span className="text-emerald-500 mt-0.5">•</span>
                    <span>
                      <strong className="text-slate-800">{ex.name}</strong> -{" "}
                      {ex.sets} sets × {ex.reps} reps
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {rx.healthyTips && rx.healthyTips.length > 0 && (
            <div>
              <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Lightbulb className="w-3 h-3 text-amber-500" /> Clinical
                Advice
              </h5>
              <ul className="text-xs text-slate-600 space-y-1">
                {rx.healthyTips.map((tip: string, i: number) => (
                  <li key={i} className="pl-2 border-l-2 border-amber-200">
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-3 border-t border-slate-100">
            <Button
              asChild
              className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-9 text-xs"
            >
              <Link href="/">View on Dashboard</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col ${isSelf ? "items-end" : "items-start"}`}
    >
      <div className="flex items-center gap-1.5 mb-1 px-1">
        <span className="text-[10px] font-semibold text-slate-400">
          {isSelf
            ? "You"
            : msg.senderRole === "doctor"
            ? doctorName
            : patientName}
        </span>
      </div>
      <div
        className={`max-w-[85%] px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
          isSelf
            ? "bg-emerald-600 text-white rounded-2xl rounded-tr-sm"
            : "bg-white text-slate-800 border border-slate-200 rounded-2xl rounded-tl-sm"
        }`}
      >
        {msg.content}
      </div>
      <span className="text-[9px] text-slate-400 mt-1 px-1">
        {new Date(msg.createdAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    </div>
  );
}
