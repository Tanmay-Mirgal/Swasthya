"use client";

import { useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import LiveStage, { type StageMode } from "@/components/exercise/stage/LiveStage";
import { drawOverlay } from "@/components/movement/overlay";
import { LEAD_MS, MIXED_PLAN, STUCK_PLAN, kneeExtensionSession, repPlanSession, replayUntil } from "@/lib/movement/testing/scenarios";
import { PoseLandmark as L } from "@/lib/movement/landmarks";
import DistanceReport from "./DistanceReport";

const PERIOD = 4000;

export type StageScenario = "ok" | "good" | "notcounted" | "stuck" | "cantsee" | "lowconf" | "paused" | "rest" | "countdown" | "ready" | "ready-wait";

/**
 * The real stage, the real engine, the real overlay and the real lane layout, driven by a synthetic person (no camera).
 * `?vs=1.5` sets the reading-distance scale; `?report=1` adds the distance check. It proves the layout and the drawing,
 * not how well a real camera tracks a real body.
 */
export default function StageScreen({ scenario }: { scenario: StageScenario }) {
  const q = useSearchParams();
  const vs = Number(q.get("vs")) || 1.25;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const replay = useMemo(() => {
    switch (scenario) {
      case "good":
        return replayUntil("seated-knee-extension", repPlanSession(MIXED_PLAN), LEAD_MS + 8_400, 8);
      case "notcounted":
        return replayUntil("seated-knee-extension", repPlanSession(MIXED_PLAN), LEAD_MS + 12_400, 8);
      case "stuck":
        return replayUntil("seated-knee-extension", repPlanSession(STUCK_PLAN), LEAD_MS + 4 * PERIOD + 3000, 8);
      case "cantsee":
      case "lowconf":
        return replayUntil("seated-knee-extension", kneeExtensionSession({ vis: (t) => (t > LEAD_MS + 2 * PERIOD ? { [L.LEFT_KNEE]: 0.15 } : undefined) }), LEAD_MS + 2 * PERIOD + 2200, 8);
      case "ready":
      case "ready-wait":
        return replayUntil("seated-knee-extension", kneeExtensionSession(), 900, 8);
      default:
        return replayUntil("seated-knee-extension", kneeExtensionSession(), LEAD_MS + 2 * PERIOD + 1500, 8);
    }
  }, [scenario]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.width = 1280;
    canvas.height = 720;
    ctx.fillStyle = "#0f1311";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#1a201d";
    ctx.fillRect(0, 700, canvas.width, 20);
    drawOverlay(ctx, replay.engine.result, canvas.width, canvas.height);
  }, [replay]);

  const mode: StageMode = scenario === "paused" ? "paused" : scenario === "rest" ? "rest" : scenario === "countdown" ? "countdown" : scenario.startsWith("ready") ? "ready" : "active";
  const noop = () => undefined;
  return (
    <>
      <LiveStage
        mode={mode}
        ui={replay.ui}
        videoRef={videoRef}
        canvasRef={canvasRef}
        error={null}
        onRetry={noop}
        viewScale={vs}
        title="Seated Knee Extension"
        subtitle="Set 1 of 3"
        tag="Last one today"
        onBack={noop}
        goodInSet={replay.ui.counted}
        setTarget={8}
        setLabel="Set 1 of 3"
        cameraReady={scenario === "ready"}
        placementHint="Side view, about 1.5 to 2.5 m away, so the whole leg is in frame."
        onReady={noop}
        count={3}
        onNotYet={noop}
        onResume={noop}
        onStop={noop}
        setsDone={1}
        totalSets={3}
        nextSetReps={8}
        restSeconds={42}
        onStartNext={noop}
        onOpenGuide={noop}
        onFinishEarly={noop}
      />
      {q.get("report") === "1" && <DistanceReport />}
    </>
  );
}
