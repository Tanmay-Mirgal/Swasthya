/**
 * Obtains user media stream (audio + video) with graceful fallback:
 * 1. Try video + audio
 * 2. Try video only
 * 3. Try audio only
 * 4. Animated canvas fallback so WebRTC/video elements always receive active frames
 */
export async function getMediaStreamWithFallback(): Promise<MediaStream | null> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices) {
    return null;
  }

  // 1. Try both camera and microphone
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: true,
    });
    return stream;
  } catch (err) {
    console.warn("[WebRTC] Video+Audio failed, trying video only:", err);
  }

  // 2. Try camera only (if mic is blocked or unavailable)
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    return stream;
  } catch (err) {
    console.warn("[WebRTC] Video only failed, trying audio only:", err);
  }

  // 3. Try microphone only (if camera is blocked or unavailable)
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: true,
    });
    return stream;
  } catch (err) {
    console.warn("[WebRTC] Audio only failed, falling back to simulated stream:", err);
  }

  // 4. Simulated animated canvas fallback
  if (typeof document === "undefined") return null;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");

    let frame = 0;
    const draw = () => {
      if (!ctx) return;
      frame++;
      // Dark gradient background
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, 640, 480);

      // Animated glowing pulse circle
      const radius = 40 + Math.sin(frame * 0.1) * 8;
      ctx.beginPath();
      ctx.arc(320, 220, radius, 0, Math.PI * 2);
      ctx.fillStyle = "#10b981";
      ctx.fill();

      // Text
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Camera Preview (Fallback)", 320, 290);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "14px sans-serif";
      ctx.fillText("Allow camera permissions in browser settings", 320, 320);
    };

    draw();
    const interval = setInterval(draw, 100);

    if (
      typeof (canvas as HTMLCanvasElement & { captureStream?: (fps: number) => MediaStream })
        .captureStream === "function"
    ) {
      const stream = (
        canvas as HTMLCanvasElement & { captureStream: (fps: number) => MediaStream }
      ).captureStream(30);

      // Clean up interval when track ends
      const track = stream.getVideoTracks()[0];
      if (track) {
        track.addEventListener("ended", () => clearInterval(interval));
      }
      return stream;
    }
  } catch (err) {
    console.warn("[WebRTC] Canvas fallback error:", err);
  }

  return null;
}
