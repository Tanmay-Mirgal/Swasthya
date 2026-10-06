/**
 * lib/webrtc/callLog.ts
 *
 * Structured call logging, shared by server and browser:
 *
 *   [CALL abc123] CONNECTING
 *   [CALL abc123] ICE: checking
 *   [CALL abc123] END requested by therapist
 *
 * Development only: silent when NODE_ENV is "production". It records only call ids, states
 * and event names. Never pass SDP, ICE candidates, tokens or names to it.
 */

const enabled = () => typeof process === "undefined" || process.env.NODE_ENV !== "production";

/** Last lines, for the dev-only debug panel. */
const recent: string[] = [];
export const getRecentCallLog = (): readonly string[] => recent;

export function callLog(callId: string | null | undefined, message: string): void {
  if (!enabled()) return;
  const id = callId ? callId.slice(0, 6) : "------";
  const line = `[CALL ${id}] ${message}`;
  recent.push(`${new Date().toISOString().slice(11, 23)} ${line}`);
  if (recent.length > 80) recent.shift();
  console.log(line);
}
