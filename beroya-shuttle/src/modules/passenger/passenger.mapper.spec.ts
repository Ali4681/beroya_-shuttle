import {
  StopType,
  TripDirection,
  TripStatus,
} from '../../generated/prisma/client';
import {
  mapUniversityMe,
  mapUniversityTripCard,
  matchesUniversityCrowdFilter,
  matchesUniversityEtaFilter,
  nearestStopDistanceMeters,
  universityCrowdBand,
  universityDestinationLabel,
  universityDurationMinutes,
  universityEtaMinutes,
} from './passenger.mapper';

describe('university passenger mappers', () => {
  const institution = {
    id: 'inst-1',
    name: 'tishreen',
    displayName: 'جامعة تشرين',
    city: 'اللاذقية',
    address: 'اللاذقية - شارع الجمهورية',
  };

  it('mapUniversityMe exposes account fields for Flutter', () => {
    const payload = mapUniversityMe(
      {
        id: 'u1',
        fullName: 'طالب',
        phone: '+963900000000',
        role: 'UNIVERSITY_STUDENT',
        status: 'ACTIVE',
        institutionId: institution.id,
        branchId: 'b1',
      } as never,
      {
        id: 'p1',
        studentNumber: 'S1',
        faculty: 'Engineering',
        branchId: 'b1',
        status: 'ACTIVE',
      } as never,
      {
        supportPhone: '+963115566771',
      } as never,
      institution,
    );

    expect(payload.user).toMatchObject({
      fullName: 'طالب',
      photoUrl: null,
    });
    expect(payload.profile).toMatchObject({
      studentNumber: 'S1',
      faculty: 'Engineering',
    });
    expect(payload.institution).toEqual({
      id: 'inst-1',
      name: 'tishreen',
      displayName: 'جامعة تشرين',
      city: 'اللاذقية',
      address: 'اللاذقية - شارع الجمهورية',
      supportPhone: '+963115566771',
    });
    expect(payload.branding).toMatchObject({
      supportPhone: '+963115566771',
    });
  });

  it('derives destination_label by direction and stops', () => {
    const stops = [
      {
        sequence: 1,
        label: 'السكن الجامعي',
        stopType: StopType.MEETING_POINT,
      },
      {
        sequence: 2,
        label: 'جامعة تشرين',
        stopType: StopType.INSTITUTION,
      },
    ];

    expect(
      universityDestinationLabel(
        { direction: TripDirection.OUTBOUND, originLabel: 'السكن الجامعي', stops },
        'جامعة تشرين',
      ),
    ).toBe('جامعة تشرين');

    expect(
      universityDestinationLabel(
        { direction: TripDirection.INBOUND, originLabel: 'جامعة تشرين', stops },
        'جامعة تشرين',
      ),
    ).toBe('السكن الجامعي');
  });

  it('mapUniversityTripCard includes home-card fields for Flutter', () => {
    const card = mapUniversityTripCard({
      trip: {
        id: 'trip_123',
        institutionId: 'inst-1',
        branchId: 'b1',
        routeId: 'route_1',
        status: TripStatus.IN_PROGRESS,
        direction: TripDirection.OUTBOUND,
        delayMinutes: 0,
        delayDetectedAt: null,
        etaToNextStopAt: null,
        etaToFinishAt: new Date('2026-10-08T09:20:00.000Z'),
        startedAt: new Date('2026-10-08T08:30:00.000Z'),
        completedAt: null,
        serviceDate: new Date('2026-10-08T00:00:00.000Z'),
        lastLocationLat: 36.2021,
        lastLocationLng: 37.1343,
        lastLocationAt: new Date('2026-10-08T08:40:00.000Z'),
        scheduledDepartureTime: '08:30',
        originLabel: 'السكن الجامعي',
        route: { id: 'route_1', name: 'خط السكن الجامعي' },
        stops: [
          {
            id: 'stop_1',
            tripId: 'trip_123',
            sequence: 1,
            label: 'السكن الجامعي',
            stopType: StopType.MEETING_POINT,
            status: 'ARRIVED',
            latitude: 36.2,
            longitude: 37.13,
            etaAt: null,
            arrivedAt: new Date('2026-10-08T08:30:00.000Z'),
            plannedArrivalAt: new Date('2026-10-08T08:30:00.000Z'),
          },
          {
            id: 'stop_2',
            tripId: 'trip_123',
            sequence: 2,
            label: 'جامعة تشرين',
            stopType: StopType.INSTITUTION,
            status: 'PENDING',
            latitude: 36.21,
            longitude: 37.14,
            etaAt: new Date('2026-10-08T08:50:00.000Z'),
            arrivedAt: null,
            plannedArrivalAt: new Date('2026-10-08T09:00:00.000Z'),
          },
        ],
      } as never,
      location: null,
      gpsStale: false,
      institutionName: 'جامعة تشرين',
      boardedCount: 12,
      supportPhone: '+963911111111',
      vehicle: {
        id: 'v1',
        plateNumber: '12345',
        vehicleType: 'باص متوسط',
        capacity: 40,
      },
      attendant: {
        id: 'att-1',
        fullName: 'مشرفة',
        phone: '+963922222222',
      },
    });

    expect(card).toMatchObject({
      id: 'trip_123',
      status: TripStatus.IN_PROGRESS,
      direction: TripDirection.OUTBOUND,
      scheduledDepartureTime: '08:30',
      originLabel: 'السكن الجامعي',
      destinationLabel: 'جامعة تشرين',
      institutionName: 'جامعة تشرين',
      boardedCount: 12,
      capacity: 40,
      durationMinutes: 50,
      estimatedDurationMinutes: 50,
      supportPhone: '+963911111111',
      route: { id: 'route_1', name: 'خط السكن الجامعي' },
      vehicle: {
        label: 'باص متوسط',
        type: 'باص متوسط',
        plate: '12345',
        capacity: 40,
      },
      attendant: {
        id: 'att-1',
        name: 'مشرفة',
        phone: '+963922222222',
      },
      nextStop: {
        id: 'stop_2',
        label: 'جامعة تشرين',
        etaAt: new Date('2026-10-08T08:50:00.000Z'),
      },
      location: {
        latitude: 36.2021,
        longitude: 37.1343,
      },
    });
    expect(typeof card.etaMinutes === 'number' || card.etaMinutes === null).toBe(
      true,
    );
    expect(card.stops[0]).toMatchObject({
      id: 'stop_1',
      sequence: 1,
      label: 'السكن الجامعي',
      latitude: 36.2,
      longitude: 37.13,
      status: 'ARRIVED',
    });
    expect(card.stops[1]).toMatchObject({
      status: 'PENDING',
      etaAt: new Date('2026-10-08T08:50:00.000Z'),
    });
  });

  it('fills next_stop.label when stop label is empty', () => {
    const card = mapUniversityTripCard({
      trip: {
        id: 'trip_2',
        institutionId: 'inst-1',
        branchId: 'b1',
        routeId: 'route_1',
        status: TripStatus.IN_PROGRESS,
        direction: TripDirection.OUTBOUND,
        delayMinutes: 0,
        delayDetectedAt: null,
        etaToNextStopAt: new Date('2026-10-08T08:50:00.000Z'),
        etaToFinishAt: null,
        startedAt: new Date('2026-10-08T08:30:00.000Z'),
        completedAt: null,
        serviceDate: new Date('2026-10-08T00:00:00.000Z'),
        lastLocationLat: null,
        lastLocationLng: null,
        lastLocationAt: null,
        scheduledDepartureTime: '08:30',
        originLabel: 'A',
        route: { id: 'route_1', name: 'R' },
        stops: [
          {
            id: 'stop_1',
            tripId: 'trip_2',
            sequence: 1,
            label: null,
            stopType: StopType.MEETING_POINT,
            status: 'PENDING',
            latitude: 36.2,
            longitude: 37.13,
            etaAt: new Date('2026-10-08T08:50:00.000Z'),
            arrivedAt: null,
            plannedArrivalAt: null,
          },
        ],
      } as never,
      location: null,
      gpsStale: false,
      institutionName: 'جامعة تشرين',
      boardedCount: 0,
      vehicle: null,
      attendant: null,
    });

    expect(card.nextStop).toMatchObject({
      id: 'stop_1',
      label: 'Stop 1',
      etaAt: new Date('2026-10-08T08:50:00.000Z'),
    });
  });

  it('keeps vehicle label null when type missing (does not copy plate)', () => {
    const card = mapUniversityTripCard({
      trip: {
        id: 'trip_1',
        institutionId: 'inst-1',
        branchId: 'b1',
        routeId: 'route_1',
        status: TripStatus.SCHEDULED,
        direction: TripDirection.OUTBOUND,
        delayMinutes: 0,
        delayDetectedAt: null,
        etaToNextStopAt: null,
        etaToFinishAt: null,
        startedAt: null,
        completedAt: null,
        serviceDate: new Date('2026-10-08T00:00:00.000Z'),
        lastLocationLat: null,
        lastLocationLng: null,
        lastLocationAt: null,
        scheduledDepartureTime: '08:30',
        originLabel: 'A',
        route: { id: 'route_1', name: 'R' },
        stops: [],
      } as never,
      location: null,
      gpsStale: false,
      institutionName: 'جامعة تشرين',
      boardedCount: 0,
      vehicle: {
        id: 'v1',
        plateNumber: '12345',
        vehicleType: null,
        capacity: 40,
      },
    });

    expect(card.vehicle).toEqual({
      id: 'v1',
      label: null,
      type: null,
      plate: '12345',
      capacity: 40,
    });
  });

  it('universityEtaMinutes and nearestStopDistanceMeters support map filters', () => {
    expect(
      universityEtaMinutes(
        new Date('2026-10-08T09:00:00.000Z'),
        new Date('2026-10-08T08:48:00.000Z'),
      ),
    ).toBe(12);
    expect(universityEtaMinutes(null)).toBeNull();

    expect(
      nearestStopDistanceMeters(
        { lat: 36.2, lng: 37.13 },
        [
          { latitude: 36.2, longitude: 37.13 },
          { latitude: 36.3, longitude: 37.2 },
        ],
        () => 150,
      ),
    ).toBe(150);
  });

  it('server-side ETA and crowd filters match Flutter thresholds', () => {
    expect(
      matchesUniversityEtaFilter(12, { maxEtaMinutes: 10 }),
    ).toBe(false);
    expect(
      matchesUniversityEtaFilter(12, { maxEtaMinutes: 20 }),
    ).toBe(true);
    expect(
      matchesUniversityEtaFilter(25, { minEtaMinutes: 20 }),
    ).toBe(true);
    expect(matchesUniversityEtaFilter(null, { maxEtaMinutes: 10 })).toBe(
      false,
    );

    expect(universityCrowdBand(10, 40)).toBe('low');
    expect(universityCrowdBand(20, 40)).toBe('medium');
    expect(universityCrowdBand(30, 40)).toBe('high');
    expect(universityCrowdBand(0, null)).toBeNull();
    expect(matchesUniversityCrowdFilter(10, 40, 'low')).toBe(true);
    expect(matchesUniversityCrowdFilter(30, 40, 'low')).toBe(false);
  });

  it('universityDurationMinutes prefers started→etaToFinish then planned span', () => {
    expect(
      universityDurationMinutes({
        startedAt: new Date('2026-10-08T08:00:00.000Z'),
        completedAt: null,
        etaToFinishAt: new Date('2026-10-08T08:45:00.000Z'),
        serviceDate: new Date('2026-10-08T00:00:00.000Z'),
        scheduledDepartureTime: '08:00',
        stops: [],
      }),
    ).toBe(45);

    expect(
      universityDurationMinutes({
        startedAt: null,
        completedAt: null,
        etaToFinishAt: null,
        serviceDate: new Date('2026-10-08T00:00:00.000Z'),
        scheduledDepartureTime: '08:00',
        stops: [
          {
            sequence: 1,
            plannedArrivalAt: new Date('2026-10-08T08:00:00.000Z'),
            etaAt: null,
          },
          {
            sequence: 2,
            plannedArrivalAt: new Date('2026-10-08T08:30:00.000Z'),
            etaAt: null,
          },
        ],
      }),
    ).toBe(30);
  });
});
