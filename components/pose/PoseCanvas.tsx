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
      
      // Dark under-stroke keeps the skeleton legible over any background, then the bone line.
      ctx.lineCap = "round";
      const drawBones = (color: string, width: number) => {
        ctx.beginPath();
        for (const conn of connections) {
          const a = landmarks[conn.start];
          const b = landmarks[conn.end];
          if (!a || !b) continue;
          ctx.moveTo(a.x * W, a.y * H);
          ctx.lineTo(b.x * W, b.y * H);
        }
        ctx.lineWidth = width;
        ctx.strokeStyle = color;
        ctx.stroke();
      };
      drawBones("rgba(10, 14, 12, 0.55)", 7);
      drawBones("rgba(255, 255, 255, 0.92)", 3.5);

      // Joints with a form problem are drawn larger with a ring and a cross, not only a different colour.
      for (let i = 0; i < landmarks.length; i++) {
        const lm = landmarks[i];
        if (!lm) continue;
        const isError = incorrectSet.has(i);
        const isLow = lowConfSet.has(i);
        const x = lm.x * W;
        const y = lm.y * H;

        ctx.beginPath();
        ctx.arc(x, y, isError ? 8 : 5, 0, Math.PI * 2);
        ctx.fillStyle = isError ? "#F2A18F" : "#FFFFFF";
        ctx.strokeStyle = isError ? "#B93F2B" : isLow ? "#F6D44B" : "#1F6B4F";
        ctx.lineWidth = isError ? 4 : 3;
        ctx.fill();
        ctx.stroke();

        if (isError) {
          ctx.beginPath();
          ctx.moveTo(x - 4, y - 4);
          ctx.lineTo(x + 4, y + 4);
          ctx.moveTo(x + 4, y - 4);
          ctx.lineTo(x - 4, y + 4);
          ctx.lineWidth = 2;
          ctx.strokeStyle = "#7A2A1C";
          ctx.stroke();
        }
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

          const color = "#BBDBC8";
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

          ctx.fillStyle = isWrist || isTip ? "#FFFFFF" : "#DCEDE3";
          ctx.strokeStyle = "#134333";

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
