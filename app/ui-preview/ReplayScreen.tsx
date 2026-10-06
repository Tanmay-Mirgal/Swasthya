"use client";

import { useEffect, useMemo, useRef } from "react";
import FocusFrame from "@/components/exercise/FocusFrame";
import LivePanel from "@/components/exercise/LivePanel";
import { drawOverlay } from "@/components/movement/overlay";
import { LEAD_MS, kneeExtensionSession, replayUntil } from "@/lib/movement/testing/scenarios";
import { PoseLandmark as L } from "@/lib/movement/landmarks";

export type ReplayScenario = "ok" | "error" | "lowconf" | "camera" | "setup" | "paused";

const PERIOD = 4000;

/**
 * Drives the REAL movement engine, coach and overlay with a synthetic person, with no camera.
 * It exists to look at the red / green / yellow states, the camera advice and the live panel
 * exactly as the engine would produce them. It proves the logic and the drawing, not how
 * well a real camera tracks a real body.
 */
export default function ReplayScreen({ scenario }: { scenario: ReplayScenario }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const replay = useMemo(() => {
    // Mid-way through the third repetition, unless the scenario needs something else.
    const mid = LEAD_MS + 2 * PERIOD + 1500;
    switch (scenario) {
      case "error": {
        const lean = (t: number) => (t > LEAD_MS + 2 * PERIOD + 600 ? 28 : 0);
        return replayUntil("seated-knee-extension", kneeExtensionSession({ lean }), LEAD_MS + 2 * PERIOD + 2400);
      }
      case "lowconf": {
        const vis = (t: number) => (t > LEAD_MS + 2 * PERIOD ? { [L.LEFT_KNEE]: 0.15 } : undefined);
        return replayUntil("seated-knee-extension", kneeExtensionSession({ vis }), LEAD_MS + 2 * PERIOD + 2200);
      }
      case "camera":
        return replayUntil("seated-knee-extension", kneeExtensionSession({ frame: { pxPerM: 700, cy: 400 } }), 2500);
      case "setup":
        return replayUntil("seated-knee-extension", kneeExtensionSession(), 900);
      default:
        return replayUntil("seated-knee-extension", kneeExtensionSession(), mid);
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

  return (
    <FocusFrame
      title="Seated Knee Extension"
      subtitle={`Replay: ${scenario} · ${replay.ui.counted} of ${replay.ui.targetReps} reps`}
      backLabel="End"
      camera={
        <div className="relative size-full min-h-[240px] overflow-hidden bg-[#0f1311]">
          <canvas ref={canvasRef} aria-label="Replayed skeleton, no camera" className="absolute inset-0 size-full object-cover" />
          {replay.ui.advice && scenario !== "paused" && (
            <div className="absolute inset-x-3 bottom-3 flex justify-center">
              <p role="status" className="max-w-md rounded-lg bg-[var(--paper)] px-4 py-2.5 text-center text-sm font-semibold text-slate-900 shadow-md">{replay.ui.advice.message}</p>
            </div>
          )}
        </div>
      }
      panel={
        <LivePanel
          ui={replay.ui}
          paused={scenario === "paused"}
          voiceEnabled
          onToggleVoice={() => undefined}
          onTogglePause={() => undefined}
          onFinish={() => undefined}
          onOpenGuide={() => undefined}
        />
      }
    />
  );
}
