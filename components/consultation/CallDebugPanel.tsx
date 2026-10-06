"use client";

import { useEffect, useState } from "react";
import { getRecentCallLog } from "@/lib/webrtc/callLog";
import type { CallSnapshot } from "@/lib/webrtc/callController";

interface Props {
  debug: CallSnapshot;
  socket: string;
  hasLocalStream: boolean;
  hasRemoteStream: boolean;
}

/**
 * Development-only call inspector. Shown only outside production AND with ?callDebug=1; renders
 * nothing otherwise. Shows ids and states only, never SDP, candidates or tokens.
 */
export default function CallDebugPanel({ debug, socket, hasLocalStream, hasRemoteStream }: Props) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    // Reads the URL, which only exists in the browser: must run after mount to avoid a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOn(process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).get("callDebug") === "1");
  }, []);
  if (!on) return null;
  const rows: [string, string][] = [
    ["Call ID", debug.call.callId ?? "—"],
    ["Call state", debug.call.endReason ? `${debug.call.phase} (${debug.call.endReason})` : debug.call.phase],
    ["Connection", debug.pc.connection],
    ["ICE", debug.pc.ice],
    ["Signaling", debug.pc.signaling],
    ["Socket", socket],
    ["Local stream", hasLocalStream ? "yes" : "no"],
    ["Remote stream", hasRemoteStream ? "yes" : "no"],
    ["Pending ICE", String(debug.pendingIce)],
    ["Timer", `${debug.duration}s`],
  ];
  return (
    <aside aria-label="Call debug" className="pointer-events-none fixed bottom-2 left-2 z-[90] max-w-[min(26rem,calc(100vw-1rem))] rounded-md bg-black/85 p-2 font-mono text-[11px] leading-snug text-slate-100">
      {rows.map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <span className="w-24 shrink-0 text-slate-400">{k}</span>
          <span className="truncate">{v}</span>
        </div>
      ))}
      <pre className="mt-1 max-h-32 overflow-hidden whitespace-pre-wrap text-slate-400">{getRecentCallLog().slice(-6).join("\n")}</pre>
    </aside>
  );
}
