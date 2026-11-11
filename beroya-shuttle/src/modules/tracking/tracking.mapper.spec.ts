import { StopType, TripStopStatus } from '../../generated/prisma/client';
import { mapLiveStops, mapLiveTrip } from './tracking.mapper';

function stop(partial: {
  id: string;
  sequence: number;
  arrivedAt?: Date | null;
  status?: TripStopStatus;
}) {
  return {
    id: partial.id,
    tripId: 'trip-1',
    routeStopId: null,
    sequence: partial.sequence,
    stopType: StopType.MEETING_POINT,
    label: `Stop ${partial.sequence}`,
    latitude: 33.5,
    longitude: 36.3,
    status: partial.status ?? TripStopStatus.PENDING,
    plannedArrivalAt: null,
    etaAt: null,
    arrivedAt: partial.arrivedAt ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('tracking.mapper live stops', () => {
  it('returns stops sorted by sequence with timeline fields', () => {
    const mapped = mapLiveStops([
      stop({ id: 'b', sequence: 2 }),
      stop({
        id: 'a',
        sequence: 1,
        status: TripStopStatus.ARRIVED,
        arrivedAt: new Date('2026-10-07T07:00:00.000Z'),
      }),
    ]);
    expect(mapped.map((row) => row.id)).toEqual(['a', 'b']);
    expect(mapped[0]).toMatchObject({
      id: 'a',
      sequence: 1,
      stopType: StopType.MEETING_POINT,
      status: TripStopStatus.ARRIVED,
      latitude: 33.5,
      longitude: 36.3,
    });
    expect(mapped[0].arrivedAt?.toISOString()).toBe('2026-10-07T07:00:00.000Z');
  });

  it('exposes stops and advances nextStop past arrived stops', () => {
    const trip = {
      id: 'trip-1',
      institutionId: 'inst-1',
      branchId: 'branch-1',
      routeId: 'route-1',
      status: 'IN_PROGRESS',
      direction: 'OUTBOUND',
      delayMinutes: 0,
      delayDetectedAt: null,
      etaToNextStopAt: null,
      etaToFinishAt: null,
      lastLocationLat: null,
      lastLocationLng: null,
      lastLocationAt: null,
      route: { id: 'route-1', name: 'Line A' },
      stops: [
        stop({
          id: 's1',
          sequence: 1,
          status: TripStopStatus.ARRIVED,
          arrivedAt: new Date('2026-10-07T07:00:00.000Z'),
        }),
        stop({ id: 's2', sequence: 2 }),
      ],
    } as unknown as Parameters<typeof mapLiveTrip>[0]['trip'];

    const live = mapLiveTrip({ trip, location: null, gpsStale: false });
    expect(live.stops).toHaveLength(2);
    expect(live.stops[0].status).toBe(TripStopStatus.ARRIVED);
    expect(live.nextStop?.id).toBe('s2');
  });
});
