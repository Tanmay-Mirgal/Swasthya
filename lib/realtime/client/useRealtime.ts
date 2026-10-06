/**
 * lib/realtime/client/useRealtime.ts
 *
 * Connects the shared RealtimeClient using the signed-in Clerk user and exposes
 * connection status. Mount once near the top of any realtime page (safe to call
 * from several components: the client is a singleton).
 */

"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useAuth } from "@clerk/react";
import { ConnectionStatus, getRealtimeClient, RealtimeClient } from "./realtimeClient";

export interface UseRealtimeResult {
  client: RealtimeClient;
  status: ConnectionStatus;
  isConnected: boolean;
}

const serverStatus = (): ConnectionStatus => "disconnected";

export function useRealtime(): UseRealtimeResult {
  const { getToken, isSignedIn } = useAuth();
  const client = getRealtimeClient();
  const getTokenRef = useRef(getToken);

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  useEffect(() => {
    if (!isSignedIn) return;
    client.setTokenProvider(async () => {
      try {
        return await getTokenRef.current();
      } catch {
        return null;
      }
    });
    void client.connect();
  }, [client, isSignedIn]);

  const status = useSyncExternalStore(client.subscribeStatus, client.getStatus, serverStatus);
  return { client, status, isConnected: status === "connected" };
}
