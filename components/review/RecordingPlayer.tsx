"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { Play } from "lucide-react";
import { Button, Notice } from "@/components/ui";

/**
 * Plays a weekly-review recording. The clip is private: it is fetched through an authorised
 * route (the request carries the signed-in user's token, which a plain <video src> cannot),
 * and only when the person presses Watch, so nobody downloads a video by opening a page.
 */
export default function RecordingPlayer({ recordingId, label }: { recordingId: string; label: string }) {
  const { getToken } = useAuth();
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    []
  );

  async function load() {
    setState("loading");
    setMessage(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/recordings/${recordingId}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "load");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = url;
      setSrc(url);
      setState("ready");
    } catch (e) {
      setMessage(e instanceof Error && e.message !== "load" ? e.message : "The recording couldn’t be loaded. Check your connection and try again.");
      setState("error");
    }
  }

  if (state === "ready" && src) {
    return (
      <div>
        {/* No captions exist for a silent exercise clip: it is video only. */}
        <video src={src} controls playsInline preload="metadata" aria-label={label} className="aspect-video w-full max-w-xl rounded-md border border-slate-900 bg-black" />
        <p className="mt-1 text-xs text-slate-600">Only you and the therapist can watch this clip.</p>
      </div>
    );
  }
  return (
    <div>
      {state === "error" && <Notice className="mb-3" tone="danger" title={message ?? "The recording couldn’t be loaded."} />}
      <Button type="button" variant="outline" onClick={() => void load()} disabled={state === "loading"}>
        <Play className="size-4 fill-current" aria-hidden="true" /> {state === "loading" ? "Loading the recording…" : "Watch recording"}
      </Button>
    </div>
  );
}
