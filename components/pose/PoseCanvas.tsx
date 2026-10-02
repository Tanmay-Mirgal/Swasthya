"use client";

import { useEffect, useRef } from "react";
import { DrawingUtils, PoseLandmarker } from "@mediapipe/tasks-vision";
import { NormalizedLandmark } from "@/lib/pose/landmarks";

// MediaPipe Hand 21-landmark connection pairs
const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [9, 10], [10, 11], [11, 12],
  [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [0, 5], [5, 9], [9, 13], [13, 17],
];

interface PoseCanvasProps {
  landmarks: NormalizedLandmark[] | null;
  handLandmarks?: NormalizedLandmark[][] | null;
  videoWidth: number;
  videoHeight: number;
  /** Landmark indices to draw RED (form error) */
  incorrectLandmarkIndices?: number[];
  /** Landmark indices to draw YELLOW (low confidence) */
  lowConfidenceLandmarkIndices?: number[];
}

export default function PoseCanvas({
  landmarks,
  handLandmarks,
  videoWidth,
  videoHeight,
  incorrectLandmarkIndices = [],
  lowConfidenceLandmarkIndices = [],
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

    const W = canvas.width;
    const H = canvas.height;

    const incorrectSet = new Set(incorrectLandmarkIndices);
    const lowConfSet = new Set(lowConfidenceLandmarkIndices);
    const hasErrors = incorrectSet.size > 0;

    // ── Body skeleton ──────────────────────────────────────────────────
    if (landmarks && landmarks.length > 0) {
      const connections = PoseLandmarker.POSE_CONNECTIONS as ReadonlyArray<{ start: number; end: number }>;
      
      // Draw smooth connections
      ctx.beginPath();
      for (const conn of connections) {
        const a = landmarks[conn.start];
        const b = landmarks[conn.end];
        if (!a || !b) continue;

        const isError = incorrectSet.has(conn.start) || incorrectSet.has(conn.end);
        
        ctx.moveTo(a.x * W, a.y * H);
        ctx.lineTo(b.x * W, b.y * H);
      }
      ctx.lineWidth = 3;
      // Use a subtle white line with low opacity if no error, otherwise red
      ctx.strokeStyle = hasErrors ? "#F43F5E" : "rgba(255, 255, 255, 0.4)";
      ctx.stroke();

      // Draw subtle landmark dots
      for (let i = 0; i < landmarks.length; i++) {
        const lm = landmarks[i];
        if (!lm) continue;
        const isError = incorrectSet.has(i);

        ctx.beginPath();
        ctx.arc(lm.x * W, lm.y * H, isError ? 5 : 3.5, 0, Math.PI * 2);
        
        if (isError) {
          ctx.fillStyle = "#F43F5E";
          ctx.strokeStyle = "rgba(244, 63, 94, 0.3)";
          ctx.lineWidth = 4;
        } else {
          ctx.fillStyle = "#FFFFFF";
          ctx.strokeStyle = "rgba(16, 185, 129, 0.8)"; // Subtle emerald halo
          ctx.lineWidth = 2;
        }
        
        ctx.fill();
        ctx.stroke();
      }
    }

    // ── Hand / Finger skeleton ─────────────────────────────────────────
    if (handLandmarks && handLandmarks.length > 0) {
      for (const hand of handLandmarks) {
        if (!hand || hand.length < 21) continue;

        ctx.lineWidth = 2.5;
        for (const [a, b] of HAND_CONNECTIONS) {
          const lmA = hand[a];
          const lmB = hand[b];
          if (!lmA || !lmB) continue;

          let color = "#A78BFA";
          if ([0,1,2,3,4].includes(a) && [0,1,2,3,4].includes(b)) color = "#FACC15";
          else if ([5,6,7,8].includes(a) || [5,6,7,8].includes(b)) color = "#38BDF8";
          else if ([9,10,11,12].includes(a) || [9,10,11,12].includes(b)) color = "#4ADE80";
          else if ([13,14,15,16].includes(a) || [13,14,15,16].includes(b)) color = "#FB923C";
          else if ([17,18,19,20].includes(a) || [17,18,19,20].includes(b)) color = "#F472B6";

          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.moveTo(lmA.x * W, lmA.y * H);
          ctx.lineTo(lmB.x * W, lmB.y * H);
          ctx.stroke();
        }

        for (let i = 0; i < hand.length; i++) {
          const lm = hand[i];
          if (!lm) continue;
          const isTip = [4, 8, 12, 16, 20].includes(i);
          const isWrist = i === 0;

          ctx.beginPath();
          ctx.arc(lm.x * W, lm.y * H, isTip ? 6 : isWrist ? 7 : 4, 0, Math.PI * 2);

          if (isWrist) {
            ctx.fillStyle = "#FFFFFF";
            ctx.strokeStyle = "#10B981";
          } else if (isTip) {
            const tipColors: Record<number, string> = { 4: "#FACC15", 8: "#38BDF8", 12: "#4ADE80", 16: "#FB923C", 20: "#F472B6" };
            ctx.fillStyle = tipColors[i] || "#FFFFFF";
            ctx.strokeStyle = "#000000";
          } else {
            ctx.fillStyle = "#FFFFFF";
            ctx.strokeStyle = "#6B7280";
          }

          ctx.lineWidth = 1.5;
          ctx.fill();
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }, [landmarks, handLandmarks, videoWidth, videoHeight, incorrectLandmarkIndices, lowConfidenceLandmarkIndices]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full object-cover scale-x-[-1] pointer-events-none z-10"
    />
  );
}
