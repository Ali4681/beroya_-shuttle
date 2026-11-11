import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import {
  addCalendarDays,
  calendarDateKey,
  isoWeekdayInTimezone,
  todayInTimezone,
} from '../../common/utils/timezone';
import {
  TripEventType,
  TripStatus,
  TripStudentStatus,
} from '../../generated/prisma/client';
import { parseServiceDate } from '../trips/trip.rules';

export function assertTripCanStart(status: TripStatus): void {
  if (status === TripStatus.IN_PROGRESS) {
    return;
  }
  if (status === TripStatus.COMPLETED) {
    throw new AppException(
      'TRIP_ALREADY_COMPLETED',
      'A completed trip cannot be started',
      HttpStatus.CONFLICT,
    );
  }
  if (status === TripStatus.CANCELLED) {
    throw new AppException(
      'TRIP_CANCELLED',
      'A cancelled trip cannot be started',
      HttpStatus.CONFLICT,
    );
  }
  if (status !== TripStatus.SCHEDULED) {
    throw new AppException(
      'TRIP_NOT_SCHEDULED',
      'Only a scheduled trip can be started',
      HttpStatus.CONFLICT,
    );
  }
}

export function assertTripCanComplete(status: TripStatus): void {
  if (status === TripStatus.COMPLETED) {
    return;
  }
  if (status === TripStatus.CANCELLED) {
    throw new AppException(
      'TRIP_CANCELLED',
      'A cancelled trip cannot be completed',
      HttpStatus.CONFLICT,
    );
  }
  if (status !== TripStatus.IN_PROGRESS) {
    throw new AppException(
      'TRIP_NOT_STARTED',
      'The driver must start the trip before completing it',
      HttpStatus.CONFLICT,
    );
  }
}

export function assertTripInProgress(status: TripStatus): void {
  if (status !== TripStatus.IN_PROGRESS) {
    throw new AppException(
      'TRIP_NOT_STARTED',
      'This action is allowed only while the trip is in progress',
      HttpStatus.CONFLICT,
    );
  }
}

export function assertCanMarkAttendantBoarded(status: TripStatus): void {
  if (status === TripStatus.COMPLETED) {
    throw new AppException(
      'TRIP_ALREADY_COMPLETED',
      'Attendant boarding cannot be changed on a completed trip',
      HttpStatus.CONFLICT,
    );
  }
  if (status === TripStatus.CANCELLED) {
    throw new AppException(
      'TRIP_CANCELLED',
      'Attendant boarding cannot be changed on a cancelled trip',
      HttpStatus.CONFLICT,
    );
  }
  if (
    status !== TripStatus.SCHEDULED &&
    status !== TripStatus.IN_PROGRESS
  ) {
    throw new AppException(
      'TRIP_NOT_SCHEDULED',
      'Attendant boarding can only be updated on scheduled or in-progress trips',
      HttpStatus.CONFLICT,
    );
  }
}

export function assertTripHasAttendant(attendantId: string | null | undefined): void {
  if (!attendantId) {
    throw new AppException(
      'ATTENDANT_NOT_ASSIGNED',
      'No attendant is assigned to this trip',
      HttpStatus.CONFLICT,
    );
  }
}

export function canApplyStudentStatus(
  current: TripStudentStatus,
  next: TripStudentStatus,
): boolean {
  if (current === next) {
    return true;
  }
  if (current === TripStudentStatus.PENDING) {
    return (
      next === TripStudentStatus.BOARDED ||
      next === TripStudentStatus.NOT_BOARDED
    );
  }
  // Late arrival / mistaken "not boarded" — allow correction while trip is live.
  if (
    current === TripStudentStatus.NOT_BOARDED &&
    next === TripStudentStatus.BOARDED
  ) {
    return true;
  }
  return (
    current === TripStudentStatus.BOARDED &&
    next === TripStudentStatus.DROPPED_OFF
  );
}

export type StudentStatusCounts = {
  pending: number;
  boarded: number;
  notBoarded: number;
  absent: number;
  droppedOff: number;
};

export function emptyStudentStatusCounts(): StudentStatusCounts {
  return {
    pending: 0,
    boarded: 0,
    notBoarded: 0,
    absent: 0,
    droppedOff: 0,
  };
}

export function tallyStudentStatusCounts(
  rows: Array<{ status: TripStudentStatus; _count?: { _all: number } }>,
): StudentStatusCounts {
  const counts = emptyStudentStatusCounts();
  for (const row of rows) {
    const n = row._count?._all ?? 1;
    switch (row.status) {
      case TripStudentStatus.PENDING:
        counts.pending += n;
        break;
      case TripStudentStatus.BOARDED:
        counts.boarded += n;
        break;
      case TripStudentStatus.NOT_BOARDED:
        counts.notBoarded += n;
        break;
      case TripStudentStatus.ABSENT:
        counts.absent += n;
        break;
      case TripStudentStatus.DROPPED_OFF:
        counts.droppedOff += n;
        break;
      default:
        break;
    }
  }
  return counts;
}

