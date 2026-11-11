import type { QueryClient } from "@tanstack/react-query";
import type { LiveTrip } from "@/domain/models/entities";
import { qk } from "@/infrastructure/api/query-keys";
import type { RealtimeEvent } from "@/infrastructure/realtime/socket";

function patchLiveTrips(
  client: QueryClient,
  tripId: string,
  patch: <T extends LiveTrip>(trip: T) => T,
  queryKey: readonly unknown[] = qk.institution.liveMap,
) {
  client.setQueriesData<LiveTrip[]>({ queryKey }, (current) =>
    current?.map((trip) => (trip.id === tripId ? patch(trip) : trip)),
  );
}

function withLocation<T extends LiveTrip>(trip: T, event: RealtimeEvent): T {
  return {
    ...trip,
    gpsStale: false,
    location: {
      speedKph: trip.location?.speedKph ?? null,
      heading: trip.location?.heading ?? null,
      accuracy: trip.location?.accuracy ?? null,
      latitude: event.latitude!,
      longitude: event.longitude!,
      recordedAt: event.recordedAt ?? new Date().toISOString(),
    },
  };
}

/** Institution panel: maps socket events to React Query cache updates (no polling). */
export function applyInstitutionEvent(client: QueryClient, event: RealtimeEvent) {
  const tripId = event.tripId;
  const inst = qk.institution;

  switch (event.event) {
    case "trip.location.updated": {
      if (!tripId || event.latitude == null || event.longitude == null) return;
      patchLiveTrips(client, tripId, (trip) => withLocation(trip, event));
      return;
    }
    case "trip.tracking.stale": {
      if (tripId) patchLiveTrips(client, tripId, (trip) => ({ ...trip, gpsStale: true }));
      client.invalidateQueries({ queryKey: inst.attention });
      return;
    }
    case "trip.started":
    case "trip.completed":
    case "trip.cancelled":
      client.invalidateQueries({ queryKey: inst.trips });
      client.invalidateQueries({ queryKey: inst.liveMap });
      client.invalidateQueries({ queryKey: inst.dashboard });
      return;
    case "trip.delay.detected":
      if (tripId) {
        patchLiveTrips(client, tripId, (trip) => ({
          ...trip,
          delayed: true,
          delayMinutes: event.delayMinutes ?? trip.delayMinutes,
        }));
      }
      client.invalidateQueries({ queryKey: inst.trips });
      client.invalidateQueries({ queryKey: inst.attention });
      client.invalidateQueries({ queryKey: inst.dashboard });
      return;
    case "trip.driver.changed":
    case "trip.vehicle.changed":
    case "trip.attendant.changed":
      if (tripId) client.invalidateQueries({ queryKey: inst.trip(tripId) });
      client.invalidateQueries({ queryKey: inst.tripList() });
      return;
    case "trip.student.status.changed":
      if (tripId) {
        client.invalidateQueries({ queryKey: inst.tripPart(tripId, "students") });
        client.invalidateQueries({ queryKey: inst.tripPart(tripId, "summary") });
        client.invalidateQueries({ queryKey: inst.tripPart(tripId, "events") });
      }
      return;
    case "trip.breakdown.created":
    case "trip.emergency.created":
      client.invalidateQueries({ queryKey: inst.incidents });
      client.invalidateQueries({ queryKey: inst.attention });
      client.invalidateQueries({ queryKey: inst.dashboard });
      return;
    case "incident.resolved":
      client.invalidateQueries({ queryKey: inst.incidents });
      client.invalidateQueries({ queryKey: inst.attention });
      client.invalidateQueries({ queryKey: inst.dashboard });
      return;
  }
}

/** Beroya panel: only BEROYA_OPERATED trip events reach `admin:beroya`. */
export function applyAdminEvent(client: QueryClient, event: RealtimeEvent) {
  const tripId = event.tripId;
  if (event.event === "trip.location.updated") {
    if (!tripId || event.latitude == null || event.longitude == null) return;
    patchLiveTrips(client, tripId, (trip) => withLocation(trip, event), qk.admin.opsLiveMap);
    return;
  }
  if (event.event === "trip.tracking.stale") {
    if (tripId) patchLiveTrips(client, tripId, (trip) => ({ ...trip, gpsStale: true }), qk.admin.opsLiveMap);
    return;
  }
  client.invalidateQueries({ queryKey: qk.admin.operations });
  client.invalidateQueries({ queryKey: qk.admin.dashboardPart("operations") });
  client.invalidateQueries({ queryKey: qk.admin.dashboardPart("summary") });
}
