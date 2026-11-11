import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import {
  buildPaginationMeta,
  paginationOffset,
} from '../../common/dto/pagination.dto';
import { todayInTimezone } from '../../common/utils/timezone';
import {
  IncidentStatus,
  IncidentType,
  Prisma,
  TripEventType,
  TripStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { REALTIME_EVENTS } from '../realtime/realtime.constants';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationService } from '../shared/notifications/notification.service';
import { PlatformSettingsService } from '../admin/platform-settings.service';
import { packNotice, withNoticeI18n } from '../admin/platform-settings';
import { isGpsStale } from '../tracking/tracking.rules';
import { parseServiceDate } from '../trips/trip.rules';
import { TripEventService } from '../trips/trip-event.service';
import { ListIncidentsQueryDto } from './dto/list-incidents.query';
import { ReportIncidentDto } from './dto/report-incident.dto';
import { mapIncident } from './incident.mapper';
import {
  assertCanReportIncident,
  assertIncidentOpen,
} from './incident.rules';

const tripInclude = {
  route: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true } },
  driver: { include: { user: true } },
  vehicle: true,
  attendant: { include: { user: true } },
} satisfies Prisma.ShuttleTripInclude;

const incidentInclude = {
  trip: { include: tripInclude },
  reportedByUser: { select: { id: true, fullName: true } },
  resolvedByUser: { select: { id: true, fullName: true } },
} satisfies Prisma.TripIncidentInclude;

