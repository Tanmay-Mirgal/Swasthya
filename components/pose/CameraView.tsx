"use client";

import { RefObject, ReactNode } from "react";
import { CameraOff, Loader2, ShieldAlert } from "lucide-react";
import PoseCanvas from "./PoseCanvas";
import { NormalizedLandmark } from "@/lib/pose/landmarks";
import { Button } from "@/components/ui/Button";

interface CameraViewProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  landmarks: NormalizedLandmark[] | null;
  handLandmarks?: NormalizedLandmark[][] | null;
  isActive: boolean;
  isLoading: boolean;
  videoDimensions: { width: number; height: number };
  statusMessage?: string;
  errorMessage?: string | null;
  onRetryCamera?: () => void;
  children?: ReactNode;
  incorrectLandmarkIndices?: number[];
  lowConfidenceLandmarkIndices?: number[];
}

function describeError(raw: string): { title: string; action: string } {
  const lower = raw.toLowerCase();
  if (lower.includes("permission") || lower.includes("denied") || lower.includes("notallowed")) {
    return {
      title: "Camera access is blocked",
      action: "Allow the camera for this site using the icon in your browser’s address bar, then try again.",
    };
  }
  if (lower.includes("notfound") || lower.includes("requested device not found")) {
    return { title: "No camera found", action: "Plug in or enable a camera, then try again." };
  }
  if (lower.includes("notreadable") || lower.includes("in use")) {
    return { title: "The camera is being used by another app", action: "Close other apps or tabs that use the camera, then try again." };
  }
  if (lower.includes("model")) {
    return { title: "Movement tracking couldn’t load", action: "Check your internet connection and try again." };
  }
  return { title: "We couldn’t start the camera", action: "Check your camera and connection, then try again." };
}

/** The camera window: video, the skeleton drawn over it, and clear start/blocked states. No controls on top of the body. */
export default function CameraView({
  videoRef,
  landmarks,
  handLandmarks,
  isActive,
  isLoading,
  videoDimensions,
  statusMessage,
  errorMessage,
  onRetryCamera,
  children,
  incorrectLandmarkIndices = [],
  lowConfidenceLandmarkIndices = [],
}: CameraViewProps) {
  const error = errorMessage ? describeError(errorMessage) : null;

  return (
    <div className="relative size-full min-h-[240px] overflow-hidden bg-slate-950">
      <video
        ref={videoRef}
        playsInline
        muted
        aria-label="Your camera"
        className={`size-full scale-x-[-1] object-cover transition-opacity duration-300 ${isActive ? "opacity-100" : "opacity-0"}`}
      />

      {isActive && (
        <PoseCanvas
          landmarks={landmarks}
          handLandmarks={handLandmarks}
          videoWidth={videoDimensions.width}
          videoHeight={videoDimensions.height}
          incorrectLandmarkIndices={incorrectLandmarkIndices}
          lowConfidenceLandmarkIndices={lowConfidenceLandmarkIndices}
        />
      )}

      {children && <div className="pointer-events-none absolute inset-0 z-20">{children}</div>}

      {(!isActive || isLoading || errorMessage) && (
        <div
          role={errorMessage ? "alert" : "status"}
          aria-live="polite"
          className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-slate-950 p-6 text-center text-slate-100"
        >
          {error ? (
            <ShieldAlert className="size-8 text-amber-300" aria-hidden="true" />
          ) : isLoading ? (
            <Loader2 className="size-8 animate-spin text-emerald-300" aria-hidden="true" />
          ) : (
            <CameraOff className="size-8 text-slate-400" aria-hidden="true" />
          )}

          <p className="text-lg font-semibold">{error ? error.title : isLoading ? "Getting your camera ready" : "Camera is off"}</p>
          <p className="max-w-xs text-sm leading-relaxed text-slate-300">
            {error ? error.action : isLoading ? "This takes a few seconds the first time. Video stays on your device." : statusMessage || "Turn the camera on to begin."}
          </p>

          {errorMessage && (
            <details className="max-w-xs text-xs text-slate-400">
              <summary className="cursor-pointer">Technical details</summary>
              <p className="mt-1 break-words font-mono">{errorMessage}</p>
            </details>
          )}

          {onRetryCamera && !isLoading && (
            <Button onClick={onRetryCamera} size="lg" className="pointer-events-auto mt-1">
              {error ? "Try again" : "Turn on camera"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