/** Snake_case shape for realtime / wire payloads. */
export function studentStatusCountsWire(
  counts: StudentStatusCounts,
): Record<string, number> {
  return {
    pending: counts.pending,
    boarded: counts.boarded,
    not_boarded: counts.notBoarded,
    absent: counts.absent,
    dropped_off: counts.droppedOff,
  };
}

export function studentEventType(status: TripStudentStatus): TripEventType {
  if (status === TripStudentStatus.BOARDED) {
    return TripEventType.STUDENT_BOARDED;
  }
  if (status === TripStudentStatus.NOT_BOARDED) {
    return TripEventType.STUDENT_NOT_BOARDED;
  }
  if (status === TripStudentStatus.ABSENT) {
    return TripEventType.STUDENT_ABSENT;
  }
  return TripEventType.STUDENT_DROPPED_OFF;
}

export type ParentBoardingNotice = {
  type: 'STUDENT_BOARDED' | 'STUDENT_NOT_BOARDED' | 'STUDENT_DROPPED_OFF';
  titleAr: string;
  bodyAr: string;
  titleEn: string;
  bodyEn: string;
};

/** Copy for parent FCM/inbox after attendant boarding actions. */
export function parentBoardingNotice(
  status: TripStudentStatus,
  studentName: string,
): ParentBoardingNotice | null {
  if (status === TripStudentStatus.BOARDED) {
    return {
      type: 'STUDENT_BOARDED',
      titleAr: 'صعد الطالب',
      bodyAr: `${studentName} صعد إلى الحافلة.`,
      titleEn: 'Student boarded',
      bodyEn: `${studentName} boarded the bus.`,
    };
  }
  if (status === TripStudentStatus.NOT_BOARDED) {
    return {
      type: 'STUDENT_NOT_BOARDED',
      titleAr: 'لم يصعد الطالب',
      bodyAr: `${studentName} لم يصعد إلى الحافلة.`,
      titleEn: 'Student did not board',
      bodyEn: `${studentName} did not board the bus.`,
    };
  }
  if (status === TripStudentStatus.DROPPED_OFF) {
    return {
      type: 'STUDENT_DROPPED_OFF',
      titleAr: 'نزل الطالب',
      bodyAr: `${studentName} نزل من الحافلة.`,
      titleEn: 'Student dropped off',
      bodyEn: `${studentName} was dropped off.`,
    };
  }
  return null;
}

export function assertServiceDateRange(from: string, to: string): {
  fromDate: Date;
  toDate: Date;
} {
  const fromDate = parseServiceDate(from);
  const toDate = parseServiceDate(to);
  if (toDate.getTime() < fromDate.getTime()) {
    throw new AppException(
      'INVALID_DATE_RANGE',
      'to must be on or after from',
      HttpStatus.BAD_REQUEST,
    );
  }
  return { fromDate, toDate };
}

/** Sunday–Saturday work week in the institution timezone. */
export function resolveWeekRange(
  timeZone: string,
  weekStart?: string,
  now = new Date(),
): { weekStart: Date; weekEnd: Date; weekStartKey: string; weekEndKey: string } {
  let start: Date;
  if (weekStart) {
    start = parseServiceDate(weekStart);
  } else {
    const today = todayInTimezone(timeZone, now);
    const weekday = isoWeekdayInTimezone(now, timeZone); // Mon=1 … Sun=7
    const daysSinceSunday = weekday % 7;
    start = addCalendarDays(today, -daysSinceSunday);
  }
  const end = addCalendarDays(start, 6);
  return {
    weekStart: start,
    weekEnd: end,
    weekStartKey: calendarDateKey(start),
    weekEndKey: calendarDateKey(end),
  };
}

export function tripDisplayCode(
  tripId: string,
  routeCode?: string | null,
): string {
  if (routeCode && routeCode.trim().length > 0) {
    return routeCode.trim();
  }
  return `TR-${tripId.replaceAll('-', '').slice(0, 4).toUpperCase()}`;
}

export function tripDurationMinutes(
  startedAt: Date | null | undefined,
  completedAt: Date | null | undefined,
): number | null {
  if (!startedAt || !completedAt) {
    return null;
  }
  const ms = completedAt.getTime() - startedAt.getTime();
  if (ms < 0) {
    return null;
  }
  return Math.round(ms / 60_000);
}

export function distanceKmFromPings(
  pings: Array<{ latitude: number; longitude: number }>,
  pathDistanceMeters: (points: Array<{ lat: number; lng: number }>) => number,
): number | null {
  if (pings.length < 2) {
    return null;
  }
  const meters = pathDistanceMeters(
    pings.map((ping) => ({ lat: ping.latitude, lng: ping.longitude })),
  );
  return Math.round((meters / 1000) * 10) / 10;
}
