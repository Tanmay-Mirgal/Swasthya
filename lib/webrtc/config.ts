/**
 * lib/webrtc/config.ts
 *
 * ICE servers and call timeouts. STUN alone cannot connect every pair of networks
 * (symmetric NAT, many mobile carriers), so production needs TURN. TURN credentials never
 * live in the client bundle: they are fetched from the authenticated /api/webrtc/ice-servers
 * route at the start of each call. If that fails, calls fall back to STUN only.
 */

export const STUN_ONLY_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }],
  iceCandidatePoolSize: 4,
};

/** Kept for existing imports. */
export const DEFAULT_RTC_CONFIG = STUN_ONLY_CONFIG;

export interface CallTimeouts {
  /** The caller gives up if nobody answers. */
  outgoingRingMs: number;
  /** An unanswered incoming ring stops showing. */
  incomingRingMs: number;
  /** Accepted, but media never connected. */
  connectMs: number;
  /** ICE "disconnected" is given this long to recover before the call is ended. */
  iceDisconnectGraceMs: number;
  /** The other participant vanished from the room mid-negotiation. */
  peerGoneGraceMs: number;
  /** How long the "call ended" notice stays before the state returns to idle. */
  endedBannerMs: number;
}

export const DEFAULT_CALL_TIMEOUTS: CallTimeouts = {
  outgoingRingMs: 45_000,
  incomingRingMs: 45_000,
  connectMs: 20_000,
  iceDisconnectGraceMs: 8_000,
  peerGoneGraceMs: 15_000,
  endedBannerMs: 6_000,
};

/** Fetches ICE servers (STUN + TURN when configured). Never throws. */
export async function fetchRtcConfig(getToken: () => Promise<string | null>): Promise<RTCConfiguration> {
  try {
    const token = await getToken();
    const res = await fetch("/api/webrtc/ice-servers", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });
    if (!res.ok) return STUN_ONLY_CONFIG;
    const json = (await res.json()) as { iceServers?: RTCIceServer[] };
    if (!Array.isArray(json.iceServers) || json.iceServers.length === 0) return STUN_ONLY_CONFIG;
    return { iceServers: json.iceServers, iceCandidatePoolSize: 4 };
  } catch {
    return STUN_ONLY_CONFIG;
  }
}
