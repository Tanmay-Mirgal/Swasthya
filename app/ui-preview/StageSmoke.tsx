"use client";

import FocusFrame from "@/components/exercise/FocusFrame";
import LivePanel from "@/components/exercise/LivePanel";
import MovementStage from "@/components/movement/MovementStage";
import { useMovementSession } from "@/hooks/useMovementSession";
import { getMovementTemplate } from "@/lib/movement/template/registry";

const template = getMovementTemplate("seated-knee-extension")!;

/**
 * Mounts the REAL live hook (MediaPipe model load, camera request, frame loop) with no
 * sign-in, so the loading and camera-blocked states and the model/wasm download can be seen
 * in a browser that has no camera. With a camera it runs the full live experience.
 */
export default function StageSmoke() {
  const session = useMovementSession({ template, targetReps: 5, voiceEnabled: false, llmEnabled: false });
  return (
    <FocusFrame
      title={template.name}
      subtitle="Live hook check"
      backLabel="End"
      camera={<MovementStage videoRef={session.videoRef} canvasRef={session.canvasRef} ui={session.ui} error={session.error} onRetry={() => void session.start()} />}
      panel={<LivePanel ui={session.ui} paused={false} voiceEnabled={false} onToggleVoice={() => undefined} onTogglePause={() => undefined} onFinish={() => undefined} onOpenGuide={() => undefined} />}
    />
  );
}
