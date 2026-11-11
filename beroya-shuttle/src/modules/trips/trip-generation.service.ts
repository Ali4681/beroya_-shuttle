import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import {
  addCalendarDays,
  calendarDateKey,
  isoWeekdayInTimezone,
  todayInTimezone,
  zonedDateTime,
} from '../../common/utils/timezone';
import {
  InstitutionStatus,
  Prisma,
  RouteStatus,
  StopType,
  StudentStatus,
  StudentSubscriptionType,
  SubscriptionStatus,
  TripDirection,
  TripStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ParentAbsenceService } from '../passenger/parent-absence.service';
import { canGenerateRoute, studentMatchesDirection } from './trip.rules';

type Db = PrismaService | Prisma.TransactionClient;

export type GenerationResult = {
  date: string;
  routesConsidered: number;
  tripsCreated: number;
  tripsExisting: number;
  stopsCreated: number;
  studentsCreated: number;
  exceptionsApplied: number;
};

@Injectable()
export class TripGenerationService {
  private readonly logger = new Logger(TripGenerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly absences: ParentAbsenceService,
  ) {}

  async generateForInstitution(
    institutionId: string,
    serviceDate: Date,
    routeId?: string,
  ): Promise<GenerationResult> {
    const institution = await this.prisma.institution.findFirst({
      where: { id: institutionId, archivedAt: null },
      include: {
        settings: true,
        subscriptions: {
          where: { status: SubscriptionStatus.ACTIVE },
          orderBy: { endsAt: 'desc' },
        },
      },
    });
    if (!institution) {
      throw new AppException(
        'INSTITUTION_NOT_FOUND',
        'Institution not found',
        HttpStatus.NOT_FOUND,
      );
    }
    if (institution.status !== InstitutionStatus.ACTIVE) {
      throw new AppException(
        'INSTITUTION_NOT_ACTIVE',
        'Trips are generated only for active institutions',
        HttpStatus.CONFLICT,
      );
    }
    const now = Date.now();
    const hasSub = institution.subscriptions.some(
      (item) => item.startsAt.getTime() <= now && item.endsAt.getTime() >= now,
    );
    if (!hasSub) {
      throw new AppException(
        'NO_ACTIVE_SUBSCRIPTION',
        'An active subscription is required to generate trips',
        HttpStatus.CONFLICT,
      );
    }

    const timeZone = institution.settings?.timezone ?? 'Asia/Damascus';
    const today = todayInTimezone(timeZone);
    const weekday = isoWeekdayInTimezone(serviceDate, timeZone);
    const delayDefault =
      institution.settings?.defaultDelayThresholdMinutes ?? 10;

    const routes = await this.prisma.shuttleRoute.findMany({
      where: {
        institutionId,
        archivedAt: null,
        ...(routeId ? { id: routeId } : {}),
      },
      include: {
        schedules: { where: { isActive: true } },
        stops: { include: { students: { include: { student: true } } } },
      },
    });

    const result: GenerationResult = {
      date: calendarDateKey(serviceDate),
      routesConsidered: 0,
      tripsCreated: 0,
      tripsExisting: 0,
      stopsCreated: 0,
      studentsCreated: 0,
      exceptionsApplied: 0,
    };

    await this.prisma.$transaction(async (tx) => {
      for (const route of routes) {
        if (!canGenerateRoute(route.status, serviceDate, today)) {
          continue;
        }
        result.routesConsidered += 1;
        const matching = route.schedules.filter((schedule) =>
          schedule.daysOfWeek.includes(weekday),
        );
        for (const schedule of matching) {
          const generated = await this.upsertTrip(tx, {
            institutionId,
            branchId: route.branchId,
            route,
            schedule,
            serviceDate,
            timeZone,
            delayDefault,
          });
          if (generated.created) {
            result.tripsCreated += 1;
          } else {
            result.tripsExisting += 1;
          }
          result.stopsCreated += generated.stopsCreated;
          result.studentsCreated += generated.studentsCreated;
        }
      }

      result.exceptionsApplied = await this.applyExceptions(
        tx,
        institutionId,
        serviceDate,
      );

      if (calendarDateKey(serviceDate) !== calendarDateKey(today)) {
        await tx.shuttleRoute.updateMany({
          where: {
            institutionId,
            status: RouteStatus.STOPPED_TODAY,
            archivedAt: null,
          },
          data: { status: RouteStatus.ACTIVE },
        });
      }
    });

    // Outside the generation transaction: mark planned parent absences + notify crew.
    try {
      await this.absences.applyPlannedAbsencesForDate(
        institutionId,
        serviceDate,
      );
    } catch (error) {
      this.logger.warn(
        `Planned absence apply failed for ${institutionId} ${calendarDateKey(serviceDate)}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }

    return result;
  }

  async generateDue(now = new Date()): Promise<GenerationResult[]> {
    const institutions = await this.prisma.institution.findMany({
      where: {
        archivedAt: null,
        status: InstitutionStatus.ACTIVE,
      },
      include: { settings: true },
    });
    const results: GenerationResult[] = [];
    for (const institution of institutions) {
      const timeZone = institution.settings?.timezone ?? 'Asia/Damascus';
      const clock = new Intl.DateTimeFormat('en-GB', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(now)
        .reduce<Record<string, string>>((acc, part) => {
          if (part.type !== 'literal') {
            acc[part.type] = part.value;
          }
          return acc;
        }, {});
      const hhmm = `${clock.hour ?? '00'}:${clock.minute ?? '00'}`;
      const today = todayInTimezone(timeZone, now);
      try {
        if (hhmm === '23:30') {
          results.push(
            await this.generateForInstitution(
              institution.id,
              addCalendarDays(today, 1),
            ),
          );
        } else if (hhmm === '05:00') {
          results.push(
            await this.generateForInstitution(institution.id, today),
          );
        }
      } catch (error) {
        this.logger.warn(
          `Skip generation for ${institution.id}: ${
            error instanceof Error ? error.message : 'unknown'
          }`,
        );
      }
    }
    return results;
  }

  async applyExceptionsForStudent(
    institutionId: string,
    studentId: string,
    serviceDate: Date,
    db: Db = this.prisma,
  ): Promise<number> {
    return this.applyExceptions(db, institutionId, serviceDate, studentId);
  }

  private async upsertTrip(
    tx: Prisma.TransactionClient,
    input: {
      institutionId: string;
      branchId: string;
      route: {
        id: string;
        originLabel: string | null;
        originLat: number;
        originLng: number;
        delayThresholdMinutes: number | null;
        defaultDriverId: string | null;
        defaultVehicleId: string | null;
        defaultAttendantId: string | null;
        stops: Array<{
          id: string;
          direction: TripDirection;
          sequence: number;
          stopType: StopType;
          label: string | null;
          latitude: number;
          longitude: number;
          etaOffsetMinutes: number | null;
          students: Array<{
            studentId: string;
            student: {
              id: string;
              status: StudentStatus;
              archivedAt: Date | null;
              subscriptionType: StudentSubscriptionType;
            };
          }>;
        }>;
      };
      schedule: {
        id: string;
        direction: TripDirection;
        departureTime: string;
      };
      serviceDate: Date;
      timeZone: string;
      delayDefault: number;
    },
  ) {
    const existing = await tx.shuttleTrip.findUnique({
      where: {
        routeId_serviceDate_direction_scheduledDepartureTime: {
          routeId: input.route.id,
          serviceDate: input.serviceDate,
          direction: input.schedule.direction,
          scheduledDepartureTime: input.schedule.departureTime,
        },
      },
      include: { stops: true, students: true },
    });

    const trip =
      existing ??
      (await tx.shuttleTrip.create({
        data: {
          institutionId: input.institutionId,
          branchId: input.branchId,
          routeId: input.route.id,
          scheduleId: input.schedule.id,
          direction: input.schedule.direction,
          serviceDate: input.serviceDate,
          scheduledDepartureTime: input.schedule.departureTime,
          originLabel: input.route.originLabel,
          originLat: input.route.originLat,
          originLng: input.route.originLng,
          driverId: input.route.defaultDriverId,
          vehicleId: input.route.defaultVehicleId,
          attendantId: input.route.defaultAttendantId,
          delayThresholdMinutes:
            input.route.delayThresholdMinutes ?? input.delayDefault,
        },
        include: { stops: true, students: true },
      }));

    if (
      existing &&
      (existing.status !== TripStatus.SCHEDULED ||
        existing.stops.length > 0)
    ) {
      return { created: false, stopsCreated: 0, studentsCreated: 0 };
    }

    const routeStops = input.route.stops
      .filter((stop) => stop.direction === input.schedule.direction)
      .sort((a, b) => a.sequence - b.sequence);
    const createdStops = new Map<string, string>();
    let stopsCreated = 0;
    for (const stop of routeStops) {
      const created = await tx.tripStop.create({
        data: {
          tripId: trip.id,
          routeStopId: stop.id,
          sequence: stop.sequence,
          stopType: stop.stopType,
          label: stop.label,
          latitude: stop.latitude,
          longitude: stop.longitude,
          plannedArrivalAt: zonedDateTime(
            input.serviceDate,
            input.schedule.departureTime,
            input.timeZone,
            stop.etaOffsetMinutes ?? 0,
          ),
        },
      });
      createdStops.set(stop.id, created.id);
      stopsCreated += 1;
    }

    let studentsCreated = 0;
    const seen = new Set<string>();
    for (const stop of routeStops) {
      for (const link of stop.students) {
        if (seen.has(link.studentId)) {
          continue;
        }
        if (
          link.student.archivedAt ||
          link.student.status !== StudentStatus.ACTIVE
        ) {
          continue;
        }
        if (
          !studentMatchesDirection(
            link.student.subscriptionType,
            input.schedule.direction,
          )
        ) {
          continue;
        }
        seen.add(link.studentId);
        await tx.tripStudent.create({
          data: {
            tripId: trip.id,
            studentId: link.studentId,
            tripStopId: createdStops.get(stop.id),
          },
        });
        studentsCreated += 1;
      }
    }

    return {
      created: !existing,
      stopsCreated,
      studentsCreated,
    };
  }

  private async applyExceptions(
    db: Db,
    institutionId: string,
    serviceDate: Date,
    studentId?: string,
  ): Promise<number> {
    const exceptions = await db.studentRouteException.findMany({
      where: {
        date: serviceDate,
        ...(studentId ? { studentId } : {}),
        student: { institutionId, archivedAt: null },
      },
    });
    let applied = 0;
    for (const exception of exceptions) {
      const directions = exception.direction
        ? [exception.direction]
        : [TripDirection.OUTBOUND, TripDirection.INBOUND];
      for (const direction of directions) {
        const moved = await this.moveExceptionStudent(
          db,
          exception.studentId,
          exception.overrideRouteId,
          serviceDate,
          direction,
        );
        if (moved) {
          applied += 1;
        }
      }
    }
    return applied;
  }

  async restoreStudentToPrimary(
    institutionId: string,
    studentId: string,
    serviceDate: Date,
    direction: TripDirection | null,
    db: Db = this.prisma,
  ): Promise<void> {
    const assignment = await db.studentRouteAssignment.findFirst({
      where: { studentId, isActive: true },
    });
    const directions = direction
      ? [direction]
      : [TripDirection.OUTBOUND, TripDirection.INBOUND];
    for (const tripDirection of directions) {
      await db.tripStudent.deleteMany({
        where: {
          studentId,
          isException: true,
          trip: {
            institutionId,
            serviceDate,
            direction: tripDirection,
            status: { in: [TripStatus.SCHEDULED, TripStatus.CANCELLED] },
          },
        },
      });
      if (!assignment) {
        continue;
      }
      const primary = await db.shuttleTrip.findFirst({
        where: {
          institutionId,
          routeId: assignment.routeId,
          serviceDate,
          direction: tripDirection,
          status: TripStatus.SCHEDULED,
        },
        include: { stops: true },
        orderBy: { scheduledDepartureTime: 'asc' },
      });
      if (!primary) {
        continue;
      }
      const already = await db.tripStudent.findFirst({
        where: { tripId: primary.id, studentId },
      });
      if (already) {
        continue;
      }
      await db.tripStudent.create({
        data: {
          tripId: primary.id,
          studentId,
          isException: false,
          tripStopId:
            primary.stops.find((stop) => stop.stopType !== StopType.INSTITUTION)
              ?.id ?? primary.stops[0]?.id,
        },
      });
    }
  }

  private async moveExceptionStudent(
    db: Db,
    studentId: string,
    overrideRouteId: string,
    serviceDate: Date,
    direction: TripDirection,
  ): Promise<boolean> {
    const destination = await db.shuttleTrip.findFirst({
      where: {
        routeId: overrideRouteId,
        serviceDate,
        direction,
        status: { not: TripStatus.CANCELLED },
      },
      include: { stops: true },
      orderBy: { scheduledDepartureTime: 'asc' },
    });
    if (!destination) {
      return false;
    }

    await db.tripStudent.deleteMany({
      where: {
        studentId,
        trip: {
          serviceDate,
          direction,
          id: { not: destination.id },
          status: TripStatus.SCHEDULED,
        },
      },
    });

    const already = await db.tripStudent.findFirst({
      where: { tripId: destination.id, studentId },
    });
    if (already) {
      if (!already.isException) {
        await db.tripStudent.update({
          where: { id: already.id },
          data: { isException: true },
        });
      }
      return true;
    }

    await db.tripStudent.create({
      data: {
        tripId: destination.id,
        studentId,
        isException: true,
        tripStopId:
          destination.stops.find((stop) => stop.stopType !== StopType.INSTITUTION)
            ?.id ?? destination.stops[0]?.id,
      },
    });
    return true;
  }
}
