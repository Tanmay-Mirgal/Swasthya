"use client";

import { useEffect, useRef, useState, useCallback, ReactNode } from "react";
import { PoseLandmarker, HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import CameraView from "./CameraView";
import { NormalizedLandmark } from "@/lib/pose/landmarks";
import { checkPoseConfidence, ConfidenceCheckResult } from "@/lib/pose/confidence";
import { calculateAngle } from "@/lib/biomechanics/angle";
import { updateROM, ROMTracker, createROMTracker } from "@/lib/biomechanics/rom";
import {
  RepCounterState,
  createRepCounterState,
  processRepFrame,
} from "@/lib/exercises/repCounter";
import { generateFeedback } from "@/lib/feedback/feedbackEngine";
import { FeedbackMessage } from "@/lib/exercises/types";
import { PoseLandmark, getLandmark } from "@/lib/pose/landmarks";
import { computeNeckLateralOffset } from "@/lib/exercises/neckRotation";

export interface FrameUpdateData {
  landmarks: NormalizedLandmark[] | null;
  confidence: ConfidenceCheckResult;
  jointAngle: number;
  romTracker: ROMTracker;
  repState: RepCounterState;
  feedback: FeedbackMessage;
  fps: number;
}

interface PoseDetectorProps {
  onFrameUpdate?: (data: FrameUpdateData) => void;
  autoStart?: boolean;
  targetReps?: number;
  exerciseId?: string;
  bodySegment?: "lower" | "upper" | "neck";
  children?: ReactNode;
  forceFullScreen?: boolean;
  incorrectLandmarkIndices?: number[];
  lowConfidenceLandmarkIndices?: number[];
}

export default function PoseDetector({
  onFrameUpdate,
  autoStart = true,
  targetReps = 10,
  exerciseId = "seated-knee-extension",
  bodySegment = "lower",
  children,
  forceFullScreen = false,
  incorrectLandmarkIndices = [],
  lowConfidenceLandmarkIndices = [],
}: PoseDetectorProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const streamRef = useRef<MediaStream | null>(null);

  const [isActive, setIsActive] = useState<boolean>(false);
  const [isLoadingModel, setIsLoadingModel] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number }>({
    width: 640,
    height: 480,
  });

  const [currentLandmarks, setCurrentLandmarks] = useState<NormalizedLandmark[] | null>(null);
  const [currentHandLandmarks, setCurrentHandLandmarks] = useState<NormalizedLandmark[][] | null>(null);

  const romTrackerRef = useRef<ROMTracker>(createROMTracker());
  const repStateRef = useRef<RepCounterState>(createRepCounterState(targetReps));

  const frameCountRef = useRef<number>(0);
  const lastFpsCheckRef = useRef<number>(performance.now());
  const currentFpsRef = useRef<number>(0);

  const initPoseLandmarker = useCallback(async () => {
    if (poseLandmarkerRef.current) return poseLandmarkerRef.current;

    try {
      setIsLoadingModel(true);
      setErrorMessage(null);

      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      const landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "/models/pose_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      });

      poseLandmarkerRef.current = landmarker;

      // Also init HandLandmarker (best-effort, non-blocking)
      try {
        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
        });
        handLandmarkerRef.current = handLandmarker;
      } catch (handErr) {
        console.warn("HandLandmarker init failed (fingers will not be shown):", handErr);
      }

      setIsLoadingModel(false);
      return landmarker;
    } catch (err: unknown) {
      console.error("Failed to load MediaPipe PoseLandmarker:", err);
      setIsLoadingModel(false);
      const msg = err instanceof Error ? err.message : "Failed to load MediaPipe model.";
      setErrorMessage(`${msg}. Verify public/models/pose_landmarker.task exists.`);
      return null;
    }
  }, []);

  const processFrame = useCallback(() => {
    const video = videoRef.current;
    const landmarker = poseLandmarkerRef.current;

    if (!video || !landmarker || video.paused || video.ended) {
      return;
    }

    const videoTime = video.currentTime;
    if (videoTime !== lastVideoTimeRef.current && video.readyState >= 2) {
      lastVideoTimeRef.current = videoTime;

      // Hand landmark detection (best-effort, additive)
      if (handLandmarkerRef.current) {
        try {
          const handResults = handLandmarkerRef.current.detectForVideo(video, performance.now());
          setCurrentHandLandmarks(
            handResults.landmarks && handResults.landmarks.length > 0
              ? handResults.landmarks
              : null
          );
        } catch {
          // Silently ignore hand detection errors
        }
      }

      if (
        videoDimensions.width !== video.videoWidth ||
        videoDimensions.height !== video.videoHeight
      ) {
        setVideoDimensions({
          width: video.videoWidth,
          height: video.videoHeight,
        });
      }

      const now = performance.now();
      const results = landmarker.detectForVideo(video, now);

      const landmarks =
        results.landmarks && results.landmarks.length > 0
          ? results.landmarks[0]
          : null;

      setCurrentLandmarks(landmarks);

      const confidence = checkPoseConfidence(landmarks, bodySegment);

      let jointAngle = 0;
      let repJustCompleted = false;

      if (confidence.status === "READY" && landmarks) {
        const side = confidence.activeSide;

        if (exerciseId === "neck-rotation") {
          // For neck rotation, compute lateral offset as the "primary angle"
          const nose = getLandmark(landmarks, PoseLandmark.NOSE);
          const leftShoulder = getLandmark(landmarks, PoseLandmark.LEFT_SHOULDER);
          const rightShoulder = getLandmark(landmarks, PoseLandmark.RIGHT_SHOULDER);
          jointAngle = computeNeckLateralOffset(nose, leftShoulder, rightShoulder);
        } else {
          let p1Idx: PoseLandmark;
          let p2Idx: PoseLandmark;
          let p3Idx: PoseLandmark;

          if (bodySegment === "upper") {
            p1Idx = side === "right" ? PoseLandmark.RIGHT_SHOULDER : PoseLandmark.LEFT_SHOULDER;
            p2Idx = side === "right" ? PoseLandmark.RIGHT_ELBOW : PoseLandmark.LEFT_ELBOW;
            p3Idx = side === "right" ? PoseLandmark.RIGHT_WRIST : PoseLandmark.LEFT_WRIST;
          } else {
            p1Idx = side === "right" ? PoseLandmark.RIGHT_HIP : PoseLandmark.LEFT_HIP;
            p2Idx = side === "right" ? PoseLandmark.RIGHT_KNEE : PoseLandmark.LEFT_KNEE;
            p3Idx = side === "right" ? PoseLandmark.RIGHT_ANKLE : PoseLandmark.LEFT_ANKLE;
          }

          const p1 = getLandmark(landmarks, p1Idx);
          const p2 = getLandmark(landmarks, p2Idx);
          const p3 = getLandmark(landmarks, p3Idx);

          jointAngle = calculateAngle(p1, p2, p3);
        }

        romTrackerRef.current = updateROM(romTrackerRef.current, jointAngle);

        const repResult = processRepFrame(repStateRef.current, jointAngle, now, exerciseId);
        repStateRef.current = repResult.newState;
        repJustCompleted = repResult.repJustCompleted;
      }

      frameCountRef.current++;
      const elapsed = now - lastFpsCheckRef.current;
      if (elapsed >= 500) {
        currentFpsRef.current = Math.round((frameCountRef.current * 1000) / elapsed);
        frameCountRef.current = 0;
        lastFpsCheckRef.current = now;
      }

      const feedback = generateFeedback(
        confidence,
        repStateRef.current.movementState,
        jointAngle,
        repJustCompleted,
        repStateRef.current.completedReps,
        targetReps,
        exerciseId
      );

      if (onFrameUpdate) {
        onFrameUpdate({
          landmarks,
          confidence,
          jointAngle,
          romTracker: romTrackerRef.current,
          repState: repStateRef.current,
          feedback,
          fps: currentFpsRef.current,
        });
      }
    }

    animationFrameIdRef.current = requestAnimationFrame(processFrame);
  }, [videoDimensions, onFrameUpdate, targetReps, exerciseId, bodySegment]);

  const stopCamera = useCallback(() => {
    if (animationFrameIdRef.current !== null) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsActive(false);
    setCurrentLandmarks(null);
    setCurrentHandLandmarks(null);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setErrorMessage(null);

      const landmarker = await initPoseLandmarker();
      if (!landmarker) return;

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: false,
      });

      streamRef.current = mediaStream;

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsActive(true);
          animationFrameIdRef.current = requestAnimationFrame(processFrame);
        };
      }
    } catch (err: unknown) {
      console.error("Error launching camera:", err);
      stopCamera();
      const msg = err instanceof Error ? err.message : "Camera permission denied or camera unaccessible.";
      setErrorMessage(`Camera Permission Error: ${msg}`);
    }
  }, [initPoseLandmarker, processFrame, stopCamera]);

  useEffect(() => {
    if (autoStart) {
      startCamera();
    }
    return () => {
      stopCamera();
      if (poseLandmarkerRef.current) {
        poseLandmarkerRef.current.close();
        poseLandmarkerRef.current = null;
      }
      if (handLandmarkerRef.current) {
        handLandmarkerRef.current.close();
        handLandmarkerRef.current = null;
      }
    };
  }, [autoStart, startCamera, stopCamera]);

  return (
    <CameraView
      videoRef={videoRef}
      landmarks={currentLandmarks}
      handLandmarks={currentHandLandmarks}
      isActive={isActive}
      isLoading={isLoadingModel}
      videoDimensions={videoDimensions}
      errorMessage={errorMessage}
      onRetryCamera={startCamera}
      forceFullScreen={forceFullScreen}
      incorrectLandmarkIndices={incorrectLandmarkIndices}
      lowConfidenceLandmarkIndices={lowConfidenceLandmarkIndices}
    >
      {children}
    </CameraView>
  );
}
