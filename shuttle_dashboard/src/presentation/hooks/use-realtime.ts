"use client";

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  connectRealtime,
  type RealtimeEvent,
  type RealtimeStatus,
} from "@/infrastructure/realtime/socket";

/** Keeps one socket open for the given rooms and routes events to the query cache. */
export function useRealtime(
  rooms: string[],
  apply: (client: QueryClient, event: RealtimeEvent) => void,
  onEvent?: (event: RealtimeEvent) => void,
) {
  const client = useQueryClient();
  const [status, setStatus] = useState<RealtimeStatus>("disconnected");
  const applyRef = useRef(apply);
  const onEventRef = useRef(onEvent);
  const roomsKey = rooms.join("|");

  useEffect(() => {
    applyRef.current = apply;
    onEventRef.current = onEvent;
  });

  useEffect(() => {
    if (!roomsKey) return;
    return connectRealtime({
      rooms: roomsKey.split("|"),
      onStatus: setStatus,
      onEvent: (event) => {
        applyRef.current(client, event);
        onEventRef.current?.(event);
      },
    });
  }, [client, roomsKey]);

  return status;
}
