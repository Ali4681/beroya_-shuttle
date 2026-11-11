import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import {
  assertCompleteStopOrder,
  assertDepartureTime,
  assertSchoolScheduleLimit,
  computeStopsOrderStale,
  inboundPickupOrder,
  institutionAnchor,
  normalizeDaysOfWeek,
  sequencesAreContiguous,
} from './route.rules';

describe('route.rules', () => {
  it('blocks a second school schedule on the same direction', () => {
    try {
      assertSchoolScheduleLimit('SCHOOL', 1);
      fail('expected SCHOOL_SCHEDULE_LIMIT');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(HttpStatus.CONFLICT);
      expect((error as AppException).getResponse()).toMatchObject({
        code: 'SCHOOL_SCHEDULE_LIMIT',
      });
    }
  });

  it('allows multiple university schedules', () => {
    expect(() => assertSchoolScheduleLimit('UNIVERSITY', 3)).not.toThrow();
  });

  it('marks stops stale when eta is missing after student assignment', () => {
    expect(
      computeStopsOrderStale([
        {
          stopType: 'STUDENT_HOME',
          etaOffsetMinutes: null,
          updatedAt: new Date('2026-01-01T10:00:00Z'),
          students: [{ pickupUpdatedAt: new Date('2026-01-01T09:00:00Z') }],
        },
        {
          stopType: 'INSTITUTION',
          etaOffsetMinutes: null,
          updatedAt: new Date('2026-01-01T10:00:00Z'),
          students: [],
        },
      ]),
    ).toBe(true);
  });

  it('clears stale after a saved order unless pickup changed later', () => {
    const savedAt = new Date('2026-01-01T12:00:00Z');
    expect(
      computeStopsOrderStale([
        {
          stopType: 'STUDENT_HOME',
          etaOffsetMinutes: 8,
          updatedAt: savedAt,
          students: [{ pickupUpdatedAt: new Date('2026-01-01T09:00:00Z') }],
        },
      ]),
    ).toBe(false);
    expect(
      computeStopsOrderStale([
        {
          stopType: 'STUDENT_HOME',
          etaOffsetMinutes: 8,
          updatedAt: savedAt,
          students: [{ pickupUpdatedAt: new Date('2026-01-01T13:00:00Z') }],
        },
      ]),
    ).toBe(true);
  });

  it('reverses outbound pickups for the default inbound order', () => {
    expect(inboundPickupOrder(['a', 'b', 'c'])).toEqual(['c', 'b', 'a']);
  });

  it('validates departure time and weekdays', () => {
    expect(assertDepartureTime('07:30')).toBe('07:30');
    expect(() => assertDepartureTime('25:00')).toThrow(AppException);
    expect(normalizeDaysOfWeek([3, 1, 1, 7])).toEqual([1, 3, 7]);
    expect(() => normalizeDaysOfWeek([])).toThrow(AppException);
    expect(() => normalizeDaysOfWeek([0])).toThrow(AppException);
  });

  it('requires a complete stop-order permutation', () => {
    expect(() => assertCompleteStopOrder(['a', 'b'], ['b', 'a'])).not.toThrow();
    expect(() => assertCompleteStopOrder(['a', 'b'], ['a'])).toThrow(
      AppException,
    );
    expect(sequencesAreContiguous([1, 2, 3])).toBe(true);
    expect(sequencesAreContiguous([1, 3])).toBe(false);
  });

  it('anchors institution first inbound and last outbound', () => {
    expect(institutionAnchor('OUTBOUND', 2)).toEqual({
      firstPickupSequence: 1,
      institutionSequence: 3,
    });
    expect(institutionAnchor('INBOUND', 2)).toEqual({
      institutionSequence: 1,
      firstPickupSequence: 2,
    });
    expect(computeStopsOrderStale([])).toBe(false);
  });
});
