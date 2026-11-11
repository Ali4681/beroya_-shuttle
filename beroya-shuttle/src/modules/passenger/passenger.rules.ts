import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { TripStatus, TripStudentStatus } from '../../generated/prisma/client';
import { ARRIVAL_MINUTES } from '../notifications/arrival-alert.rules';

export function assertArrivalMinutes(value: number): void {
  if (!(ARRIVAL_MINUTES as readonly number[]).includes(value)) {
    throw new AppException(
      'INVALID_ARRIVAL_MINUTES',
      'minutes_before must be 5, 10, or 15',
      HttpStatus.BAD_REQUEST,
    );
  }
}

export function assertParentReadOnly(): never {
  throw new AppException(
    'PARENT_READ_ONLY',
    'Parents can only update arrival preference or record absence',
    HttpStatus.FORBIDDEN,
  );
}

export function isParentAbsenceStatus(status: TripStudentStatus): boolean {
  return status === TripStudentStatus.ABSENT;
}

/** Parent absence: SCHEDULED | IN_PROGRESS only; PENDING → ABSENT (idempotent if already ABSENT). */
export function assertParentAbsenceAllowed(
  tripStatus: TripStatus,
  studentStatus: TripStudentStatus,
): void {
  if (tripStatus === TripStatus.COMPLETED) {
    throw new AppException(
      'TRIP_ALREADY_COMPLETED',
      'Absence cannot be recorded on a completed trip',
      HttpStatus.CONFLICT,
    );
  }
  if (tripStatus === TripStatus.CANCELLED) {
    throw new AppException(
      'TRIP_CANCELLED',
      'Absence cannot be recorded on a cancelled trip',
      HttpStatus.CONFLICT,
    );
  }
  if (
    tripStatus !== TripStatus.SCHEDULED &&
    tripStatus !== TripStatus.IN_PROGRESS
  ) {
    throw new AppException(
      'ABSENCE_NOT_ALLOWED',
      'Absence is allowed only while the trip is scheduled or in progress',
      HttpStatus.CONFLICT,
    );
  }
  if (studentStatus === TripStudentStatus.ABSENT) {
    return;
  }
  if (studentStatus !== TripStudentStatus.PENDING) {
    throw new AppException(
      'ABSENCE_NOT_ALLOWED',
      'Absence is not allowed for this boarding status',
      HttpStatus.CONFLICT,
    );
  }
}

export function parentAbsenceMessages(studentName: string): {
  messageAr: string;
  messageEn: string;
} {
  return {
    messageAr: `اعتذر ولي أمر الطالب (${studentName}) عن حضور ابنه اليوم.`,
    messageEn: `The guardian of student (${studentName}) reported absence for today.`,
  };
}
