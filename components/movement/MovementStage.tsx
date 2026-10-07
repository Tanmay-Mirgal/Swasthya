"use client";

import type { ReactNode, RefObject } from "react";
import { CameraOff, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { MovementUi } from "@/hooks/useMovementSession";

function describeError(raw: string): { title: string; action: string } {
  const lower = raw.toLowerCase();
  if (lower.includes("permission") || lower.includes("denied") || lower.includes("notallowed")) {
    return { title: "Camera access is blocked", action: "Allow the camera for this site using the icon in your browser’s address bar, then try again." };
  }
  if (lower.includes("notfound") || lower.includes("requested device not found")) return { title: "No camera found", action: "Plug in or enable a camera, then try again." };
  if (lower.includes("notreadable") || lower.includes("in use")) return { title: "The camera is being used by another app", action: "Close other apps or tabs that use the camera, then try again." };
  if (lower.includes("model") || lower.includes("wasm") || lower.includes("fetch") || lower.includes("load")) return { title: "Movement tracking couldn’t load", action: "Check your internet connection and try again." };
  return { title: "We couldn’t start the camera", action: "Check your camera and connection, then try again." };
}

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  ui: Pick<MovementUi, "status" | "advice" | "phase" | "setupProgress" | "tracking">;
  error: string | null;
  onRetry: () => void;
  /** Hide the camera advice banner (for example while paused). */
  quiet?: boolean;
  /** When the camera cannot start, offer to carry on without it. */
  onManual?: () => void;
  children?: ReactNode;
}

/**
 * The camera window: video, the skeleton drawn on a canvas above it, and clear loading,
 * blocked and camera-advice states. The canvas is drawn by the movement hook, not by React.
 * Controls never sit on top of the body.
 */
export default function MovementStage({ videoRef, canvasRef, ui, error, onRetry, quiet, onManual, children }: Props) {
  const running = ui.status === "running";
  const failure = error ? describeError(error) : null;
  const showSetup = running && !quiet && !ui.advice && ui.phase === "setup" && ui.tracking;

  return (
    <div className="relative size-full min-h-[240px] overflow-hidden bg-[var(--camera-black,#0f1311)]">
      <video ref={videoRef} playsInline muted aria-label="Your camera" className={`size-full scale-x-[-1] object-cover transition-opacity duration-300 ${running ? "opacity-100" : "opacity-0"}`} />
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 size-full scale-x-[-1] object-cover" />

      {children && <div className="pointer-events-none absolute inset-0 z-20">{children}</div>}

      {running && !quiet && ui.advice && (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-30 flex justify-center">
          <p role="status" className="max-w-md rounded-lg bg-[var(--paper)] px-4 py-2.5 text-center text-sm font-semibold text-slate-900 shadow-md">
            {ui.advice.message}
          </p>
        </div>
      )}
      {showSetup && (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-30 flex justify-center">
          <div role="status" className="w-full max-w-md rounded-lg bg-[var(--paper)] px-4 py-2.5 text-center text-sm font-semibold text-slate-900 shadow-md">
            {ui.setupProgress > 0 ? "Hold still. Locking in your starting position." : "Get into your starting position."}
            <div className="mx-auto mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
              <div className="h-full bg-emerald-700 transition-[width] duration-200" style={{ width: `${Math.round(ui.setupProgress * 100)}%` }} />
            </div>
          </div>
        </div>
      )}

      {(!running || error) && (
        <div role={error ? "alert" : "status"} aria-live="polite" className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-[var(--camera-black,#0f1311)] p-6 text-center text-slate-100">
          {failure ? <ShieldAlert className="size-8 text-amber-300" aria-hidden="true" /> : ui.status === "loading" ? <Loader2 className="size-8 animate-spin text-emerald-300" aria-hidden="true" /> : <CameraOff className="size-8 text-slate-400" aria-hidden="true" />}
          <p className="text-lg font-semibold">{failure ? failure.title : ui.status === "loading" ? "Getting your camera ready" : "Camera is off"}</p>
          <p className="max-w-xs text-sm leading-relaxed text-slate-300">
            {failure ? failure.action : ui.status === "loading" ? "This takes a few seconds the first time. Video stays on your device." : "Turn the camera on to begin."}
          </p>
          {error && (
            <details className="max-w-xs text-xs text-slate-400">
              <summary className="cursor-pointer">Technical details</summary>
              <p className="mt-1 break-words font-mono">{error}</p>
            </details>
          )}
          {ui.status !== "loading" && (
            <Button onClick={onRetry} size="lg" className="pointer-events-auto mt-1">
              {failure ? "Try again" : "Turn on camera"}
            </Button>
          )}
          {failure && onManual && (
            <Button onClick={onManual} size="lg" variant="outline" className="pointer-events-auto">
              Continue without the camera
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
