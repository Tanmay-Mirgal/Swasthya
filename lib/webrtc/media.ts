/**
 * lib/webrtc/media.ts
 *
 * Camera and microphone for a call. Real devices only: if access is refused we say so,
 * we never substitute a fake picture. A blocked camera with a working microphone joins
 * audio-only, with a visible notice; a blocked microphone or no usable device is an error
 * with a message that tells the person what to do.
 */

export type MediaAccessResult =
  | { ok: true; stream: MediaStream; notice?: string }
  | { ok: false; kind: "unsupported" | "denied" | "no-device" | "in-use" | "unknown"; message: string };

const VIDEO = { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } as const;

type DomErr = { name?: string; message?: string };
const isDenied = (e: DomErr) => e?.name === "NotAllowedError" || e?.name === "PermissionDeniedError" || e?.name === "SecurityError";
const isMissing = (e: DomErr) => e?.name === "NotFoundError" || e?.name === "DevicesNotFoundError" || e?.name === "OverconstrainedError";
const isBusy = (e: DomErr) => e?.name === "NotReadableError" || e?.name === "TrackStartError" || e?.name === "AbortError";

export const MEDIA_MESSAGES = {
  unsupported: "Video calls aren't supported in this browser. Try a current version of Chrome, Edge, Safari or Firefox.",
  camera: "Camera access is required for video consultation. Allow it from the icon in your browser's address bar, then try again.",
  microphone: "Microphone access is blocked. Please enable it in your browser settings, then try again.",
  both: "Camera and microphone access are blocked. Allow them from the icon in your browser's address bar, then try again.",
  none: "No camera or microphone was found. Connect one and try again.",
  inUse: "Your camera or microphone is being used by another app. Close it and try again.",
  audioOnly: "Your camera is blocked, so you're joining with audio only.",
} as const;

export async function acquireMedia(): Promise<MediaAccessResult> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return { ok: false, kind: "unsupported", message: MEDIA_MESSAGES.unsupported };
  }
  const gum = (c: MediaStreamConstraints) => navigator.mediaDevices.getUserMedia(c);

  let first: DomErr = {};
  try {
    return { ok: true, stream: await gum({ video: VIDEO, audio: true }) };
  } catch (e) {
    first = e as DomErr;
  }

  // Camera refused or missing but the microphone may be fine: join with audio only, openly.
  if (isDenied(first) || isMissing(first) || isBusy(first)) {
    try {
      const audio = await gum({ video: false, audio: true });
      return { ok: true, stream: audio, notice: MEDIA_MESSAGES.audioOnly };
    } catch (e) {
      const second = e as DomErr;
      if (isDenied(first) && isDenied(second)) return { ok: false, kind: "denied", message: MEDIA_MESSAGES.both };
      if (isDenied(second)) return { ok: false, kind: "denied", message: MEDIA_MESSAGES.microphone };
      if (isBusy(first) || isBusy(second)) return { ok: false, kind: "in-use", message: MEDIA_MESSAGES.inUse };
      if (isMissing(second)) return { ok: false, kind: isDenied(first) ? "denied" : "no-device", message: isDenied(first) ? MEDIA_MESSAGES.camera : MEDIA_MESSAGES.none };
    }
  }
  return { ok: false, kind: "unknown", message: "We couldn't start your camera and microphone. Check them and try again." };
}
