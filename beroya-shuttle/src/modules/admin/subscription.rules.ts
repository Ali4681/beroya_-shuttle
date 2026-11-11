import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { SubscriptionStatus } from '../../generated/prisma/client';

export function rangesOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
): boolean {
  return startA < endB && startB < endA;
}

export function assertValidSubscriptionWindow(
  startsAt: Date,
  endsAt: Date,
): void {
  if (!(startsAt < endsAt)) {
    throw new AppException(
      'SUBSCRIPTION_INVALID_WINDOW',
      'starts_at must be before ends_at',
      HttpStatus.BAD_REQUEST,
    );
  }
}

export function assertNoActiveOverlap(
  candidate: { startsAt: Date; endsAt: Date },
  actives: Array<{ id: string; startsAt: Date; endsAt: Date }>,
  ignoreId?: string,
): void {
  const clash = actives.find(
    (item) =>
      item.id !== ignoreId &&
      rangesOverlap(
        candidate.startsAt,
        candidate.endsAt,
        item.startsAt,
        item.endsAt,
      ),
  );
  if (clash) {
    throw new AppException(
      'SUBSCRIPTION_OVERLAP',
      'An active subscription already covers this period',
      HttpStatus.CONFLICT,
      { conflictingId: clash.id },
    );
  }
}

export function assertSubscriptionPending(status: SubscriptionStatus): void {
  if (status !== SubscriptionStatus.PENDING) {
    throw new AppException(
      'SUBSCRIPTION_NOT_PENDING',
      'Only pending subscriptions can be changed this way',
      HttpStatus.CONFLICT,
    );
  }
}

export function assertCanCancel(status: SubscriptionStatus): void {
  if (
    status !== SubscriptionStatus.PENDING &&
    status !== SubscriptionStatus.ACTIVE
  ) {
    throw new AppException(
      'SUBSCRIPTION_NOT_CANCELLABLE',
      'Only pending or active subscriptions can be cancelled',
      HttpStatus.CONFLICT,
    );
  }
}

export function assertCanExtend(status: SubscriptionStatus): void {
  if (status !== SubscriptionStatus.ACTIVE) {
    throw new AppException(
      'SUBSCRIPTION_NOT_ACTIVE',
      'Only active subscriptions can be extended',
      HttpStatus.CONFLICT,
    );
  }
}

export function assertExtendMovesForward(
  currentEnd: Date,
  nextEnd: Date,
): void {
  if (!(nextEnd > currentEnd)) {
    throw new AppException(
      'SUBSCRIPTION_EXTEND_INVALID',
      'new_end_date must be after the current ends_at',
      HttpStatus.BAD_REQUEST,
    );
  }
}
