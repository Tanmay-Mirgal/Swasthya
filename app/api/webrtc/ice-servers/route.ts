/**
 * GET /api/webrtc/ice-servers
 *
 * ICE servers for a call. STUN is always included. When TURN is configured in the environment it
 * is included too, so calls work across symmetric NATs and mobile networks (STUN alone cannot).
 * Authenticated: TURN credentials are never in the client bundle and never given to signed-out
 * visitors.
 *
 *   TURN_URLS         comma-separated, e.g. "turn:turn.example.com:3478,turns:turn.example.com:5349"
 *   TURN_USERNAME     static username, or ignored when TURN_SECRET is set
 *   TURN_CREDENTIAL   static credential
 *   TURN_SECRET       (optional) coturn "use-auth-secret": short-lived credentials are minted per request
 */

import { createHmac } from "crypto";
import { NextResponse } from "next/server";
import { getIdentityFromRequest } from "@/lib/realtime/auth/verifier";

export const dynamic = "force-dynamic";

const STUN = { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] };
const TURN_TTL_SECONDS = 60 * 60 * 2;

export async function GET(req: Request) {
  const identity = await getIdentityFromRequest(req);
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }> = [STUN];
  const urls = (process.env.TURN_URLS || "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);

  if (urls.length > 0) {
    const secret = process.env.TURN_SECRET;
    if (secret) {
      // coturn REST-style credentials: username = expiry:user, credential = base64(HMAC-SHA1(secret, username)).
      const username = `${Math.floor(Date.now() / 1000) + TURN_TTL_SECONDS}:${identity.userId}`;
      iceServers.push({ urls, username, credential: createHmac("sha1", secret).update(username).digest("base64") });
    } else if (process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
      iceServers.push({ urls, username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL });
    }
  }

  return NextResponse.json({ iceServers, turn: iceServers.length > 1 }, { headers: { "Cache-Control": "no-store" } });
}
