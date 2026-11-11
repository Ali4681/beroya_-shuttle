import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import {
  assertLocationAllowed,
  delayMinutesFromEta,
  isGpsStale,
  shouldSendDelayAlert,
} from './tracking.rules';

describe('tracking.rules', () => {
  it('computes delay minutes from eta vs planned finish', () => {
    const planned = new Date('2026-10-03T07:40:00.000Z');
    const eta = new Date('2026-10-03T07:52:00.000Z');
    expect(delayMinutesFromEta(eta, planned)).toBe(12);
    expect(delayMinutesFromEta(planned, eta)).toBe(0);
    expect(delayMinutesFromEta(null, planned)).toBe(0);
  });

  it('alerts once when delay first exceeds the threshold', () => {
    expect(shouldSendDelayAlert(11, 10, false)).toBe(true);
    expect(shouldSendDelayAlert(11, 10, true)).toBe(false);
    expect(shouldSendDelayAlert(10, 10, false)).toBe(false);
    expect(shouldSendDelayAlert(40, 10, true)).toBe(false);
  });

  it('marks GPS stale after the configured gap', () => {
    const now = new Date('2026-10-03T08:00:00.000Z');
    expect(isGpsStale(new Date('2026-10-03T07:56:00.000Z'), 180, now)).toBe(
      true,
    );
    expect(isGpsStale(new Date('2026-10-03T07:58:00.000Z'), 180, now)).toBe(
      false,
    );
    expect(isGpsStale(null, 120, now)).toBe(true);
  });

  it('rejects location before the trip is in progress', () => {
    expect(() => assertLocationAllowed('IN_PROGRESS')).not.toThrow();
    try {
      assertLocationAllowed('SCHEDULED');
      fail('expected TRIP_NOT_STARTED');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(HttpStatus.CONFLICT);
    }
    expect(() => assertLocationAllowed('COMPLETED')).toThrow(AppException);
    expect(() => assertLocationAllowed('CANCELLED')).toThrow(AppException);
  });
});
