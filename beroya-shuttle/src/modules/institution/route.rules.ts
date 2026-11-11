import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import {
  InstitutionType,
  StopType,
  TripDirection,
} from '../../generated/prisma/client';

export const DEPARTURE_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export type StaleStopInput = {
  stopType: StopType;
  etaOffsetMinutes: number | null;
  updatedAt: Date;
  students: Array<{ pickupUpdatedAt: Date | null }>;
};

export function assertDepartureTime(value: string): string {
  if (!DEPARTURE_TIME_PATTERN.test(value)) {
    throw new AppException(
      'INVALID_DEPARTURE_TIME',
      'departure_time must be HH:mm',
      HttpStatus.BAD_REQUEST,
    );
  }
  return value;
}

export function normalizeDaysOfWeek(days: number[]): number[] {
  const unique = [...new Set(days)].sort((a, b) => a - b);
  if (unique.length === 0 || unique.some((day) => day < 1 || day > 7)) {
    throw new AppException(
      'INVALID_DAYS_OF_WEEK',
      'days_of_week must be ISO weekdays 1-7',
      HttpStatus.BAD_REQUEST,
    );
  }
  return unique;
}

export function assertSchoolScheduleLimit(
  institutionType: InstitutionType,
  existingForDirection: number,
): void {
  if (institutionType === InstitutionType.SCHOOL && existingForDirection >= 1) {
    throw new AppException(
      'SCHOOL_SCHEDULE_LIMIT',
      'A school route can have only one schedule per direction',
      HttpStatus.CONFLICT,
    );
  }
}

export function computeStopsOrderStale(stops: StaleStopInput[]): boolean {
  const movable = stops.filter(
    (stop) => stop.stopType !== StopType.INSTITUTION,
  );
  if (movable.length === 0) {
    return false;
  }
  if (movable.some((stop) => stop.etaOffsetMinutes == null)) {
    return true;
  }
  return movable.some((stop) =>
    stop.students.some(
      (student) =>
        student.pickupUpdatedAt != null &&
        student.pickupUpdatedAt.getTime() > stop.updatedAt.getTime(),
    ),
  );
}

export function inboundPickupOrder<T>(outboundPickups: T[]): T[] {
  return [...outboundPickups].reverse();
}

export function assertCompleteStopOrder(
  existingIds: string[],
  submittedIds: string[],
): void {
  const existing = [...existingIds].sort();
  const submitted = [...submittedIds].sort();
  if (
    existing.length !== submitted.length ||
    existing.some((id, index) => id !== submitted[index])
  ) {
    throw new AppException(
      'STOP_ORDER_MISMATCH',
      'stop-order must include every stop for this direction exactly once',
      HttpStatus.BAD_REQUEST,
    );
  }
}

export function sequencesAreContiguous(sequences: number[]): boolean {
  const sorted = [...sequences].sort((a, b) => a - b);
  return sorted.every((value, index) => value === index + 1);
}

export function institutionAnchor(
  direction: TripDirection,
  pickups: number,
): { institutionSequence: number; firstPickupSequence: number } {
  if (direction === TripDirection.OUTBOUND) {
    return {
      firstPickupSequence: 1,
      institutionSequence: pickups + 1,
    };
  }
  return {
    institutionSequence: 1,
    firstPickupSequence: 2,
  };
}