@Injectable()
export class IncidentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: TripEventService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationService,
    private readonly platform: PlatformSettingsService,
  ) {}

  async reportBreakdown(
    userId: string,
    tripId: string,
    dto: ReportIncidentDto,
  ) {
    return this.report(userId, tripId, IncidentType.BREAKDOWN, dto, 'driver');
  }

  async reportEmergency(
    userId: string,
    tripId: string,
    dto: ReportIncidentDto,
    actor: 'driver' | 'attendant',
  ) {
    return this.report(userId, tripId, IncidentType.EMERGENCY, dto, actor);
  }

  async list(institutionId: string, query: ListIncidentsQueryDto) {
    const where: Prisma.TripIncidentWhereInput = {
      trip: {
        institutionId,
        ...(query.routeId ? { routeId: query.routeId } : {}),
        ...(query.branchId ? { branchId: query.branchId } : {}),
      },
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom
                ? { gte: parseServiceDate(query.dateFrom) }
                : {}),
              ...(query.dateTo
                ? {
                    lt: new Date(
                      parseServiceDate(query.dateTo).getTime() +
                        24 * 60 * 60 * 1000,
                    ),
                  }
                : {}),
            },
          }
        : {}),
    };
    const total = await this.prisma.tripIncident.count({ where });
    const rows = await this.prisma.tripIncident.findMany({
      where,
      include: incidentInclude,
      orderBy: { createdAt: 'desc' },
      skip: paginationOffset(query.page, query.limit),
      take: query.limit,
    });
    return {
      data: rows.map(mapIncident),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async stats(institutionId: string) {
    const base = { trip: { institutionId } };
    const [openBreakdowns, openEmergencies, resolved, total] =
      await this.prisma.$transaction([
        this.prisma.tripIncident.count({
          where: {
            ...base,
            type: IncidentType.BREAKDOWN,
            status: IncidentStatus.OPEN,
          },
        }),
        this.prisma.tripIncident.count({
          where: {
            ...base,
            type: IncidentType.EMERGENCY,
            status: IncidentStatus.OPEN,
          },
        }),
        this.prisma.tripIncident.count({
          where: { ...base, status: IncidentStatus.RESOLVED },
        }),
        this.prisma.tripIncident.count({ where: base }),
      ]);
    return { openBreakdowns, openEmergencies, resolved, total };
  }

  async getById(institutionId: string, id: string) {
    return mapIncident(await this.findOwned(institutionId, id));
  }

  async resolve(
    actorUserId: string,
    institutionId: string,
    id: string,
    notes: string,
  ) {
    const current = await this.findOwned(institutionId, id);
    assertIncidentOpen(current.status);
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.tripIncident.update({
        where: { id },
        data: {
          status: IncidentStatus.RESOLVED,
          resolvedAt: now,
          resolvedByUserId: actorUserId,
          resolutionNotes: notes,
        },
        include: incidentInclude,
      });
      await this.events.record(
        {
          tripId: current.tripId,
          type: TripEventType.INCIDENT_RESOLVED,
          actorUserId,
          title: 'Incident resolved',
          description: notes,
          data: { incidentId: id, type: current.type },
        },
        tx,
      );
      return next;
    });
    this.realtime.emitTrip(REALTIME_EVENTS.INCIDENT_RESOLVED, {
      institutionId,
      tripId: current.tripId,
      routeId: current.trip.routeId,
      operationModel: current.trip.institution.operationModel,
    });
    return mapIncident(updated);
  }

  async attention(institutionId: string) {
    const settings = await this.prisma.institutionSettings.findUnique({
      where: { institutionId },
    });
    const timeZone = settings?.timezone ?? 'Asia/Damascus';
    const staleAfter = await this.platform.gpsStaleAfterSeconds(institutionId);
    const today = todayInTimezone(timeZone);

    const [delayed, openIncidents, liveTrips] = await Promise.all([
      this.prisma.shuttleTrip.findMany({
        where: {
          institutionId,
          status: TripStatus.IN_PROGRESS,
          OR: [{ delayMinutes: { gt: 0 } }, { delayDetectedAt: { not: null } }],
        },
        include: { route: { select: { id: true, name: true } } },
        orderBy: { delayMinutes: 'desc' },
      }),
      this.prisma.tripIncident.findMany({
        where: {
          status: IncidentStatus.OPEN,
          trip: { institutionId },
        },
        include: incidentInclude,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.shuttleTrip.findMany({
        where: { institutionId, status: TripStatus.IN_PROGRESS, serviceDate: today },
        include: { route: { select: { id: true, name: true } } },
      }),
    ]);

    const gpsStale = liveTrips.filter((trip) =>
      isGpsStale(trip.lastLocationAt, staleAfter),
    );

    return {
      delayed: delayed.map((trip) => ({
        id: trip.id,
        routeId: trip.routeId,
        routeName: trip.route.name,
        delayMinutes: trip.delayMinutes,
      })),
      openBreakdowns: openIncidents
        .filter((row) => row.type === IncidentType.BREAKDOWN)
        .map(mapIncident),
      openEmergencies: openIncidents
        .filter((row) => row.type === IncidentType.EMERGENCY)
        .map(mapIncident),
      gpsStale: gpsStale.map((trip) => ({
        id: trip.id,
        routeId: trip.routeId,
        routeName: trip.route.name,
        lastLocationAt: trip.lastLocationAt,
      })),
    };
  }

  private async report(
    userId: string,
    tripId: string,
    type: IncidentType,
    dto: ReportIncidentDto,
    actor: 'driver' | 'attendant',
  ) {
    const trip = await this.prisma.shuttleTrip.findUnique({
      where: { id: tripId },
      include: {
        ...tripInclude,
        institution: { select: { operationModel: true } },
      },
    });
    if (!trip) {
      throw new AppException(
        'TRIP_NOT_FOUND',
        'Trip not found',
        HttpStatus.NOT_FOUND,
      );
    }
    assertCanReportIncident(trip.status);
    await this.assertAssigned(userId, trip, actor);

    const eventType =
      type === IncidentType.BREAKDOWN
        ? TripEventType.BREAKDOWN_REPORTED
        : TripEventType.EMERGENCY_TRIGGERED;
    const title =
      type === IncidentType.BREAKDOWN
        ? 'Vehicle breakdown reported'
        : 'Emergency triggered';

    const created = await this.prisma.$transaction(async (tx) => {
      const incident = await tx.tripIncident.create({
        data: {
          tripId,
          type,
          reportedByUserId: userId,
          description: dto.description,
          latitude: dto.latitude,
          longitude: dto.longitude,
        },
        include: incidentInclude,
      });
      await this.events.record(
        {
          tripId,
          type: eventType,
          actorUserId: userId,
          title,
          description: dto.description,
          data: {
            incidentId: incident.id,
            latitude: dto.latitude,
            longitude: dto.longitude,
          },
        },
        tx,
      );
      if (type === IncidentType.EMERGENCY) {
        const notice = packNotice((await this.platform.read()).templates.emergency);
        const description = dto.description?.trim();
        const body = description || notice.body;
        const i18nNotice = description
          ? {
              ...notice,
              body,
              i18n: {
                ...notice.i18n,
                bodyAr: description,
                bodyEn: description,
              },
            }
          : notice;
        await this.notifications.notifyInstitutionAdmins(
          {
            actorUserId: userId,
            institutionId: trip.institutionId,
            branchId: trip.branchId,
            routeId: trip.routeId,
            title: i18nNotice.title,
            body: i18nNotice.body,
            data: withNoticeI18n(
              {
                kind: 'emergency',
                tripId,
                routeId: trip.routeId,
                routeName: trip.route?.name,
                vehicle: trip.vehicle
                  ? { id: trip.vehicle.id, plateNumber: trip.vehicle.plateNumber }
                  : null,
                driver: trip.driver
                  ? {
                      id: trip.driver.id,
                      fullName: trip.driver.user.fullName,
                    }
                  : null,
                attendant: trip.attendant
                  ? {
                      id: trip.attendant.id,
                      fullName: trip.attendant.user.fullName,
                    }
                  : null,
                location: { latitude: dto.latitude, longitude: dto.longitude },
              },
              i18nNotice,
            ),
          },
          tx,
        );
      }
      return incident;
    });

    this.realtime.emitTrip(
      type === IncidentType.BREAKDOWN
        ? REALTIME_EVENTS.TRIP_BREAKDOWN_CREATED
        : REALTIME_EVENTS.TRIP_EMERGENCY_CREATED,
      {
        institutionId: trip.institutionId,
        tripId,
        routeId: trip.routeId,
        operationModel: trip.institution.operationModel,
      },
      { incident_id: created.id, type },
    );

    const still = await this.prisma.shuttleTrip.findUnique({
      where: { id: tripId },
      select: { id: true, status: true },
    });
    return {
      ...mapIncident(created),
      tripId: still?.id,
      tripStatus: still?.status,
    };
  }

  private async assertAssigned(
    userId: string,
    trip: { driverId: string | null; attendantId: string | null },
    actor: 'driver' | 'attendant',
  ) {
    if (actor === 'driver') {
      const driver = await this.prisma.driverProfile.findFirst({
        where: { userId, archivedAt: null },
      });
      if (!driver || trip.driverId !== driver.id) {
        throw new AppException(
          'DRIVER_NOT_ASSIGNED',
          'You are not assigned to this trip',
          HttpStatus.FORBIDDEN,
        );
      }
      return;
    }
    const attendant = await this.prisma.attendantProfile.findFirst({
      where: { userId, archivedAt: null },
    });
    if (!attendant || trip.attendantId !== attendant.id) {
      throw new AppException(
        'ATTENDANT_NOT_ASSIGNED',
        'You are not assigned to this trip',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private async findOwned(institutionId: string, id: string) {
    const row = await this.prisma.tripIncident.findFirst({
      where: { id, trip: { institutionId } },
      include: {
        ...incidentInclude,
        trip: {
          include: {
            ...tripInclude,
            institution: { select: { operationModel: true, id: true } },
          },
        },
      },
    });
    if (!row) {
      throw new AppException(
        'INCIDENT_NOT_FOUND',
        'Incident not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }
}
