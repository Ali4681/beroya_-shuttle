import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { calendarDateKey } from '../../common/utils/timezone';
import {
  RouteStatus,
  StudentSubscriptionType,
  TripDirection,
  TripStatus,
} from '../../generated/prisma/client';

export function parseServiceDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppException(
      'INVALID_DATE',
      'date must be YYYY-MM-DD',
      HttpStatus.BAD_REQUEST,
    );
  }
  return new Date(`${value}T00:00:00.000Z`);
}

export function studentMatchesDirection(
  subscriptionType: StudentSubscriptionType,
  direction: TripDirection,
): boolean {
  if (subscriptionType === StudentSubscriptionType.OUTBOUND_ONLY) {
    return direction === TripDirection.OUTBOUND;
  }
  if (subscriptionType === StudentSubscriptionType.INBOUND_ONLY) {
    return direction === TripDirection.INBOUND;
  }
  return true;
}

export function canGenerateRoute(
  status: RouteStatus,
  generateDate: Date,
  today: Date,
): boolean {
  if (status === RouteStatus.ACTIVE) {
    return true;
  }
  if (status === RouteStatus.STOPPED_TODAY) {
    return calendarDateKey(generateDate) !== calendarDateKey(today);
  }
  return false;
}

export function assertOverrideAllowed(status: TripStatus): void {
  if (status !== TripStatus.SCHEDULED) {
    throw new AppException(
      'TRIP_NOT_SCHEDULED',
      'Override is only allowed while the trip is scheduled',
      HttpStatus.CONFLICT,
    );
  }
}

export function assertReassignAllowed(status: TripStatus): void {
  if (status !== TripStatus.SCHEDULED && status !== TripStatus.IN_PROGRESS) {
    throw new AppException(
      'TRIP_NOT_REASSIGNABLE',
      'Reassign is only allowed for scheduled or in-progress trips',
      HttpStatus.CONFLICT,
    );
  }
}

export function assertCancelAllowed(status: TripStatus): void {
  if (status === TripStatus.COMPLETED) {
    throw new AppException(
      'TRIP_ALREADY_COMPLETED',
      'A completed trip cannot be cancelled',
      HttpStatus.CONFLICT,
    );
  }
  if (status === TripStatus.CANCELLED) {
    throw new AppException(
      'TRIP_ALREADY_CANCELLED',
      'Trip is already cancelled',
      HttpStatus.CONFLICT,
    );
  }
}
