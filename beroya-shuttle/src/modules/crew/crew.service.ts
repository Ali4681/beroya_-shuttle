import { HttpStatus, Injectable } from '@nestjs/common';
import {
  buildPaginationMeta,
  paginationOffset,
} from '../../common/dto/pagination.dto';
import { AppException } from '../../common/errors/app.exception';
import { todayInTimezone } from '../../common/utils/timezone';
import {
  IncidentType,
  Prisma,
  TripEventType,
  TripStatus,
  TripStopStatus,
  TripStudentStatus,
} from '../../generated/prisma/client';
import { pathDistance } from '../../infra/routing/haversine';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { PlatformSettingsService } from '../admin/platform-settings.service';
import { REALTIME_EVENTS } from '../realtime/realtime.constants';
import { RealtimeService } from '../realtime/realtime.service';
import { withNoticeI18n } from '../admin/platform-settings';
import { AuditService } from '../shared/audit/audit.service';
import { NotificationService } from '../shared/notifications/notification.service';
import { LiveLocationStore } from '../tracking/live-location.store';
import { TripEventService } from '../trips/trip-event.service';
import {
  mapAttendantBoarded,
  mapAttendantMe,
  mapCrewLastLocation,
  mapCrewStops,
  mapCrewStudent,
  mapCrewTrip,
  mapDriverMe,
} from './crew.mapper';
import {
  assertCanMarkAttendantBoarded,
  assertServiceDateRange,
  assertTripCanComplete,
  assertTripCanStart,
  assertTripHasAttendant,
  assertTripInProgress,
  canApplyStudentStatus,
  distanceKmFromPings,
  emptyStudentStatusCounts,
  parentBoardingNotice,
  resolveWeekRange,
  StudentStatusCounts,
  studentEventType,
  studentStatusCountsWire,
  tallyStudentStatusCounts,
} from './crew.rules';
import { AttendantBoardedDto } from './dto/attendant-boarded.dto';
import { DriverTripHistoryQueryDto } from './dto/driver-trip-history.query';

const tripInclude = {
  route: { select: { id: true, name: true, status: true, code: true } },
  branch: { select: { id: true, name: true } },
  driver: { include: { user: true } },
  vehicle: true,
  attendant: { include: { user: true } },
  institution: { select: { operationModel: true } },
  incidents: {
    where: { type: IncidentType.EMERGENCY },
    select: { id: true },
    take: 1,
  },
  _count: { select: { stops: true, students: true } },
} satisfies Prisma.ShuttleTripInclude;

