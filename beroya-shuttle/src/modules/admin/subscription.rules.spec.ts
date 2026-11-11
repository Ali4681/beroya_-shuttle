import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import {
  assertCanCancel,
  assertCanExtend,
  assertExtendMovesForward,
  assertNoActiveOverlap,
  assertSubscriptionPending,
  assertValidSubscriptionWindow,
  rangesOverlap,
} from './subscription.rules';

describe('subscription.rules', () => {
  it('treats adjacent windows as non-overlapping', () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const mid = new Date('2026-02-01T00:00:00.000Z');
    const end = new Date('2026-03-01T00:00:00.000Z');
    expect(rangesOverlap(start, mid, mid, end)).toBe(false);
    expect(rangesOverlap(start, end, mid, end)).toBe(true);
  });

  it('rejects an invalid window', () => {
    try {
      assertValidSubscriptionWindow(
        new Date('2026-02-01T00:00:00.000Z'),
        new Date('2026-01-01T00:00:00.000Z'),
      );
      fail('expected SUBSCRIPTION_INVALID_WINDOW');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getResponse()).toMatchObject({
        code: 'SUBSCRIPTION_INVALID_WINDOW',
      });
    }
  });

  it('accepts a valid window and an ignored overlap id', () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const end = new Date('2026-02-01T00:00:00.000Z');
    expect(() => assertValidSubscriptionWindow(start, end)).not.toThrow();
    expect(() =>
      assertNoActiveOverlap(
        { startsAt: start, endsAt: end },
        [{ id: 'same', startsAt: start, endsAt: end }],
        'same',
      ),
    ).not.toThrow();
  });

  it('rejects overlapping active subscriptions', () => {
    try {
      assertNoActiveOverlap(
        {
          startsAt: new Date('2026-01-15T00:00:00.000Z'),
          endsAt: new Date('2026-02-15T00:00:00.000Z'),
        },
        [
          {
            id: 'existing',
            startsAt: new Date('2026-01-01T00:00:00.000Z'),
            endsAt: new Date('2026-02-01T00:00:00.000Z'),
          },
        ],
      );
      fail('expected SUBSCRIPTION_OVERLAP');
    } catch (error) {
      expect((error as AppException).getStatus()).toBe(HttpStatus.CONFLICT);
      expect((error as AppException).getResponse()).toMatchObject({
        code: 'SUBSCRIPTION_OVERLAP',
      });
    }
  });

  it('allows activate/update only while pending', () => {
    expect(() => assertSubscriptionPending('PENDING')).not.toThrow();
    try {
      assertSubscriptionPending('ACTIVE');
      fail('expected SUBSCRIPTION_NOT_PENDING');
    } catch (error) {
      expect((error as AppException).getResponse()).toMatchObject({
        code: 'SUBSCRIPTION_NOT_PENDING',
      });
    }
  });

  it('allows cancel for pending and active only', () => {
    expect(() => assertCanCancel('PENDING')).not.toThrow();
    expect(() => assertCanCancel('ACTIVE')).not.toThrow();
    try {
      assertCanCancel('EXPIRED');
      fail('expected SUBSCRIPTION_NOT_CANCELLABLE');
    } catch (error) {
      expect((error as AppException).getResponse()).toMatchObject({
        code: 'SUBSCRIPTION_NOT_CANCELLABLE',
      });
    }
  });

  it('requires extend to move ends_at forward on an active subscription', () => {
    expect(() => assertCanExtend('ACTIVE')).not.toThrow();
    try {
      assertCanExtend('PENDING');
      fail('expected SUBSCRIPTION_NOT_ACTIVE');
    } catch (error) {
      expect((error as AppException).getResponse()).toMatchObject({
        code: 'SUBSCRIPTION_NOT_ACTIVE',
      });
    }
    expect(() =>
      assertExtendMovesForward(
        new Date('2026-02-01T00:00:00.000Z'),
        new Date('2026-03-01T00:00:00.000Z'),
      ),
    ).not.toThrow();
    try {
      assertExtendMovesForward(
        new Date('2026-02-01T00:00:00.000Z'),
        new Date('2026-02-01T00:00:00.000Z'),
      );
      fail('expected SUBSCRIPTION_EXTEND_INVALID');
    } catch (error) {
      expect((error as AppException).getResponse()).toMatchObject({
        code: 'SUBSCRIPTION_EXTEND_INVALID',
      });
    }
  });
});
