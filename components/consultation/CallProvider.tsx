"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@clerk/react";
import { useRealtime } from "@/lib/realtime/client/useRealtime";
import { RealtimeEvent } from "@/lib/realtime/protocol/events";
import { DEFAULT_CALL_TIMEOUTS } from "@/lib/webrtc/config";
import { notifyIfBackground } from "@/lib/notify";
import IncomingCallModal from "./IncomingCallModal";

interface Ring {
  consultationId: string;
  callId: string;
  callerName: string;
}

/**
 * App-wide incoming-call banner. A call rings on the callee's private channel, so it reaches them
 * on ANY page, not only inside the consultation room. Accept opens the consultation (which answers
 * the ringing call once); Decline works right here. On the consultation page itself the page's
 * own call controller handles the ring, so this stays out of the way.
 */
export default function CallProvider() {
  const { isSignedIn } = useAuth();
  const { client } = useRealtime();
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [ring, setRing] = useState<Ring | null>(null);
  const ringRef = useRef<Ring | null>(null);
  const onConsultationPage = pathname.startsWith("/consultation/");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const osNotice = useRef<Notification | null>(null);

  const clear = useCallback(() => {
    clearTimeout(timer.current);
    osNotice.current?.close();
    osNotice.current = null;
    ringRef.current = null;
    setRing(null);
  }, []);

  useEffect(() => {
    if (!isSignedIn) return;
    const offs = [
      client.on(RealtimeEvent.CALL_CREATE, (p, packet) => {
        if (onConsultationPage || ringRef.current?.callId === p.callId) return;
        const next = { consultationId: p.consultationId, callId: p.callId, callerName: packet.from?.name || p.callerName || "Incoming call" };
        ringRef.current = next;
        setRing(next);
        osNotice.current = notifyIfBackground({ title: "Incoming call", body: `${next.callerName} is calling you on Swasthya`, tag: `call-${p.callId}` });
        clearTimeout(timer.current);
        timer.current = setTimeout(clear, DEFAULT_CALL_TIMEOUTS.incomingRingMs);
      }),
      // The ring is over if the caller hangs up, or it was answered/declined on another device.
      client.on(RealtimeEvent.CALL_CANCEL, (p) => ringRef.current?.callId === p.callId && clear()),
      client.on(RealtimeEvent.CALL_END, (p) => (!p.callId || ringRef.current?.callId === p.callId) && clear()),
      client.on(RealtimeEvent.CALL_ACCEPT, (p) => ringRef.current?.callId === p.callId && clear()),
      client.on(RealtimeEvent.CALL_REJECT, (p) => ringRef.current?.callId === p.callId && clear()),
    ];
    return () => {
      offs.forEach((off) => off());
      clearTimeout(timer.current);
    };
  }, [client, isSignedIn, onConsultationPage, clear]);

  // Opening the consultation hands the ring to that page.
  useEffect(() => {
    // Syncs with the URL: the consultation page now owns the ring, so drop ours.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (onConsultationPage) clear();
  }, [onConsultationPage, clear]);

  if (!isSignedIn || !ring || onConsultationPage) return null;
  return (
    <IncomingCallModal
      incomingCall={{ callerName: ring.callerName, callerRole: "doctor" }}
      onAccept={() => {
        const target = `/consultation/${ring.consultationId}/?accept=1`;
        clear();
        router.push(target);
      }}
      onReject={() => {
        client.emit(RealtimeEvent.CALL_REJECT, { consultationId: ring.consultationId, callId: ring.callId, reason: "The call was declined." });
        clear();
      }}
    />
  );
}
