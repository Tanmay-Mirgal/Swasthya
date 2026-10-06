/**
 * lib/realtime/index.ts
 *
 * Browser-safe export hub (protocol + client). Server-only modules live in
 * `lib/realtime/server` and `lib/realtime/auth` and must be imported explicitly.
 */

export * from "./protocol";
export * from "./client";
