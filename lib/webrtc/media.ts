/**
 * lib/webrtc/media.ts
 *
 * Obtains user media stream (audio + video) with graceful fallback:
 * 1. Try video + audio
 * 2. Try video only (if microphone hardware is absent or unavailable)
 * 3. Try audio only (if camera hardware is absent or unavailable)
 * 4. Animated canvas + silent audio track fallback if permissions are blocked or hardware absent
 */

/**
 * Creates an animated simulated MediaStream with active video and silent audio tracks.
 * Used when camera/microphone permissions are denied or unavailable.
 */
function createSimulatedStream(): MediaStream | null {
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

      // Dark slate background
      ctx.fillStyle = "#0b0f19";
      ctx.fillRect(0, 0, 640, 480);

      // Subtle grid
      ctx.strokeStyle = "#172033";
      ctx.lineWidth = 1;
      for (let x = 0; x < 640; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 480);
        ctx.stroke();
      }
      for (let y = 0; y < 480; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(640, y);
        ctx.stroke();
      }

      // Animated glowing pulse circle
      const radius = 44 + Math.sin(frame * 0.1) * 6;
      ctx.beginPath();
      ctx.arc(320, 210, radius, 0, Math.PI * 2);
      ctx.fillStyle = "#10b981";
      ctx.shadowColor = "#10b981";
      ctx.shadowBlur = 18;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Draw avatar silhouette inside circle
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(320, 196, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(320, 238, 22, Math.PI, 0);
      ctx.fill();

      // Text rendered in mirrored coordinate space
      // Local preview video elements use `scale-x-[-1]`, so mirroring the context
      // ensures the rendered text is legible and not backwards.
      ctx.save();
      ctx.translate(640, 0);
      ctx.scale(-1, 1);

      ctx.fillStyle = "#ffffff";
      ctx.font = "600 17px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Simulated Camera Feed", 320, 305);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("Allow camera in browser settings (🔒) to enable video", 320, 332);
      ctx.restore();
    };

    draw();
    const interval = setInterval(draw, 66); // ~15 FPS for lightweight rendering

    if (
      typeof (canvas as HTMLCanvasElement & { captureStream?: (fps: number) => MediaStream })
        .captureStream === "function"
    ) {
      const stream = (
        canvas as HTMLCanvasElement & { captureStream: (fps: number) => MediaStream }
      ).captureStream(15);

      // Add a silent audio track so WebRTC offer/answer SDP contains audio m-lines
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          gain.gain.value = 0; // silent
          osc.connect(gain);
          const dest = audioCtx.createMediaStreamDestination();
          gain.connect(dest);
          osc.start();
          const audioTrack = dest.stream.getAudioTracks()[0];
          if (audioTrack) {
            stream.addTrack(audioTrack);
          }
        }
      } catch {
        // Web Audio fallback optional
      }

      // Mark as fallback stream
      (stream as unknown as { isFallback: boolean }).isFallback = true;

      // Clean up interval when track ends
      const track = stream.getVideoTracks()[0];
      if (track) {
        track.addEventListener("ended", () => clearInterval(interval));
      }
      return stream;
    }
  } catch (err) {
    console.info("[WebRTC] Canvas fallback error:", err);
  }

  return null;
}

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
  } catch (err: unknown) {
    const error = err as { name?: string; message?: string };
    // If the browser or user explicitly denied permissions, avoid repeated failing calls
    if (error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError") {
      console.info("[WebRTC] Camera and microphone permissions not granted by browser. Using simulated fallback.");
      return createSimulatedStream();
    }
    console.info("[WebRTC] Video+Audio acquisition failed, checking video-only:", error?.message || error);
  }

  // 2. Try camera only (if mic is absent or hardware unavailable)
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    return stream;
  } catch (err: unknown) {
    const error = err as { name?: string };
    if (error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError") {
      return createSimulatedStream();
    }
    console.info("[WebRTC] Video-only acquisition failed, checking audio-only:", err);
  }

  // 3. Try microphone only (if camera is absent or hardware unavailable)
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: true,
    });
    return stream;
  } catch {
    // Microphone only also failed
  }

  // 4. Simulated animated canvas fallback
  return createSimulatedStream();
}