@Injectable()
export class CrewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: TripEventService,
    private readonly live: LiveLocationStore,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationService,
    private readonly platform: PlatformSettingsService,
    private readonly audit: AuditService,
  ) {}

  async driverMe(userId: string) {
    const driver = await this.requireDriver(userId);
    const platform = await this.platform.read();
    return {
      ...mapDriverMe(driver.user, driver),
      tracking: this.platform.trackingFor(platform.apps.driver, platform),
      platform: this.platform.clientOps(platform),
    };
  }

  async attendantMe(userId: string) {
    const attendant = await this.requireAttendant(userId);
    const platform = await this.platform.read();
    return {
      ...mapAttendantMe(attendant.user, attendant),
      tracking: this.platform.trackingFor(platform.apps.attendant, platform),
      platform: this.platform.clientOps(platform),
    };
  }

  async driverToday(userId: string) {
    const driver = await this.requireDriver(userId);
    return this.todayTrips({ driverId: driver.id }, driver.user.institutionId);
  }

  async driverHistory(userId: string, query: DriverTripHistoryQueryDto) {
    const driver = await this.requireDriver(userId);
    return this.crewHistory({ driverId: driver.id }, query);
  }

  async attendantHistory(userId: string, query: DriverTripHistoryQueryDto) {
    const attendant = await this.requireAttendant(userId);
    return this.crewHistory({ attendantId: attendant.id }, query);
  }

  async driverWeeklyStats(userId: string, weekStart?: string) {
    const driver = await this.requireDriver(userId);
    const institutionId =
      driver.institutionId ?? driver.user.institutionId ?? null;
    let timeZone = 'Asia/Damascus';
    if (institutionId) {
      const settings = await this.prisma.institutionSettings.findUnique({
        where: { institutionId },
      });
      timeZone = settings?.timezone ?? timeZone;
    }
    const range = resolveWeekRange(timeZone, weekStart);

    const base = {
      driverId: driver.id,
      serviceDate: { gte: range.weekStart, lte: range.weekEnd },
    };

    const [completedTrips, cancelledTrips, inProgressTrips, distanceAgg] =
      await Promise.all([
        this.prisma.shuttleTrip.count({
          where: { ...base, status: TripStatus.COMPLETED },
        }),
        this.prisma.shuttleTrip.count({
          where: { ...base, status: TripStatus.CANCELLED },
        }),
        this.prisma.shuttleTrip.count({
          where: { ...base, status: TripStatus.IN_PROGRESS },
        }),
        this.prisma.shuttleTrip.aggregate({
          where: { ...base, status: TripStatus.COMPLETED },
          _sum: { distanceKm: true },
        }),
      ]);

    const totalDistance = distanceAgg._sum.distanceKm ?? 0;

    return {
      weekStart: range.weekStartKey,
      weekEnd: range.weekEndKey,
      completedTrips,
      totalDistanceKm: Math.round(totalDistance * 10) / 10,
      cancelledTrips,
      inProgressTrips,
    };
  }

  async attendantToday(userId: string) {
    const attendant = await this.requireAttendant(userId);
    return this.todayTrips(
      { attendantId: attendant.id },
      attendant.institutionId,
    );
  }

  private async crewHistory(
    assigned: { driverId?: string; attendantId?: string },
    query: DriverTripHistoryQueryDto,
  ) {
    const { fromDate, toDate } = assertServiceDateRange(query.from, query.to);
    const where: Prisma.ShuttleTripWhereInput = {
      ...assigned,
      serviceDate: { gte: fromDate, lte: toDate },
    };
    if (query.status?.length) {
      where.status = { in: query.status };
    }

    const total = await this.prisma.shuttleTrip.count({ where });
    const rows = await this.prisma.shuttleTrip.findMany({
      where,
      include: tripInclude,
      orderBy: [
        { serviceDate: 'desc' },
        { scheduledDepartureTime: 'desc' },
      ],
      skip: paginationOffset(query.page, query.limit),
      take: query.limit,
    });

    const counts = await this.studentCountsByTripIds(rows.map((row) => row.id));
    return {
      data: rows.map((row) =>
        mapCrewTrip(row, counts.get(row.id) ?? emptyStudentStatusCounts()),
      ),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async driverTrip(userId: string, tripId: string) {
    const trip = await this.requireDriverTrip(userId, tripId);
    return this.mapCrewTripWithCounts(trip);
  }

  async attendantTrip(userId: string, tripId: string) {
    const trip = await this.requireAttendantTrip(userId, tripId);
    return this.mapCrewTripWithCounts(trip);
  }

  async driverStops(userId: string, tripId: string) {
    await this.requireDriverTrip(userId, tripId);
    return this.listStops(tripId);
  }

  async attendantStops(userId: string, tripId: string) {
    await this.requireAttendantTrip(userId, tripId);
    return this.listStops(tripId);
  }

  async driverStudents(userId: string, tripId: string) {
    await this.requireDriverTrip(userId, tripId);
    return this.listTripStudents(tripId);
  }

  async attendantStudents(userId: string, tripId: string) {
    await this.requireAttendantTrip(userId, tripId);
    return this.listTripStudents(tripId);
  }

  private async listTripStudents(tripId: string) {
    const rows = await this.prisma.tripStudent.findMany({
      where: { tripId },
      include: {
        student: {
          select: { id: true, fullName: true, grade: true, section: true },
        },
        tripStop: {
          select: { id: true, sequence: true, label: true, stopType: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(mapCrewStudent);
  }

  private async studentCountsForTrip(
    tripId: string,
  ): Promise<StudentStatusCounts> {
    const map = await this.studentCountsByTripIds([tripId]);
    return map.get(tripId) ?? emptyStudentStatusCounts();
  }

  private async resolveCrewLastLocation(
    trip: Pick<
      Parameters<typeof mapCrewTrip>[0],
      | 'id'
      | 'institutionId'
      | 'lastLocationLat'
      | 'lastLocationLng'
      | 'lastLocationAt'
    >,
  ) {
    const [live, staleAfterSeconds] = await Promise.all([
      this.live.readLocation(trip.id),
      this.platform.gpsStaleAfterSeconds(trip.institutionId),
    ]);
    return mapCrewLastLocation({ live, trip, staleAfterSeconds });
  }

  private async mapCrewTripWithCounts(
    trip: Parameters<typeof mapCrewTrip>[0],
  ) {
    const [counts, lastLocation] = await Promise.all([
      this.studentCountsForTrip(trip.id),
      this.resolveCrewLastLocation(trip),
    ]);
    return mapCrewTrip(trip, counts, lastLocation);
  }

  async driverTripLocation(userId: string, tripId: string) {
    const trip = await this.requireDriverTrip(userId, tripId);
    return this.resolveCrewLastLocation(trip);
  }

  async attendantTripLocation(userId: string, tripId: string) {
    const trip = await this.requireAttendantTrip(userId, tripId);
    return this.resolveCrewLastLocation(trip);
  }

  private async studentCountsByTripIds(
    tripIds: string[],
  ): Promise<Map<string, StudentStatusCounts>> {
    const result = new Map<string, StudentStatusCounts>();
    for (const id of tripIds) {
      result.set(id, emptyStudentStatusCounts());
    }
    if (tripIds.length === 0) {
      return result;
    }
    const rows = await this.prisma.tripStudent.groupBy({
      by: ['tripId', 'status'],
      where: { tripId: { in: tripIds } },
      _count: { _all: true },
    });
    const byTrip = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = byTrip.get(row.tripId) ?? [];
      list.push(row);
      byTrip.set(row.tripId, list);
    }
    for (const [tripId, list] of byTrip) {
      result.set(tripId, tallyStudentStatusCounts(list));
    }
    return result;
  }

  async setAttendantBoarded(
    userId: string,
    tripId: string,
    dto: AttendantBoardedDto,
  ) {
    const trip = await this.requireDriverTrip(userId, tripId);
    assertCanMarkAttendantBoarded(trip.status);
    assertTripHasAttendant(trip.attendantId);

    const boarded = dto.boarded ?? true;
    if (trip.attendantBoarded === boarded) {
      return mapAttendantBoarded(trip);
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.shuttleTrip.update({
        where: { id: tripId },
        data: boarded
          ? {
              attendantBoarded: true,
              attendantBoardedAt: now,
              attendantBoardedByUserId: userId,
            }
          : {
              attendantBoarded: false,
              attendantBoardedAt: null,
              attendantBoardedByUserId: null,
            },
        include: tripInclude,
      });
      await this.events.record(
        {
          tripId,
          type: boarded
            ? TripEventType.ATTENDANT_BOARDED
            : TripEventType.ATTENDANT_BOARDING_CLEARED,
          actorUserId: userId,
          title: boarded
            ? 'Attendant boarded the bus'
            : 'Attendant boarding cleared',
          data: {
            attendantId: trip.attendantId,
            attendantUserId: trip.attendant?.userId ?? null,
            boarded,
          },
          occurredAt: now,
        },
        tx,
      );
      await this.audit.record(
        {
          actorUserId: userId,
          institutionId: trip.institutionId,
          action: boarded
            ? 'trip.attendant_boarded'
            : 'trip.attendant_boarding_cleared',
          entityType: 'ShuttleTrip',
          entityId: tripId,
          before: {
            attendantBoarded: trip.attendantBoarded,
            attendantBoardedAt: trip.attendantBoardedAt,
            attendantBoardedByUserId: trip.attendantBoardedByUserId,
          },
          after: {
            attendantBoarded: next.attendantBoarded,
            attendantBoardedAt: next.attendantBoardedAt,
            attendantBoardedByUserId: next.attendantBoardedByUserId,
          },
        },
        tx,
      );
      return next;
    });

    this.realtime.emitTrip(
      REALTIME_EVENTS.TRIP_ATTENDANT_BOARDED,
      {
        institutionId: trip.institutionId,
        tripId,
        routeId: trip.routeId,
        operationModel: trip.institution.operationModel,
      },
      {
        attendant_boarded: updated.attendantBoarded,
        attendant_boarded_at: updated.attendantBoardedAt,
        attendant_id: updated.attendantId,
        attendant_user_id: updated.attendant?.userId ?? null,
      },
    );

    return mapAttendantBoarded(updated);
  }

  async start(userId: string, tripId: string) {
    const trip = await this.requireDriverTrip(userId, tripId);
    assertTripCanStart(trip.status);
    if (trip.status === TripStatus.IN_PROGRESS) {
      return this.mapCrewTripWithCounts(trip);
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.shuttleTrip.update({
        where: { id: tripId },
        data: { status: TripStatus.IN_PROGRESS, startedAt: now },
        include: tripInclude,
      });
      await this.events.record(
        {
          tripId,
          type: TripEventType.TRIP_STARTED,
          actorUserId: userId,
          title: 'Trip started',
          occurredAt: now,
        },
        tx,
      );
      return next;
    });
    await this.live.addLiveTrip(trip.institutionId, tripId);
    this.realtime.emitTrip(REALTIME_EVENTS.TRIP_STARTED, {
      institutionId: trip.institutionId,
      tripId,
      routeId: trip.routeId,
      operationModel: trip.institution.operationModel,
    });
    if (updated.attendant?.userId) {
      await this.notifications.notifyAssignedAttendant({
        actorUserId: userId,
        institutionId: trip.institutionId,
        routeId: trip.routeId,
        branchId: trip.branchId,
        attendantUserId: updated.attendant.userId,
        title: 'بدأت الرحلة',
        body: `بدأ السائق رحلة ${updated.route?.name ?? 'اليوم'}`,
        data: { tripId, routeId: trip.routeId, type: 'TRIP_STARTED' },
      });
    }
    return this.mapCrewTripWithCounts(updated);
  }

  async complete(userId: string, tripId: string) {
    const trip = await this.requireDriverTrip(userId, tripId);
    assertTripCanComplete(trip.status);
    if (trip.status === TripStatus.COMPLETED) {
      return this.mapCrewTripWithCounts(trip);
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const pings = await tx.tripLocationPing.findMany({
        where: { tripId },
        orderBy: { recordedAt: 'asc' },
        select: { latitude: true, longitude: true },
      });
      const distanceKm = distanceKmFromPings(pings, pathDistance);

      const next = await tx.shuttleTrip.update({
        where: { id: tripId },
        data: {
          status: TripStatus.COMPLETED,
          completedAt: now,
          distanceKm,
        },
        include: tripInclude,
      });
      await this.events.record(
        {
          tripId,
          type: TripEventType.TRIP_COMPLETED,
          actorUserId: userId,
          title: 'Trip completed',
          occurredAt: now,
        },
        tx,
      );
      return next;
    });
    await this.live.removeLiveTrip(trip.institutionId, tripId);
    this.realtime.emitTrip(REALTIME_EVENTS.TRIP_COMPLETED, {
      institutionId: trip.institutionId,
      tripId,
      routeId: trip.routeId,
      operationModel: trip.institution.operationModel,
    });
    return this.mapCrewTripWithCounts(updated);
  }

  async arrive(userId: string, tripId: string, stopId: string) {
    const trip = await this.requireDriverTrip(userId, tripId);
    assertTripInProgress(trip.status);
    const stop = await this.prisma.tripStop.findFirst({
      where: { id: stopId, tripId },
    });
    if (!stop) {
      throw new AppException(
        'STOP_NOT_FOUND',
        'Stop not found',
        HttpStatus.NOT_FOUND,
      );
    }
    if (stop.status === TripStopStatus.ARRIVED) {
      return mapCrewStops([stop])[0];
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.tripStop.update({
        where: { id: stopId },
        data: { status: TripStopStatus.ARRIVED, arrivedAt: stop.arrivedAt ?? now },
      });
      await this.events.record(
        {
          tripId,
          type: TripEventType.STOP_ARRIVED,
          actorUserId: userId,
          title: `Arrived at ${stop.label}`,
          data: { stopId, sequence: stop.sequence },
          occurredAt: now,
        },
        tx,
      );
      return next;
    });
    this.realtime.emitTrip(
      REALTIME_EVENTS.TRIP_STOP_ARRIVED,
      {
        institutionId: trip.institutionId,
        tripId,
        routeId: trip.routeId,
        operationModel: trip.institution.operationModel,
      },
      {
        stop_id: stopId,
        status: TripStopStatus.ARRIVED,
        arrived_at: updated.arrivedAt,
      },
    );
    return mapCrewStops([updated])[0];
  }

  async markStudent(
    userId: string,
    tripId: string,
    tripStudentId: string,
    status: TripStudentStatus,
  ) {
    const trip = await this.requireAttendantTrip(userId, tripId);
    assertTripInProgress(trip.status);
    const row = await this.prisma.tripStudent.findFirst({
      where: { id: tripStudentId, tripId },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            grade: true,
            section: true,
            guardianUserId: true,
          },
        },
        tripStop: {
          select: { id: true, sequence: true, label: true, stopType: true },
        },
      },
    });
    if (!row) {
      throw new AppException(
        'TRIP_STUDENT_NOT_FOUND',
        'Trip student not found',
        HttpStatus.NOT_FOUND,
      );
    }
    if (!canApplyStudentStatus(row.status, status)) {
      throw new AppException(
        'INVALID_STUDENT_TRANSITION',
        'This student status change is not allowed',
        HttpStatus.CONFLICT,
      );
    }
    if (row.status === status) {
      return mapCrewStudent(row);
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.tripStudent.update({
        where: { id: tripStudentId },
        data: {
          status,
          markedByUserId: userId,
          boardedAt:
            status === TripStudentStatus.BOARDED
              ? (row.boardedAt ?? now)
              : row.boardedAt,
          notBoardedAt:
            status === TripStudentStatus.NOT_BOARDED
              ? (row.notBoardedAt ?? now)
              : row.notBoardedAt,
          droppedOffAt:
            status === TripStudentStatus.DROPPED_OFF
              ? (row.droppedOffAt ?? now)
              : row.droppedOffAt,
        },
        include: {
          student: {
            select: {
              id: true,
              fullName: true,
              grade: true,
              section: true,
              guardianUserId: true,
            },
          },
          tripStop: {
            select: { id: true, sequence: true, label: true, stopType: true },
          },
        },
      });
      await this.events.record(
        {
          tripId,
          type: studentEventType(status),
          actorUserId: userId,
          title: `${next.student.fullName} ${status.toLowerCase().replaceAll('_', ' ')}`,
          data: {
            tripStudentId,
            studentId: row.studentId,
            status,
            source: 'ATTENDANT',
          },
          occurredAt: now,
        },
        tx,
      );
      return next;
    });
    const studentCounts = await this.studentCountsForTrip(tripId);
    this.realtime.emitTrip(
      REALTIME_EVENTS.TRIP_STUDENT_STATUS_CHANGED,
      {
        institutionId: trip.institutionId,
        tripId,
        routeId: trip.routeId,
        operationModel: trip.institution.operationModel,
      },
      {
        trip_student_id: tripStudentId,
        student_id: row.studentId,
        student_name: updated.student.fullName,
        status,
        trip_stop_id: updated.tripStopId ?? row.tripStopId ?? null,
        source: 'ATTENDANT',
        student_counts: studentStatusCountsWire(studentCounts),
      },
    );

    const notice = parentBoardingNotice(status, updated.student.fullName);
    if (notice && updated.student.guardianUserId) {
      await this.notifications.notifyGuardian({
        actorUserId: userId,
        institutionId: trip.institutionId,
        routeId: trip.routeId,
        branchId: trip.branchId,
        guardianUserId: updated.student.guardianUserId,
        title: notice.titleAr,
        body: notice.bodyAr,
        data: withNoticeI18n(
          {
            type: notice.type,
            status,
            source: 'ATTENDANT',
            tripId,
            tripStudentId,
            studentId: row.studentId,
            studentName: updated.student.fullName,
            messageAr: notice.bodyAr,
            messageEn: notice.bodyEn,
          },
          {
            title: notice.titleAr,
            body: notice.bodyAr,
            i18n: {
              titleAr: notice.titleAr,
              bodyAr: notice.bodyAr,
              titleEn: notice.titleEn,
              bodyEn: notice.bodyEn,
            },
          },
        ),
      });
    }

    return mapCrewStudent(updated);
  }

  private async todayTrips(
    assigned: { driverId?: string; attendantId?: string },
    institutionId: string | null,
  ) {
    if (!institutionId) {
      return [];
    }
    const settings = await this.prisma.institutionSettings.findUnique({
      where: { institutionId },
    });
    const serviceDate = todayInTimezone(settings?.timezone ?? 'Asia/Damascus');
    const rows = await this.prisma.shuttleTrip.findMany({
      where: { ...assigned, serviceDate },
      include: tripInclude,
      orderBy: { scheduledDepartureTime: 'asc' },
    });
    const tripIds = rows.map((row) => row.id);
    const [counts, locations] = await Promise.all([
      this.studentCountsByTripIds(tripIds),
      Promise.all(rows.map((row) => this.resolveCrewLastLocation(row))),
    ]);
    return rows.map((row, index) =>
      mapCrewTrip(
        row,
        counts.get(row.id) ?? emptyStudentStatusCounts(),
        locations[index] ?? null,
      ),
    );
  }

  private async listStops(tripId: string) {
    const stops = await this.prisma.tripStop.findMany({
      where: { tripId },
      orderBy: { sequence: 'asc' },
    });
    return mapCrewStops(stops);
  }

  private async requireDriver(userId: string) {
    const driver = await this.prisma.driverProfile.findFirst({
      where: { userId, archivedAt: null },
      include: { user: true },
    });
    if (!driver) {
      throw new AppException(
        'DRIVER_NOT_FOUND',
        'Driver profile not found',
        HttpStatus.FORBIDDEN,
      );
    }
    return driver;
  }

  private async requireAttendant(userId: string) {
    const attendant = await this.prisma.attendantProfile.findFirst({
      where: { userId, archivedAt: null },
      include: { user: true },
    });
    if (!attendant) {
      throw new AppException(
        'ATTENDANT_NOT_FOUND',
        'Attendant profile not found',
        HttpStatus.FORBIDDEN,
      );
    }
    return attendant;
  }

  private async requireDriverTrip(userId: string, tripId: string) {
    const driver = await this.requireDriver(userId);
    const trip = await this.prisma.shuttleTrip.findUnique({
      where: { id: tripId },
      include: tripInclude,
    });
    if (!trip || trip.driverId !== driver.id) {
      throw new AppException(
        'TRIP_NOT_FOUND',
        'Trip not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return trip;
  }

  private async requireAttendantTrip(userId: string, tripId: string) {
    const attendant = await this.requireAttendant(userId);
    const trip = await this.prisma.shuttleTrip.findUnique({
      where: { id: tripId },
      include: tripInclude,
    });
    if (!trip || trip.attendantId !== attendant.id) {
      throw new AppException(
        'TRIP_NOT_FOUND',
        'Trip not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return trip;
  }
}
