"use client";

import { RefObject, ReactNode, useState, useEffect } from "react";
import PoseCanvas from "./PoseCanvas";
import { NormalizedLandmark } from "@/lib/pose/landmarks";

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
  forceFullScreen?: boolean;
  incorrectLandmarkIndices?: number[];
  lowConfidenceLandmarkIndices?: number[];
}

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
  forceFullScreen = false,
  incorrectLandmarkIndices = [],
  lowConfidenceLandmarkIndices = [],
}: CameraViewProps) {
  const [isFullScreen, setIsFullScreen] = useState(forceFullScreen);

  useEffect(() => {
    setIsFullScreen(forceFullScreen);
  }, [forceFullScreen]);

  // Handle escape key to exit full screen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullScreen) {
        setIsFullScreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullScreen]);

  const toggleFullScreen = () => {
    setIsFullScreen((prev) => !prev);
  };

  return (
    <div
      className={
        isFullScreen
          ? "fixed inset-0 z-50 w-screen h-screen bg-black flex items-center justify-center overflow-hidden"
          : "relative w-full aspect-[3/4] sm:aspect-[4/3] max-h-[580px] bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 shadow-xl flex items-center justify-center transition-all duration-300"
      }
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        playsInline
        muted
        className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-300 ${
          isActive ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Canvas Overlay for Pose Skeleton */}
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

      {/* Floating Controls & Overlays */}
      {isActive && (
        <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
          {/* Full Screen Toggle Button */}
          <button
            onClick={toggleFullScreen}
            type="button"
            title={isFullScreen ? "Exit Fullscreen" : "Fullscreen Camera"}
            className="p-2.5 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white backdrop-blur border border-white/20 shadow-lg transition-transform active:scale-95 flex items-center justify-center"
          >
            {isFullScreen ? (
              // Collapse Icon
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9L4 4m0 0l5 0m-5 0l0 5m11 4l5 5m0 0l-5 0m5 0l0-5M9 15l-5 5m0 0l5 0m-5 0l0-5m11-11l5-5m0 0l-5 0m5 0l0 5" />
              </svg>
            ) : (
              // Expand Icon
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            )}
          </button>
        </div>
      )}

      {/* Children overlays (e.g. Floating live UI hud) */}
      {children && (
        <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-4">
          {children}
        </div>
      )}

      {/* Error or Inactive / Loading Placeholder */}
      {(!isActive || isLoading || errorMessage) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-zinc-400 bg-zinc-950/95 gap-3 z-40">
          <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-500">
            {errorMessage ? (
              <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ) : isLoading ? (
              <svg className="w-6 h-6 animate-spin text-emerald-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </div>

          <p className="text-sm font-semibold text-zinc-200">
            {errorMessage
              ? "Camera Permission / Access Error"
              : isLoading
              ? "Loading MediaPipe AI Model..."
              : "Camera Off"}
          </p>

          {errorMessage && (
            <p className="text-xs text-amber-300/90 max-w-xs font-mono bg-amber-950/40 p-2.5 rounded-lg border border-amber-900/50">
              {errorMessage}
            </p>
          )}

          {statusMessage && !errorMessage && (
            <p className="text-xs text-zinc-400 max-w-xs">{statusMessage}</p>
          )}

          {onRetryCamera && (
            <button
              onClick={onRetryCamera}
              className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md transition-all"
            >
              Allow &amp; Start Camera
            </button>
          )}
        </div>
      )}
    </div>
  );
}

