import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import {
  addCalendarDays,
  calendarDateKey,
  isoWeekdayInTimezone,
  todayInTimezone,
} from '../../common/utils/timezone';
import {
  TripDirection,
  TripEventType,
  TripStatus,
  TripStudentStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import {
  studentEventType,
  studentStatusCountsWire,
  tallyStudentStatusCounts,
} from '../crew/crew.rules';
import { REALTIME_EVENTS } from '../realtime/realtime.constants';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationService } from '../shared/notifications/notification.service';
import { parseServiceDate } from '../trips/trip.rules';
import { TripEventService } from '../trips/trip-event.service';
import { RecordAbsenceDto } from './dto/record-absence.dto';
import { RecordDateAbsenceDto } from './dto/record-date-absence.dto';
import {
  assertParentAbsenceAllowed,
  isParentAbsenceStatus,
  parentAbsenceMessages,
} from './passenger.rules';
import { withNoticeI18n } from '../admin/platform-settings';

const WEEKEND_ISO = new Set([5, 6]); // Fri, Sat

@Injectable()
export class ParentAbsenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: TripEventService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationService,
  ) {}

  async recordByTrip(
    userId: string,
    studentId: string,
    tripId: string,
    dto: RecordAbsenceDto = {},
  ) {
    const reason = this.normalizeReason(dto.reason);
    const student = await this.requireChild(userId, studentId);
    const row = await this.loadTripStudent(studentId, tripId);
    if (!row) {
      throw new AppException(
        'TRIP_NOT_FOUND',
        'Trip not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const today = todayInTimezone(await this.timezone(student.institutionId));
    if (row.trip.serviceDate.getTime() < today.getTime()) {
      throw new AppException(
        'ABSENCE_PAST_DATE',
        'Absence cannot be recorded for a past trip',
        HttpStatus.CONFLICT,
      );
    }

    assertParentAbsenceAllowed(row.trip.status, row.status);
    return this.applyOnTripStudent(userId, row, reason, {
      upsertPlanned: true,
    });
  }

  async recordByDate(
    userId: string,
    studentId: string,
    dto: RecordDateAbsenceDto,
  ) {
    const reason = this.normalizeReason(dto.reason);
    const student = await this.requireChild(userId, studentId);
    const serviceDate = parseServiceDate(dto.date);
    const timeZone = await this.timezone(student.institutionId);
    const today = todayInTimezone(timeZone);

    if (serviceDate.getTime() < today.getTime()) {
      throw new AppException(
        'ABSENCE_PAST_DATE',
        'Absence cannot be recorded for a past date',
        HttpStatus.CONFLICT,
      );
    }

    await this.assertSchoolDay(student.institutionId, serviceDate, timeZone);

    const tripRow = await this.findActiveTripStudentForDate(
      studentId,
      serviceDate,
    );
    if (tripRow) {
      assertParentAbsenceAllowed(tripRow.trip.status, tripRow.status);
      const applied = await this.applyOnTripStudent(userId, tripRow, reason, {
        upsertPlanned: true,
      });
      return {
        studentId: applied.studentId,
        date: calendarDateKey(serviceDate),
        status: applied.status,
        tripId: applied.tripId,
        notBoardedAt: applied.notBoardedAt,
        reason: applied.reason,
      };
    }

    const existing = await this.prisma.studentPlannedAbsence.findUnique({
      where: {
        studentId_date: { studentId, date: serviceDate },
      },
    });
    if (existing) {
      return {
        studentId,
        date: calendarDateKey(serviceDate),
        status: TripStudentStatus.ABSENT,
        tripId: null,
        notBoardedAt: existing.createdAt,
        reason: existing.reason,
      };
    }

    const created = await this.prisma.studentPlannedAbsence.create({
      data: {
        studentId,
        date: serviceDate,
        reason,
        recordedByUserId: userId,
      },
    });
    return {
      studentId,
      date: calendarDateKey(serviceDate),
      status: TripStudentStatus.ABSENT,
      tripId: null,
      notBoardedAt: created.createdAt,
      reason: created.reason,
    };
  }

  async listCalendarDays(
    userId: string,
    studentId: string,
    from?: string,
    to?: string,
  ) {
    const student = await this.requireChild(userId, studentId);
    const timeZone = await this.timezone(student.institutionId);
    const today = todayInTimezone(timeZone);
    const fromDate = from ? parseServiceDate(from) : today;
    const toDate = to ? parseServiceDate(to) : addCalendarDays(today, 60);
    if (toDate.getTime() < fromDate.getTime()) {
      throw new AppException(
        'INVALID_DATE_RANGE',
        'to must be on or after from',
        HttpStatus.BAD_REQUEST,
      );
    }

    const holidays = await this.prisma.institutionHoliday.findMany({
      where: {
        institutionId: student.institutionId,
        date: { gte: fromDate, lte: toDate },
      },
      orderBy: { date: 'asc' },
    });
    const holidayByKey = new Map(
      holidays.map((row) => [calendarDateKey(row.date), row]),
    );

    const nonSchoolDays: Array<{
      date: string;
      kind: 'weekend' | 'holiday';
      label: string | null;
    }> = [];
    for (
      let cursor = fromDate;
      cursor.getTime() <= toDate.getTime();
      cursor = addCalendarDays(cursor, 1)
    ) {
      const key = calendarDateKey(cursor);
      const weekday = isoWeekdayInTimezone(cursor, timeZone);
      if (WEEKEND_ISO.has(weekday)) {
        nonSchoolDays.push({ date: key, kind: 'weekend', label: null });
        continue;
      }
      const holiday = holidayByKey.get(key);
      if (holiday) {
        nonSchoolDays.push({
          date: key,
          kind: 'holiday',
          label: holiday.name,
        });
      }
    }

    const planned = await this.prisma.studentPlannedAbsence.findMany({
      where: {
        studentId,
        date: { gte: fromDate, lte: toDate },
      },
      orderBy: { date: 'asc' },
    });

    return {
      nonSchoolDays,
      plannedAbsences: planned.map((row) => ({
        date: calendarDateKey(row.date),
        reason: row.reason,
        status: TripStudentStatus.ABSENT,
        tripId: null as string | null,
        appliedAt: row.appliedAt,
        notifiedAt: row.notifiedAt,
      })),
    };
  }

  /** After trip generation: apply planned absences and notify crew once. */
  async applyPlannedAbsencesForDate(
    institutionId: string,
    serviceDate: Date,
  ): Promise<number> {
    const planned = await this.prisma.studentPlannedAbsence.findMany({
      where: {
        date: serviceDate,
        appliedAt: null,
        student: { institutionId, archivedAt: null },
      },
      include: {
        student: { select: { id: true, fullName: true } },
      },
    });
    let applied = 0;
    for (const row of planned) {
      const tripRow = await this.findActiveTripStudentForDate(
        row.studentId,
        serviceDate,
      );
      if (!tripRow) {
        continue;
      }
      if (
        tripRow.status !== TripStudentStatus.PENDING &&
        tripRow.status !== TripStudentStatus.ABSENT
      ) {
        await this.prisma.studentPlannedAbsence.update({
          where: { id: row.id },
          data: { appliedAt: new Date() },
        });
        continue;
      }
      const result = await this.applyOnTripStudent(
        row.recordedByUserId,
        tripRow,
        row.reason,
        {
          upsertPlanned: false,
          skipNotify: Boolean(row.notifiedAt),
        },
      );
      await this.prisma.studentPlannedAbsence.update({
        where: { id: row.id },
        data: {
          appliedAt: new Date(),
          notifiedAt: row.notifiedAt ?? (result.notified ? new Date() : null),
        },
      });
      applied += 1;
    }
    return applied;
  }

  private async applyOnTripStudent(
    actorUserId: string,
    row: NonNullable<Awaited<ReturnType<ParentAbsenceService['loadTripStudent']>>>,
    reason: string | null,
    options: { upsertPlanned: boolean; skipNotify?: boolean },
  ): Promise<{
    studentId: string;
    tripId: string;
    status: TripStudentStatus;
    notBoardedAt: Date | null;
    reason: string | null;
    notified: boolean;
  }> {
    if (isParentAbsenceStatus(row.status)) {
      if (options.upsertPlanned) {
        await this.upsertPlanned(
          row.studentId,
          row.trip.serviceDate,
          actorUserId,
          reason,
          { applied: true, notified: true },
        );
      }
      return {
        studentId: row.studentId,
        tripId: row.tripId,
        status: TripStudentStatus.ABSENT,
        notBoardedAt: row.notBoardedAt,
        reason:
          reason ??
          (await this.parentAbsenceReason(row.tripId, row.id)) ??
          null,
        notified: false,
      };
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.tripStudent.update({
        where: { id: row.id },
        data: {
          status: TripStudentStatus.ABSENT,
          markedByUserId: actorUserId,
          notBoardedAt: row.notBoardedAt ?? now,
        },
        include: {
          student: { select: { id: true, fullName: true } },
        },
      });
      await this.events.record(
        {
          tripId: row.tripId,
          type: studentEventType(TripStudentStatus.ABSENT),
          actorUserId,
          title: `${next.student.fullName} absent (parent)`,
          description: reason ?? undefined,
          data: {
            tripStudentId: row.id,
            studentId: row.studentId,
            studentName: next.student.fullName,
            status: TripStudentStatus.ABSENT,
            source: 'PARENT',
            reason,
          },
          occurredAt: now,
        },
        tx,
      );
      return next;
    });

    const messages = parentAbsenceMessages(updated.student.fullName);
    const tripCtx = {
      institutionId: row.trip.institutionId,
      tripId: row.tripId,
      routeId: row.trip.routeId,
      operationModel: row.trip.institution.operationModel,
    };
    const absentPayload = {
      trip_id: row.tripId,
      trip_student_id: row.id,
      student_id: row.studentId,
      student_name: updated.student.fullName,
      status: TripStudentStatus.ABSENT,
      source: 'PARENT',
      reported_at: (updated.notBoardedAt ?? now).toISOString(),
      reason,
      message_ar: messages.messageAr,
      message_en: messages.messageEn,
    };

    this.realtime.emitTrip(
      REALTIME_EVENTS.TRIP_STUDENT_ABSENT,
      tripCtx,
      absentPayload,
    );
    const countRows = await this.prisma.tripStudent.groupBy({
      by: ['status'],
      where: { tripId: row.tripId },
      _count: { _all: true },
    });
    this.realtime.emitTrip(
      REALTIME_EVENTS.TRIP_STUDENT_STATUS_CHANGED,
      tripCtx,
      {
        trip_student_id: row.id,
        student_id: row.studentId,
        student_name: updated.student.fullName,
        status: TripStudentStatus.ABSENT,
        trip_stop_id: updated.tripStopId ?? row.tripStopId ?? null,
        source: 'PARENT',
        reason,
        student_counts: studentStatusCountsWire(
          tallyStudentStatusCounts(countRows),
        ),
      },
    );

    let notified = false;
    if (!options.skipNotify) {
      await this.notifyCrew({
        actorUserId,
        institutionId: row.trip.institutionId,
        routeId: row.trip.routeId,
        branchId: row.trip.branchId,
        tripId: row.tripId,
        tripStudentId: row.id,
        studentId: row.studentId,
        studentName: updated.student.fullName,
        reason,
        reportedAt: updated.notBoardedAt ?? now,
        messageAr: messages.messageAr,
        messageEn: messages.messageEn,
        driverUserId: row.trip.driver?.userId ?? null,
        attendantUserId: row.trip.attendant?.userId ?? null,
      });
      notified = true;
    }

    if (options.upsertPlanned) {
      await this.upsertPlanned(
        row.studentId,
        row.trip.serviceDate,
        actorUserId,
        reason,
        { applied: true, notified },
      );
    }

    return {
      studentId: updated.studentId,
      tripId: updated.tripId,
      status: updated.status,
      notBoardedAt: updated.notBoardedAt,
      reason,
      notified,
    };
  }

  private async upsertPlanned(
    studentId: string,
    date: Date,
    recordedByUserId: string,
    reason: string | null,
    flags: { applied: boolean; notified: boolean },
  ) {
    const now = new Date();
    await this.prisma.studentPlannedAbsence.upsert({
      where: { studentId_date: { studentId, date } },
      create: {
        studentId,
        date,
        reason,
        recordedByUserId,
        appliedAt: flags.applied ? now : null,
        notifiedAt: flags.notified ? now : null,
      },
      update: {
        reason: reason ?? undefined,
        appliedAt: flags.applied ? now : undefined,
        notifiedAt: flags.notified ? now : undefined,
      },
    });
  }

  private async assertSchoolDay(
    institutionId: string,
    serviceDate: Date,
    timeZone: string,
  ) {
    const weekday = isoWeekdayInTimezone(serviceDate, timeZone);
    if (WEEKEND_ISO.has(weekday)) {
      throw new AppException(
        'ABSENCE_NON_SCHOOL_DAY',
        'Friday and Saturday are not school days',
        HttpStatus.CONFLICT,
      );
    }
    const holiday = await this.prisma.institutionHoliday.findUnique({
      where: {
        institutionId_date: { institutionId, date: serviceDate },
      },
    });
    if (holiday) {
      throw new AppException(
        'ABSENCE_HOLIDAY',
        'This day is a holiday',
        HttpStatus.CONFLICT,
      );
    }
  }

  private async findActiveTripStudentForDate(
    studentId: string,
    serviceDate: Date,
  ) {
    const rows = await this.prisma.tripStudent.findMany({
      where: {
        studentId,
        trip: {
          serviceDate,
          status: { in: [TripStatus.SCHEDULED, TripStatus.IN_PROGRESS] },
        },
      },
      include: {
        student: { select: { id: true, fullName: true } },
        trip: {
          select: {
            id: true,
            status: true,
            serviceDate: true,
            institutionId: true,
            routeId: true,
            branchId: true,
            direction: true,
            institution: { select: { operationModel: true } },
            driver: { select: { userId: true } },
            attendant: { select: { userId: true } },
          },
        },
      },
    });
    if (rows.length === 0) {
      return null;
    }
    const outbound = rows.find(
      (row) => row.trip.direction === TripDirection.OUTBOUND,
    );
    return outbound ?? rows[0];
  }

  private loadTripStudent(studentId: string, tripId: string) {
    return this.prisma.tripStudent.findFirst({
      where: { studentId, tripId },
      include: {
        student: { select: { id: true, fullName: true } },
        trip: {
          select: {
            id: true,
            status: true,
            serviceDate: true,
            institutionId: true,
            routeId: true,
            branchId: true,
            direction: true,
            institution: { select: { operationModel: true } },
            driver: { select: { userId: true } },
            attendant: { select: { userId: true } },
          },
        },
      },
    });
  }

  private async parentAbsenceReason(
    tripId: string,
    tripStudentId: string,
  ): Promise<string | null> {
    const events = await this.prisma.tripEvent.findMany({
      where: {
        tripId,
        type: {
          in: [TripEventType.STUDENT_ABSENT, TripEventType.STUDENT_NOT_BOARDED],
        },
      },
      orderBy: { occurredAt: 'desc' },
      take: 20,
      select: { data: true },
    });
    for (const event of events) {
      const data = event.data as Record<string, unknown> | null;
      if (
        data &&
        data.tripStudentId === tripStudentId &&
        data.source === 'PARENT'
      ) {
        return typeof data.reason === 'string' ? data.reason : null;
      }
    }
    return null;
  }

  private async notifyCrew(input: {
    actorUserId: string;
    institutionId: string;
    routeId: string;
    branchId: string | null;
    tripId: string;
    tripStudentId: string;
    studentId: string;
    studentName: string;
    reason: string | null;
    reportedAt: Date;
    messageAr: string;
    messageEn: string;
    driverUserId: string | null;
    attendantUserId: string | null;
  }) {
    const titleAr = 'غياب طالب';
    const titleEn = 'Student absence';
    const bodyAr = input.reason
      ? `${input.messageAr} — ${input.reason}`
      : input.messageAr;
    const bodyEn = input.reason
      ? `${input.messageEn} — ${input.reason}`
      : input.messageEn;
    const data = withNoticeI18n(
      {
        tripId: input.tripId,
        tripStudentId: input.tripStudentId,
        studentId: input.studentId,
        studentName: input.studentName,
        status: TripStudentStatus.ABSENT,
        type: 'STUDENT_ABSENT',
        source: 'PARENT',
        reason: input.reason,
        reportedAt: input.reportedAt.toISOString(),
        messageAr: input.messageAr,
        messageEn: input.messageEn,
      },
      {
        title: titleAr,
        body: bodyAr,
        i18n: {
          titleAr,
          bodyAr,
          titleEn,
          bodyEn,
        },
      },
    );
    if (input.driverUserId) {
      await this.notifications.notifyAssignedDriver({
        actorUserId: input.actorUserId,
        institutionId: input.institutionId,
        routeId: input.routeId,
        branchId: input.branchId,
        driverUserId: input.driverUserId,
        title: titleAr,
        body: bodyAr,
        data,
      });
    }
    if (input.attendantUserId) {
      await this.notifications.notifyAssignedAttendant({
        actorUserId: input.actorUserId,
        institutionId: input.institutionId,
        routeId: input.routeId,
        branchId: input.branchId,
        attendantUserId: input.attendantUserId,
        title: titleAr,
        body: bodyAr,
        data,
      });
    }
  }

  private normalizeReason(reason?: string | null): string | null {
    if (reason == null) {
      return null;
    }
    const trimmed = reason.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private async requireChild(userId: string, studentId: string) {
    const student = await this.prisma.schoolStudent.findFirst({
      where: { id: studentId, guardianUserId: userId, archivedAt: null },
      select: { id: true, institutionId: true, fullName: true },
    });
    if (!student) {
      throw new AppException(
        'STUDENT_NOT_FOUND',
        'Student not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return student;
  }

  private async timezone(institutionId: string): Promise<string> {
    const settings = await this.prisma.institutionSettings.findUnique({
      where: { institutionId },
    });
    return settings?.timezone ?? 'Asia/Damascus';
  }
}
