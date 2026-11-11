import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { pathDistance } from '../../infra/routing/haversine';
import { TripStatus, TripStudentStatus } from '../../generated/prisma/client';
import {
  assertCanMarkAttendantBoarded,
  assertServiceDateRange,
  assertTripCanComplete,
  assertTripCanStart,
  assertTripHasAttendant,
  assertTripInProgress,
  canApplyStudentStatus,
  distanceKmFromPings,
  resolveWeekRange,
  parentBoardingNotice,
  studentEventType,
  studentStatusCountsWire,
  tallyStudentStatusCounts,
  tripDisplayCode,
  tripDurationMinutes,
} from './crew.rules';

describe('crew.rules', () => {
  it('allows a second start as a no-op for an in-progress trip', () => {
    expect(() => assertTripCanStart(TripStatus.IN_PROGRESS)).not.toThrow();
    expect(() => assertTripCanStart(TripStatus.SCHEDULED)).not.toThrow();
  });

  it('rejects starting a finished or cancelled trip', () => {
    try {
      assertTripCanStart(TripStatus.COMPLETED);
      fail('expected TRIP_ALREADY_COMPLETED');
    } catch (error) {
      expect((error as AppException).getStatus()).toBe(HttpStatus.CONFLICT);
    }
    expect(() => assertTripCanStart(TripStatus.CANCELLED)).toThrow(
      AppException,
    );
  });

  it('allows complete only after start, and treats a second complete as a no-op', () => {
    expect(() => assertTripCanComplete(TripStatus.COMPLETED)).not.toThrow();
    expect(() => assertTripCanComplete(TripStatus.IN_PROGRESS)).not.toThrow();
    expect(() => assertTripCanComplete(TripStatus.SCHEDULED)).toThrow(
      AppException,
    );
    expect(() => assertTripCanComplete(TripStatus.CANCELLED)).toThrow(
      AppException,
    );
  });

  it('requires in-progress for boarding actions', () => {
    expect(() => assertTripInProgress(TripStatus.IN_PROGRESS)).not.toThrow();
    expect(() => assertTripInProgress(TripStatus.SCHEDULED)).toThrow(
      AppException,
    );
  });

  it('allows attendant boarding only on scheduled or in-progress trips', () => {
    expect(() =>
      assertCanMarkAttendantBoarded(TripStatus.SCHEDULED),
    ).not.toThrow();
    expect(() =>
      assertCanMarkAttendantBoarded(TripStatus.IN_PROGRESS),
    ).not.toThrow();
    expect(() => assertCanMarkAttendantBoarded(TripStatus.COMPLETED)).toThrow(
      AppException,
    );
    expect(() => assertCanMarkAttendantBoarded(TripStatus.CANCELLED)).toThrow(
      AppException,
    );
  });

  it('requires an assigned attendant before boarding confirmation', () => {
    expect(() => assertTripHasAttendant('att-1')).not.toThrow();
    try {
      assertTripHasAttendant(null);
      fail('expected ATTENDANT_NOT_ASSIGNED');
    } catch (error) {
      expect((error as AppException).getResponse()).toMatchObject({
        code: 'ATTENDANT_NOT_ASSIGNED',
      });
      expect((error as AppException).getStatus()).toBe(HttpStatus.CONFLICT);
    }
  });

  it('allows board / not-boarded from pending, and correction not-boarded → boarded', () => {
    expect(
      canApplyStudentStatus(
        TripStudentStatus.PENDING,
        TripStudentStatus.PENDING,
      ),
    ).toBe(true);
    expect(
      canApplyStudentStatus(
        TripStudentStatus.PENDING,
        TripStudentStatus.BOARDED,
      ),
    ).toBe(true);
    expect(
      canApplyStudentStatus(
        TripStudentStatus.PENDING,
        TripStudentStatus.NOT_BOARDED,
      ),
    ).toBe(true);
    expect(
      canApplyStudentStatus(
        TripStudentStatus.NOT_BOARDED,
        TripStudentStatus.BOARDED,
      ),
    ).toBe(true);
    expect(
      canApplyStudentStatus(
        TripStudentStatus.BOARDED,
        TripStudentStatus.DROPPED_OFF,
      ),
    ).toBe(true);
    expect(
      canApplyStudentStatus(
        TripStudentStatus.BOARDED,
        TripStudentStatus.NOT_BOARDED,
      ),
    ).toBe(false);
    expect(
      canApplyStudentStatus(
        TripStudentStatus.DROPPED_OFF,
        TripStudentStatus.BOARDED,
      ),
    ).toBe(false);
  });

  it('tallies student status counts for crew APIs and wire payloads', () => {
    const counts = tallyStudentStatusCounts([
      { status: TripStudentStatus.PENDING, _count: { _all: 4 } },
      { status: TripStudentStatus.BOARDED, _count: { _all: 6 } },
      { status: TripStudentStatus.NOT_BOARDED, _count: { _all: 1 } },
      { status: TripStudentStatus.ABSENT, _count: { _all: 1 } },
    ]);
    expect(counts).toEqual({
      pending: 4,
      boarded: 6,
      notBoarded: 1,
      absent: 1,
      droppedOff: 0,
    });
    expect(studentStatusCountsWire(counts)).toEqual({
      pending: 4,
      boarded: 6,
      not_boarded: 1,
      absent: 1,
      dropped_off: 0,
    });
  });

  it('maps student status to a timeline event', () => {
    expect(studentEventType(TripStudentStatus.BOARDED)).toBe('STUDENT_BOARDED');
    expect(studentEventType(TripStudentStatus.NOT_BOARDED)).toBe(
      'STUDENT_NOT_BOARDED',
    );
    expect(studentEventType(TripStudentStatus.ABSENT)).toBe('STUDENT_ABSENT');
    expect(studentEventType(TripStudentStatus.DROPPED_OFF)).toBe(
      'STUDENT_DROPPED_OFF',
    );
  });

  it('builds bilingual parent notices for boarding actions', () => {
    expect(parentBoardingNotice(TripStudentStatus.BOARDED, 'عمر')).toEqual({
      type: 'STUDENT_BOARDED',
      titleAr: 'صعد الطالب',
      bodyAr: 'عمر صعد إلى الحافلة.',
      titleEn: 'Student boarded',
      bodyEn: 'عمر boarded the bus.',
    });
    expect(parentBoardingNotice(TripStudentStatus.NOT_BOARDED, 'عمر')?.type).toBe(
      'STUDENT_NOT_BOARDED',
    );
    expect(parentBoardingNotice(TripStudentStatus.DROPPED_OFF, 'عمر')?.type).toBe(
      'STUDENT_DROPPED_OFF',
    );
    expect(parentBoardingNotice(TripStudentStatus.ABSENT, 'عمر')).toBeNull();
  });

  it('rejects inverted service-date ranges and invalid dates', () => {
    expect(() => assertServiceDateRange('2026-10-04', '2026-10-01')).toThrow(
      AppException,
    );
    try {
      assertServiceDateRange('2026-10-04', '2026-10-01');
    } catch (error) {
      expect((error as AppException).getResponse()).toMatchObject({
        code: 'INVALID_DATE_RANGE',
      });
    }
    try {
      assertServiceDateRange('not-a-date', '2026-10-01');
    } catch (error) {
      expect((error as AppException).getResponse()).toMatchObject({
        code: 'INVALID_DATE',
      });
    }
  });

  it('resolves Sunday–Saturday weeks in the institution timezone', () => {
    // 2026-10-04 is a Sunday in Asia/Damascus
    const sunday = resolveWeekRange(
      'Asia/Damascus',
      undefined,
      new Date('2026-10-04T12:00:00.000Z'),
    );
    expect(sunday.weekStartKey).toBe('2026-10-04');
    expect(sunday.weekEndKey).toBe('2026-10-10');

    // Wednesday → previous Sunday
    const midweek = resolveWeekRange(
      'Asia/Damascus',
      undefined,
      new Date('2026-10-07T12:00:00.000Z'),
    );
    expect(midweek.weekStartKey).toBe('2026-10-04');
    expect(midweek.weekEndKey).toBe('2026-10-10');

    const explicit = resolveWeekRange('Asia/Damascus', '2026-09-28');
    expect(explicit.weekStartKey).toBe('2026-09-28');
    expect(explicit.weekEndKey).toBe('2026-10-04');
  });

  it('builds display codes and duration / distance helpers', () => {
    expect(tripDisplayCode('abcd-efgh-ijkl', 'R-12')).toBe('R-12');
    expect(tripDisplayCode('abcd-efgh-ijkl', null)).toBe('TR-ABCD');
    expect(
      tripDurationMinutes(
        new Date('2026-10-03T14:02:00.000Z'),
        new Date('2026-10-03T15:05:00.000Z'),
      ),
    ).toBe(63);
    expect(tripDurationMinutes(null, new Date())).toBeNull();
    expect(distanceKmFromPings([], pathDistance)).toBeNull();
    expect(
      distanceKmFromPings(
        [
          { latitude: 33.51, longitude: 36.29 },
          { latitude: 33.52, longitude: 36.3 },
        ],
        pathDistance,
      ),
    ).toBeGreaterThan(0);
  });
});
