"use client";

import { useEffect, useRef } from "react";
import { DrawingUtils, PoseLandmarker } from "@mediapipe/tasks-vision";
import { NormalizedLandmark } from "@/lib/pose/landmarks";

interface PoseCanvasProps {
  landmarks: NormalizedLandmark[] | null;
  videoWidth: number;
  videoHeight: number;
}

export default function PoseCanvas({
  landmarks,
  videoWidth,
  videoHeight,
}: PoseCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
      canvas.width = videoWidth || 640;
      canvas.height = videoHeight || 480;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (landmarks && landmarks.length > 0) {
      const drawingUtils = new DrawingUtils(ctx);

      // Draw skeleton connectors (neon green)
      drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, {
        color: "#10B981", // Emerald green
        lineWidth: 4,
      });

      // Draw landmark joint points (pink/cyan)
      drawingUtils.drawLandmarks(landmarks, {
        color: "#F43F5E", // Rose red
        fillColor: "#06B6D4", // Cyan
        lineWidth: 2,
        radius: 5,
      });
    }

    ctx.restore();
  }, [landmarks, videoWidth, videoHeight]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full object-cover scale-x-[-1] pointer-events-none z-10"
    />
  );
}
