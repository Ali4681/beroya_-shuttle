import { ShuttleRoute, ShuttleTrip, TripStop } from '../../generated/prisma/client';
import { LiveLocation } from './live-location.store';

export function mapLivePoint(location: LiveLocation | null) {
  if (!location) {
    return null;
  }
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    speedKph: location.speedKph ?? null,
    heading: location.heading ?? null,
    accuracy: location.accuracy ?? null,
    recordedAt: location.recordedAt,
  };
}

export function mapLiveStops(stops: TripStop[] | undefined) {
  return [...(stops ?? [])]
    .sort((a, b) => a.sequence - b.sequence)
    .map((stop) => ({
      id: stop.id,
      sequence: stop.sequence,
      label: stop.label,
      stopType: stop.stopType,
      status: stop.status,
      latitude: stop.latitude,
      longitude: stop.longitude,
      etaAt: stop.etaAt,
      arrivedAt: stop.arrivedAt,
    }));
}

export function mapLiveTrip(input: {
  trip: ShuttleTrip & {
    route?: Pick<ShuttleRoute, 'id' | 'name'> | null;
    stops?: TripStop[];
  };
  location: LiveLocation | null;
  gpsStale: boolean;
}) {
  const stops = mapLiveStops(input.trip.stops);
  const nextStop = stops.find((stop) => !stop.arrivedAt);
  return {
    id: input.trip.id,
    institutionId: input.trip.institutionId,
    branchId: input.trip.branchId,
    routeId: input.trip.routeId,
    status: input.trip.status,
    direction: input.trip.direction,
    delayMinutes: input.trip.delayMinutes,
    delayed: input.trip.delayMinutes > 0 || input.trip.delayDetectedAt != null,
    gpsStale: input.gpsStale,
    etaToNextStopAt: input.trip.etaToNextStopAt,
    etaToFinishAt: input.trip.etaToFinishAt,
    location:
      mapLivePoint(input.location) ??
      (input.trip.lastLocationLat != null && input.trip.lastLocationLng != null
        ? {
            latitude: input.trip.lastLocationLat,
            longitude: input.trip.lastLocationLng,
            speedKph: null,
            heading: null,
            accuracy: null,
            recordedAt: input.trip.lastLocationAt?.toISOString() ?? null,
          }
        : null),
    route: input.trip.route
      ? { id: input.trip.route.id, name: input.trip.route.name }
      : null,
    stops,
    nextStop: nextStop
      ? {
          id: nextStop.id,
          sequence: nextStop.sequence,
          label: nextStop.label,
          etaAt: nextStop.etaAt,
        }
      : null,
  };
}
