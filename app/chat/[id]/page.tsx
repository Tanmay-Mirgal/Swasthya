"use client";

import { use } from "react";
import Link from "next/link";
import AppShell from "@/components/navigation/AppShell";
import { ArrowLeft, Send, User } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  
  return (
    <AppShell>
      <div className="flex flex-col h-[calc(100vh-80px)] bg-slate-50 -mx-4 sm:mx-0 overflow-hidden relative">
        {/* Chat Header */}
        <div className="flex items-center px-4 py-3 bg-white border-b border-slate-200 shadow-sm shrink-0">
          <Link href="/" className="mr-3 p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </Link>
          <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center mr-3">
             <User className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1">
             <h2 className="text-sm font-semibold text-slate-900">Care Conversation</h2>
             <p className="text-[10px] text-slate-500 uppercase font-medium tracking-wider">Secure Messaging</p>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
           {/* Empty State / System Message */}
           <div className="text-center my-6">
              <span className="bg-slate-200 text-slate-600 text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full">
                Conversation Started
              </span>
           </div>
           
           <div className="flex flex-col items-center justify-center h-40 opacity-50 space-y-3">
              <p className="text-sm text-slate-500 max-w-[250px] text-center">
                This is a secure space to communicate regarding your rehabilitation.
              </p>
           </div>
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-200 shrink-0">
          <div className="flex items-end gap-2">
            <div className="flex-1 bg-slate-100 rounded-2xl border border-slate-200 px-4 py-3 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
               <textarea 
                 rows={1}
                 placeholder="Type a message..."
                 className="w-full bg-transparent border-0 focus:ring-0 p-0 text-sm resize-none"
               />
            </div>
            <Button className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 shrink-0 p-0 flex items-center justify-center">
              <Send className="w-5 h-5 text-white ml-0.5" />
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
