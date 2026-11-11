import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import {
  assertCancelAllowed,
  assertOverrideAllowed,
  assertReassignAllowed,
  canGenerateRoute,
  parseServiceDate,
  studentMatchesDirection,
} from './trip.rules';

describe('trip.rules', () => {
  it('parses a service date or rejects junk', () => {
    expect(parseServiceDate('2026-10-03').toISOString()).toBe(
      '2026-10-03T00:00:00.000Z',
    );
    expect(() => parseServiceDate('03-10-2026')).toThrow(AppException);
  });

  it('keeps OUTBOUND_ONLY students off inbound trips', () => {
    expect(studentMatchesDirection('OUTBOUND_ONLY', 'OUTBOUND')).toBe(true);
    expect(studentMatchesDirection('OUTBOUND_ONLY', 'INBOUND')).toBe(false);
    expect(studentMatchesDirection('ROUND_TRIP', 'INBOUND')).toBe(true);
    expect(studentMatchesDirection('INBOUND_ONLY', 'INBOUND')).toBe(true);
    expect(studentMatchesDirection('INBOUND_ONLY', 'OUTBOUND')).toBe(false);
  });

  it('skips STOPPED_TODAY only for the local today', () => {
    const today = new Date('2026-10-03T00:00:00.000Z');
    expect(canGenerateRoute('STOPPED_TODAY', today, today)).toBe(false);
    expect(
      canGenerateRoute(
        'STOPPED_TODAY',
        new Date('2026-10-04T00:00:00.000Z'),
        today,
      ),
    ).toBe(true);
    expect(canGenerateRoute('SUSPENDED', today, today)).toBe(false);
    expect(canGenerateRoute('ACTIVE', today, today)).toBe(true);
  });

  it('allows reassign only while scheduled or in progress', () => {
    expect(() => assertReassignAllowed('SCHEDULED')).not.toThrow();
    expect(() => assertReassignAllowed('IN_PROGRESS')).not.toThrow();
    try {
      assertReassignAllowed('COMPLETED');
      fail('expected TRIP_NOT_REASSIGNABLE');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(HttpStatus.CONFLICT);
    }
  });

  it('allows override only while scheduled', () => {
    expect(() => assertOverrideAllowed('SCHEDULED')).not.toThrow();
    expect(() => assertOverrideAllowed('IN_PROGRESS')).toThrow(AppException);
  });

  it('rejects cancelling a completed trip', () => {
    try {
      assertCancelAllowed('COMPLETED');
      fail('expected TRIP_ALREADY_COMPLETED');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(HttpStatus.CONFLICT);
    }
    try {
      assertCancelAllowed('CANCELLED');
      fail('expected TRIP_ALREADY_CANCELLED');
    } catch (error) {
      expect((error as AppException).getResponse()).toMatchObject({
        code: 'TRIP_ALREADY_CANCELLED',
      });
    }
    expect(() => assertCancelAllowed('SCHEDULED')).not.toThrow();
  });
});
