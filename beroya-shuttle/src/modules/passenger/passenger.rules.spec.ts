import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { TripStatus, TripStudentStatus } from '../../generated/prisma/client';
import { ARRIVAL_MINUTES } from '../notifications/arrival-alert.rules';
import {
  assertArrivalMinutes,
  assertParentAbsenceAllowed,
  assertParentReadOnly,
} from './passenger.rules';

describe('passenger.rules', () => {
  it('accepts the parent arrival windows', () => {
    for (const minutes of ARRIVAL_MINUTES) {
      expect(() => assertArrivalMinutes(minutes)).not.toThrow();
    }
  });

  it('rejects a window outside 5 / 10 / 15', () => {
    expect(() => assertArrivalMinutes(12)).toThrow();
  });

  it('blocks parent writes other than arrival preference', () => {
    try {
      assertParentReadOnly();
      fail('expected PARENT_READ_ONLY');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(HttpStatus.FORBIDDEN);
    }
  });

  it('allows parent absence on scheduled or in-progress pending students', () => {
    expect(() =>
      assertParentAbsenceAllowed(TripStatus.SCHEDULED, TripStudentStatus.PENDING),
    ).not.toThrow();
    expect(() =>
      assertParentAbsenceAllowed(
        TripStatus.IN_PROGRESS,
        TripStudentStatus.PENDING,
      ),
    ).not.toThrow();
    expect(() =>
      assertParentAbsenceAllowed(
        TripStatus.SCHEDULED,
        TripStudentStatus.ABSENT,
      ),
    ).not.toThrow();
    expect(() =>
      assertParentAbsenceAllowed(
        TripStatus.SCHEDULED,
        TripStudentStatus.NOT_BOARDED,
      ),
    ).toThrow(AppException);
  });

  it('rejects parent absence after board or when trip ended', () => {
    expect(() =>
      assertParentAbsenceAllowed(
        TripStatus.IN_PROGRESS,
        TripStudentStatus.BOARDED,
      ),
    ).toThrow(AppException);
    try {
      assertParentAbsenceAllowed(
        TripStatus.COMPLETED,
        TripStudentStatus.PENDING,
      );
      fail('expected TRIP_ALREADY_COMPLETED');
    } catch (error) {
      expect((error as AppException).getResponse()).toMatchObject({
        code: 'TRIP_ALREADY_COMPLETED',
      });
    }
    try {
      assertParentAbsenceAllowed(
        TripStatus.CANCELLED,
        TripStudentStatus.PENDING,
      );
      fail('expected TRIP_CANCELLED');
    } catch (error) {
      expect((error as AppException).getResponse()).toMatchObject({
        code: 'TRIP_CANCELLED',
      });
    }
  });
});
