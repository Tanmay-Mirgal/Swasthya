/**
 * app/api/ws/route.ts
 *
 * Production WebSocket entrypoint on Vercel (no separate socket server).
 * Upgrades the request with @vercel/functions' experimental_upgradeWebSocket and hands
 * the socket to the shared RealtimeServer. Locally, `server.ts` performs the upgrade
 * for the same path, so this handler only runs for non-upgrade/failed requests there.
 *
 * Cross-instance delivery does not rely on this process: see lib/realtime/server/bus.ts.
 */

import { experimental_upgradeWebSocket } from "@vercel/functions";
import { RealtimeServer } from "@/lib/realtime/server/realtimeServer";

export const dynamic = "force-dynamic";
// Long-lived socket; the client reconnects and resyncs when the platform recycles it.
export const maxDuration = 300;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || undefined;

  try {
    return await experimental_upgradeWebSocket((ws) => {
      RealtimeServer.getInstance().registerClient(ws as unknown as import("ws").WebSocket, token);
    });
  } catch (err) {
    console.error("[Realtime Gateway] WebSocket upgrade failed:", err instanceof Error ? err.message : err);
    // 426 = "Upgrade Required": clients must treat this as a failed connection, never as healthy.
    return new Response(JSON.stringify({ error: "WebSocket upgrade is not available for this request." }), {
      status: 426,
      headers: { "Content-Type": "application/json", Upgrade: "websocket" },
    });
  }
}
