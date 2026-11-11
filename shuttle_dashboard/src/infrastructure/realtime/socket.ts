import { io, type Socket } from "socket.io-client";
import { env } from "@/infrastructure/config/env";
import { keysToCamel } from "@/infrastructure/http/case";
import { refreshAccessToken } from "@/infrastructure/http/client";
import { readSession } from "@/shared/lib/session";

export const REALTIME_EVENTS = [
  "trip.started",
  "trip.completed",
  "trip.cancelled",
  "trip.location.updated",
  "trip.delay.detected",
  "trip.driver.changed",
  "trip.vehicle.changed",
  "trip.attendant.changed",
  "trip.student.status.changed",
  "trip.breakdown.created",
  "trip.emergency.created",
  "incident.resolved",
  "trip.tracking.stale",
] as const;

export type RealtimeEventName = (typeof REALTIME_EVENTS)[number];

export type RealtimeEvent = {
  event: RealtimeEventName;
  tripId?: string;
  institutionId?: string;
  routeId?: string;
  latitude?: number;
  longitude?: number;
  recordedAt?: string;
  delayMinutes?: number;
  [key: string]: unknown;
};

export type RealtimeStatus = "connecting" | "connected" | "disconnected" | "unauthorized";

type ConnectOptions = {
  rooms: string[];
  onEvent: (event: RealtimeEvent) => void;
  onStatus?: (status: RealtimeStatus) => void;
  onUnauthorized?: () => void;
};

type SubscribeAck = { ok: boolean; room?: string; code?: string };

/** Opens one socket on the `/realtime` namespace and joins the given rooms. Returns a disposer. */
export function connectRealtime({ rooms, onEvent, onStatus, onUnauthorized }: ConnectOptions) {
  if (!readSession()?.accessToken) return () => {};

  let disposed = false;
  const forbiddenRooms = new Set<string>();

  const socket: Socket = io(`${env.socketUrl.replace(/\/$/, "")}/realtime`, {
    auth: (cb) => cb({ token: readSession()?.accessToken ?? "" }),
    extraHeaders: {
      "Accept-Language": typeof document !== "undefined" && document.documentElement.lang.startsWith("en") ? "en" : "ar",
      "X-Locale": typeof document !== "undefined" && document.documentElement.lang.startsWith("en") ? "en" : "ar",
    },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1500,
    reconnectionDelayMax: 10000,
  });

  onStatus?.("connecting");

  socket.on("connect", () => {
    onStatus?.("connected");
    for (const room of rooms) {
      if (forbiddenRooms.has(room)) continue;
      socket.emit("subscribe", { room }, (ack: SubscribeAck) => {
        if (!ack?.ok && ack?.code === "ROOM_FORBIDDEN") forbiddenRooms.add(room);
      });
    }
  });

  socket.on("disconnect", () => {
    if (!disposed) onStatus?.("disconnected");
  });

  socket.on("error", async (payload: { code?: string } | undefined) => {
    if (payload?.code !== "UNAUTHORIZED" || disposed) return;
    const token = await refreshAccessToken().catch(() => null);
    if (disposed) return;
    if (token) {
      socket.connect();
    } else {
      onStatus?.("unauthorized");
      onUnauthorized?.();
    }
  });

  for (const name of REALTIME_EVENTS) {
    socket.on(name, (payload: unknown) => {
      onEvent({ ...keysToCamel<Record<string, unknown>>(payload ?? {}), event: name });
    });
  }

  return () => {
    disposed = true;
    for (const room of rooms) {
      if (socket.connected) socket.emit("unsubscribe", { room });
    }
    socket.removeAllListeners();
    socket.disconnect();
  };
}
