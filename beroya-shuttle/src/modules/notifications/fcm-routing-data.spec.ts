import { buildFcmRoutingData } from './fcm-routing-data';

describe('buildFcmRoutingData', () => {
  it('includes type and tripId for TRIP_STARTED', () => {
    expect(
      buildFcmRoutingData(
        'n1',
        'SYSTEM',
        'ROUTE_DRIVERS',
        'ar',
        { type: 'TRIP_STARTED', tripId: 'trip-1' },
      ),
    ).toEqual({
      notificationId: 'n1',
      origin: 'SYSTEM',
      audience: 'ROUTE_DRIVERS',
      locale: 'ar',
      type: 'TRIP_STARTED',
      tripId: 'trip-1',
    });
  });

  it('includes routeId and tripId for ROUTE_CHANGE', () => {
    expect(
      buildFcmRoutingData(
        'n2',
        'SYSTEM',
        'ROUTE_ATTENDANTS',
        'en',
        { type: 'ROUTE_CHANGE', tripId: 'trip-2', routeId: 'route-2' },
      ),
    ).toEqual({
      notificationId: 'n2',
      origin: 'SYSTEM',
      audience: 'ROUTE_ATTENDANTS',
      locale: 'en',
      type: 'ROUTE_CHANGE',
      tripId: 'trip-2',
      routeId: 'route-2',
    });
  });

  it('falls back to notification.routeId and normalizes snake_case', () => {
    expect(
      buildFcmRoutingData(
        'n3',
        'SYSTEM',
        'ROUTE_PARENTS',
        'ar',
        {
          type: 'STUDENT_ABSENT',
          trip_id: 'trip-3',
          trip_student_id: 'ts-3',
          student_id: 'st-3',
        },
        'route-fallback',
      ),
    ).toEqual({
      notificationId: 'n3',
      origin: 'SYSTEM',
      audience: 'ROUTE_PARENTS',
      locale: 'ar',
      type: 'STUDENT_ABSENT',
      tripId: 'trip-3',
      routeId: 'route-fallback',
      tripStudentId: 'ts-3',
      studentId: 'st-3',
    });
  });

  it('does not dump i18n or other large fields', () => {
    const payload = buildFcmRoutingData(
      'n4',
      'SYSTEM',
      'ROUTE_DRIVERS',
      'ar',
      {
        type: 'TRIP_ASSIGNED',
        tripId: 'trip-4',
        titleAr: 'عنوان طويل جداً '.repeat(50),
        bodyEn: 'long body '.repeat(50),
        i18n: { titleAr: 'x', bodyAr: 'y' },
      },
    );
    expect(Object.keys(payload).sort()).toEqual([
      'audience',
      'locale',
      'notificationId',
      'origin',
      'tripId',
      'type',
    ]);
    expect(JSON.stringify(payload).length).toBeLessThan(4096);
  });

  it('stringifies all values', () => {
    const payload = buildFcmRoutingData(
      'n5',
      'SYSTEM',
      'ROUTE_DRIVERS',
      'ar',
      { type: 'TRIP_STARTED', tripId: 'trip-5' },
    );
    for (const value of Object.values(payload)) {
      expect(typeof value).toBe('string');
    }
  });
});
