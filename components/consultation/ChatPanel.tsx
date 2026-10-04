"use client";

import React from "react";
import { MessageSquare, X, Sparkles, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
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
  return (
    <>
      <div
        className={`fixed inset-y-0 right-0 z-40 w-full md:w-[380px] lg:w-[420px] bg-white text-slate-900 flex flex-col shadow-2xl transition-transform duration-300 ease-out md:relative md:translate-x-0 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Chat Header */}
        <div className="h-16 border-b border-slate-100 flex items-center justify-between px-5 shrink-0 bg-white z-10">
          <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-600" />
            Consultation Chat
          </h2>
          <div className="flex items-center gap-2">
            <Button
              onClick={onClose}
              variant="ghost"
              className="md:hidden w-8 h-8 p-0 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50/50">
          <div className="text-center my-4">
            <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-1.5 rounded-full text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" /> Secure end-to-end encrypted
              chat
            </div>
          </div>

          {messages.length === 0 && (
            <div className="h-32 flex flex-col items-center justify-center text-slate-400 opacity-60">
              <MessageSquare className="w-8 h-8 mb-2" />
              <p className="text-sm">No messages yet.</p>
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
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-100 px-4 py-2 rounded-2xl rounded-tl-sm w-fit shadow-sm">
              <span
                className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <div className="p-4 bg-white border-t border-slate-100 shrink-0">
          <form
            onSubmit={onSendMessage}
            className="flex items-end gap-2 relative"
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
              className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none max-h-32 min-h-[46px]"
            />
            <Button
              type="submit"
              disabled={!inputText.trim()}
              className="h-[46px] w-[46px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 disabled:opacity-50 transition-transform active:scale-95"
            >
              <Send className="w-5 h-5 ml-1" />
            </Button>
          </form>
        </div>
      </div>

      {/* Mobile Chat Overlay Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 md:hidden"
          onClick={onClose}
        />
      )}
    </>
  );
}
