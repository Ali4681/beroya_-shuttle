import {
  TripDirection,
  TripStatus,
  TripStudentStatus,
} from '../../generated/prisma/client';
import {
  crewStudentGradeLabel,
  mapCrewLastLocation,
  mapCrewStudent,
  mapCrewTrip,
} from './crew.mapper';

function tripFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'trip-1',
    institutionId: 'inst-1',
    branchId: 'branch-1',
    routeId: 'route-1',
    scheduleId: null,
    direction: TripDirection.OUTBOUND,
    status: TripStatus.COMPLETED,
    serviceDate: new Date('2026-10-03T00:00:00.000Z'),
    scheduledDepartureTime: '07:00',
    originLabel: null,
    originLat: 0,
    originLng: 0,
    driverId: 'driver-1',
    vehicleId: null,
    attendantId: 'attendant-1',
    attendantBoarded: false,
    attendantBoardedAt: null,
    attendantBoardedByUserId: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    cancelReason: null,
    distanceKm: null,
    delayThresholdMinutes: 10,
    delayMinutes: 0,
    delayDetectedAt: null,
    delayAlertSentAt: null,
    lastLocationLat: null,
    lastLocationLng: null,
    lastLocationAt: null,
    etaToNextStopAt: null,
    etaToFinishAt: null,
    createdAt: new Date('2026-10-03T00:00:00.000Z'),
    updatedAt: new Date('2026-10-03T00:00:00.000Z'),
    ...overrides,
  } as never;
}

describe('mapCrewTrip', () => {
  it('sets hasEmergency true when emergency incidents exist', () => {
    const mapped = mapCrewTrip(
      tripFixture({
        incidents: [{ id: 'em-1' }],
        driver: {
          id: 'driver-1',
          user: { id: 'u-driver', fullName: 'محمد علي' },
        },
        _count: { stops: 4, students: 14 },
      }),
    );

    expect(mapped.hasEmergency).toBe(true);
    expect(mapped.driver).toEqual({ id: 'driver-1', name: 'محمد علي' });
    expect(mapped.studentCount).toBe(14);
    expect(mapped.studentCounts).toEqual({
      pending: 0,
      boarded: 0,
      notBoarded: 0,
      absent: 0,
      droppedOff: 0,
    });
    expect(mapped.attendantBoarded).toBe(false);
    expect(mapped.attendantBoardedAt).toBeNull();
    expect(mapped.lastLocation).toBeNull();
  });

  it('embeds student status counts and last_location when provided', () => {
    const lastLocation = {
      latitude: 33.5102,
      longitude: 36.2913,
      heading: 120,
      speedKph: 32,
      recordedAt: '2026-10-12T04:30:00.000Z',
      isStale: false,
    };
    const mapped = mapCrewTrip(
      tripFixture({ _count: { students: 12 } }),
      {
        pending: 4,
        boarded: 6,
        notBoarded: 1,
        absent: 1,
        droppedOff: 0,
      },
      lastLocation,
    );
    expect(mapped.studentCount).toBe(12);
    expect(mapped.studentCounts).toEqual({
      pending: 4,
      boarded: 6,
      notBoarded: 1,
      absent: 1,
      droppedOff: 0,
    });
    expect(mapped.lastLocation).toEqual(lastLocation);
  });

  it('exposes attendant boarded flags from the trip', () => {
    const boardedAt = new Date('2026-10-10T08:15:00.000Z');
    const mapped = mapCrewTrip(
      tripFixture({
        attendantBoarded: true,
        attendantBoardedAt: boardedAt,
      }),
    );
    expect(mapped.attendantBoarded).toBe(true);
    expect(mapped.attendantBoardedAt).toBe(boardedAt);
  });

  it('sets hasEmergency false when no emergency incidents', () => {
    expect(mapCrewTrip(tripFixture({ incidents: [] })).hasEmergency).toBe(
      false,
    );
    expect(mapCrewTrip(tripFixture()).hasEmergency).toBe(false);
  });
});

describe('mapCrewLastLocation', () => {
  const now = new Date('2026-10-12T04:32:00.000Z');

  it('prefers Redis live location over trip columns', () => {
    expect(
      mapCrewLastLocation({
        live: {
          tripId: 'trip-1',
          latitude: 33.51,
          longitude: 36.29,
          heading: 90,
          speedKph: 20,
          recordedAt: '2026-10-12T04:31:00.000Z',
        },
        trip: {
          lastLocationLat: 33.0,
          lastLocationLng: 36.0,
          lastLocationAt: new Date('2026-10-12T04:00:00.000Z'),
        },
        staleAfterSeconds: 180,
        now,
      }),
    ).toEqual({
      latitude: 33.51,
      longitude: 36.29,
      heading: 90,
      speedKph: 20,
      recordedAt: '2026-10-12T04:31:00.000Z',
      isStale: false,
    });
  });

  it('falls back to trip.lastLocation* when live cache is empty', () => {
    expect(
      mapCrewLastLocation({
        live: null,
        trip: {
          lastLocationLat: 33.5102,
          lastLocationLng: 36.2913,
          lastLocationAt: new Date('2026-10-12T04:30:00.000Z'),
        },
        staleAfterSeconds: 180,
        now,
      }),
    ).toEqual({
      latitude: 33.5102,
      longitude: 36.2913,
      heading: null,
      speedKph: null,
      recordedAt: '2026-10-12T04:30:00.000Z',
      isStale: false,
    });
  });

  it('returns null when no location exists', () => {
    expect(
      mapCrewLastLocation({
        live: null,
        trip: {
          lastLocationLat: null,
          lastLocationLng: null,
          lastLocationAt: null,
        },
        staleAfterSeconds: 120,
        now,
      }),
    ).toBeNull();
  });

  it('marks is_stale when older than gpsStaleAfterSeconds', () => {
    expect(
      mapCrewLastLocation({
        live: null,
        trip: {
          lastLocationLat: 33.5,
          lastLocationLng: 36.2,
          lastLocationAt: new Date('2026-10-12T04:20:00.000Z'),
        },
        staleAfterSeconds: 180,
        now,
      })?.isStale,
    ).toBe(true);
  });
});

describe('mapCrewStudent grade', () => {
  it('exposes grade, section, and grade_label for the attendant list', () => {
    const mapped = mapCrewStudent({
      id: 'ts-1',
      tripId: 'trip-1',
      studentId: 'stu-1',
      tripStopId: 'stop-1',
      status: TripStudentStatus.ABSENT,
      isException: false,
      boardedAt: null,
      droppedOffAt: null,
      notBoardedAt: new Date('2026-10-10T08:00:00.000Z'),
      markedByUserId: null,
      correctedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      student: {
        id: 'stu-1',
        fullName: 'جود الحسن',
        grade: 'الصف الرابع',
        section: 'أ',
      },
      tripStop: {
        id: 'stop-1',
        sequence: 1,
        label: 'محطة المزّة',
        stopType: 'MEETING_POINT',
      },
    } as never);

    expect(mapped.student).toEqual({
      id: 'stu-1',
      fullName: 'جود الحسن',
      grade: 'الصف الرابع',
      section: 'أ',
      gradeLabel: 'الصف الرابع — أ',
    });
  });

  it('builds grade_label from grade only when section is missing', () => {
    expect(crewStudentGradeLabel('الصف الرابع', null)).toBe('الصف الرابع');
    expect(crewStudentGradeLabel(null, null)).toBeNull();
  });
});
