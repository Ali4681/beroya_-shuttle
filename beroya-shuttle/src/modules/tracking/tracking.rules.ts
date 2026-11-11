import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { TripStatus } from '../../generated/prisma/client';

export function delayMinutesFromEta(
  etaToFinishAt: Date | null | undefined,
  plannedFinishAt: Date | null | undefined,
): number {
  if (!etaToFinishAt || !plannedFinishAt) {
    return 0;
  }
  return Math.max(
    0,
    Math.floor((etaToFinishAt.getTime() - plannedFinishAt.getTime()) / 60_000),
  );
}

export function shouldSendDelayAlert(
  delayMinutes: number,
  thresholdMinutes: number,
  alreadySent: boolean,
): boolean {
  return !alreadySent && delayMinutes > thresholdMinutes;
}

export function isGpsStale(
  lastLocationAt: Date | null | undefined,
  staleAfterSeconds: number,
  now = new Date(),
): boolean {
  if (!lastLocationAt) {
    return true;
  }
  return now.getTime() - lastLocationAt.getTime() > staleAfterSeconds * 1000;
}

export function assertLocationAllowed(status: TripStatus): void {
  if (status === TripStatus.COMPLETED) {
    throw new AppException(
      'TRIP_ALREADY_COMPLETED',
      'Cannot send location for a completed trip',
      HttpStatus.CONFLICT,
    );
  }
  if (status === TripStatus.CANCELLED) {
    throw new AppException(
      'TRIP_CANCELLED',
      'Cannot send location for a cancelled trip',
      HttpStatus.CONFLICT,
    );
  }
  if (status !== TripStatus.IN_PROGRESS) {
    throw new AppException(
      'TRIP_NOT_STARTED',
      'Location is accepted after the driver starts the trip',
      HttpStatus.CONFLICT,
    );
  }
}
