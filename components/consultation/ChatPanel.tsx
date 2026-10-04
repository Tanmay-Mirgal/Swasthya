"use client";

import React, { useEffect } from "react";
import { X, Send, Menu } from "lucide-react";
import ChatMessageItem from "./ChatMessageItem";
import { Message } from "@/types/consultation";

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  activeRole: "patient" | "doctor";
  doctorName?: string;
  patientName?: string;
  peerTyping: boolean;
  inputText: string;
  onInputChange: (val: string) => void;
  onSendMessage: (e: React.FormEvent) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export default function ChatPanel({
  isOpen,
  onClose,
  messages,
  activeRole,
  doctorName,
  patientName,
  peerTyping,
  inputText,
  onInputChange,
  onSendMessage,
  messagesEndRef,
}: ChatPanelProps) {
  
  // We apply conditional classes to show/hide on mobile, but keep it fixed width on desktop.
  return (
    <>
      <div
        className={`fixed inset-y-0 right-0 z-40 w-full md:w-[380px] lg:w-[400px] bg-[#F9FAFB] border-l border-slate-200 flex flex-col transition-transform duration-300 ease-out md:relative md:translate-x-0 ${
          isOpen ? "translate-x-0 shadow-2xl md:shadow-none" : "translate-x-full"
        }`}
      >
        {/* Chat Header */}
        <div className="h-[68px] border-b border-slate-200 flex items-center justify-between px-5 shrink-0 bg-white">
          <div className="flex flex-col">
            <h2 className="font-semibold text-slate-800 text-[15px] tracking-tight">
              Conversation
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[12px] text-slate-500 font-medium">
                {activeRole === "patient" ? doctorName : patientName}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="md:hidden w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <p className="text-[13px] font-medium">No messages yet.</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <ChatMessageItem
              key={msg._id || idx}
              msg={msg}
              activeRole={activeRole}
              doctorName={doctorName}
              patientName={patientName}
            />
          ))}

          {peerTyping && (
            <div className="flex items-center gap-1 text-[13px] text-slate-500 italic mt-2 px-1">
              {activeRole === "patient" ? "Doctor" : "Patient"} is typing...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <div className="p-4 bg-white border-t border-slate-200 shrink-0">
          <form
            onSubmit={onSendMessage}
            className="relative flex items-end bg-[#F3F4F6] rounded-xl border border-transparent focus-within:border-slate-300 focus-within:bg-white transition-colors overflow-hidden"
          >
            <textarea
              value={inputText}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSendMessage(e);
                }
              }}
              placeholder="Type a message..."
              rows={1}
              className="flex-1 bg-transparent px-4 py-3.5 text-[14px] text-slate-800 placeholder-slate-400 focus:outline-none resize-none max-h-32 min-h-[50px] leading-relaxed"
            />
            <div className="pr-2 pb-2 shrink-0">
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            </div>
          </form>
          <div className="text-[11px] text-slate-400 text-center mt-2.5 font-medium">
            End-to-end encrypted
          </div>
        </div>
      </div>

      {/* Mobile Chat Overlay Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-[#0B0C10]/40 backdrop-blur-sm z-30 md:hidden"
          onClick={onClose}
        />
      )}
    </>
  );
}
