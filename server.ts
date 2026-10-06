/**
 * server.ts
 *
 * Unified Next.js + Realtime Server for RehabLens.
 *
 * Runs the complete application (Next.js App Router, SSR, API routes, and WebSockets)
 * as a single unified process on port 3000 with ONE command (`npm run dev`).
 *
 * In production on Vercel:
 *   Connections to /api/ws are upgraded by @vercel/functions experimental_upgradeWebSocket
 *   in app/api/ws/route.ts.
 *
 * In local development:
 *   Connections to /api/ws are upgraded directly by the unified HTTP server below.
 *   Media remains strictly peer-to-peer via WebRTC.
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import http from "node:http";
import next from "next";
import { WebSocketServer } from "ws";
import { RealtimeServer } from "./lib/realtime/server/realtimeServer";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function startServer() {
  await app.prepare();
  // Only available once Next has been prepared.
  const handleNextUpgrade = app.getUpgradeHandler();

  const server = http.createServer((req, res) => {
    try {
      handle(req, res);
    } catch (err) {
      console.error("[Unified Server] Request handling error:", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    try {
      const host = req.headers.host || `localhost:${port}`;
      const url = new URL(req.url || "/", `http://${host}`);
      const pathname = url.pathname;

      if (pathname === "/api/ws" || pathname === "/api/ws/") {
        console.log(`[Unified Server] ⚡ WebSocket upgrade accepted on ${pathname}`);
        wss.handleUpgrade(req, socket, head, (ws) => {
          const token = url.searchParams.get("token") || undefined;
          RealtimeServer.getInstance().registerClient(ws, token);
        });
        return;
      }
      // Everything else (Next.js dev HMR and the like) belongs to Next.js.
      void handleNextUpgrade(req, socket, head);
    } catch (err) {
      console.error("[Unified Server] Upgrade error:", err);
      socket.destroy();
    }
  });

  server.listen(port, () => {
    console.log(`\n=========================================================`);
    console.log(`  🚀 RehabLens Unified Server is ready!`);
    console.log(`  🌐 Application:  http://${hostname}:${port}`);
    console.log(`  ⚡ Realtime WS:  ws://${hostname}:${port}/api/ws`);
    console.log(`  🔒 Auth Model:   Clerk JWT + MongoDB role resolution`);
    console.log(`  📦 Architecture: Single process, zero separate socket servers`);
    console.log(`=========================================================\n`);
  });
}

startServer().catch((err) => {
  console.error("[Unified Server] Fatal initialization error:", err);
  process.exit(1);
});
