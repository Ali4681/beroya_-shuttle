import { HttpStatus, Injectable } from '@nestjs/common';
import {
  buildPaginationMeta,
  paginationOffset,
} from '../../common/dto/pagination.dto';
import { AppException } from '../../common/errors/app.exception';
import { todayInTimezone } from '../../common/utils/timezone';
import {
  IncidentStatus,
  IncidentType,
  OperationModel,
  Prisma,
  TripStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { mapIncident } from '../incidents/incident.mapper';
import { LiveLocationStore } from '../tracking/live-location.store';
import { PlatformSettingsService } from './platform-settings.service';
import { mapLiveTrip } from '../tracking/tracking.mapper';
import { isGpsStale } from '../tracking/tracking.rules';
import { mapTrip, mapTripEvent, mapTripStop } from '../trips/trip.mapper';
import { parseServiceDate } from '../trips/trip.rules';
import {
  AdminIncidentsQueryDto,
  AdminTripsQueryDto,
} from './dto/admin-operations.query';

const PLATFORM_TIMEZONE = 'Asia/Damascus';

/** A trip is operated by Beroya when its institution is Beroya-operated. */
const BEROYA_TRIP: Prisma.ShuttleTripWhereInput = {
  institution: {
    archivedAt: null,
    operationModel: OperationModel.BEROYA_OPERATED,
  },
};

const institutionSelect = {
  select: { id: true, name: true, displayName: true, operationModel: true },
} as const;

const tripInclude = {
  institution: institutionSelect,
  route: { select: { id: true, name: true, status: true } },
  branch: { select: { id: true, name: true } },
  driver: { include: { user: true } },
  vehicle: true,
  attendant: { include: { user: true } },
  _count: { select: { stops: true, students: true, events: true } },
} satisfies Prisma.ShuttleTripInclude;

const incidentInclude = {
  trip: {
    include: {
      institution: institutionSelect,
      route: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
      driver: { include: { user: true } },
      vehicle: true,
      attendant: { include: { user: true } },
    },
  },
  reportedByUser: { select: { id: true, fullName: true } },
  resolvedByUser: { select: { id: true, fullName: true } },
} satisfies Prisma.TripIncidentInclude;

type InstitutionRef = {
  id: string;
  name: string;
  displayName: string | null;
  operationModel: OperationModel;
};

function mapInstitutionRef(institution: InstitutionRef) {
  return {
    id: institution.id,
    name: institution.name,
    displayName: institution.displayName,
    operationModel: institution.operationModel,
  };
}

function delayedWhere(): Prisma.ShuttleTripWhereInput {
  return {
    OR: [{ delayMinutes: { gt: 0 } }, { delayDetectedAt: { not: null } }],
  };
}

@Injectable()
export class AdminOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly live: LiveLocationStore,
    private readonly platform: PlatformSettingsService,
  ) {}

  async listTrips(query: AdminTripsQueryDto) {
    const where: Prisma.ShuttleTripWhereInput = {
      AND: [
        BEROYA_TRIP,
        {
          serviceDate: this.serviceDate(query.date),
          ...(query.status ? { status: query.status } : {}),
          ...(query.institutionId
            ? { institutionId: query.institutionId }
            : {}),
        },
        ...(query.delayed ? [delayedWhere()] : []),
      ],
    };
    const [total, rows] = await Promise.all([
      this.prisma.shuttleTrip.count({ where }),
      this.prisma.shuttleTrip.findMany({
        where,
        include: tripInclude,
        orderBy: [{ scheduledDepartureTime: 'asc' }, { createdAt: 'asc' }],
        skip: paginationOffset(query.page, query.limit),
        take: query.limit,
      }),
    ]);
    return {
      data: rows.map((row) => ({
        ...mapTrip(row),
        institution: mapInstitutionRef(row.institution),
      })),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async tripStats(date?: string) {
    const serviceDate = this.serviceDate(date);
    const scoped = (extra: Prisma.ShuttleTripWhereInput = {}) => ({
      AND: [BEROYA_TRIP, { serviceDate }, extra],
    });
    const [total, scheduled, inProgress, completed, cancelled, delayed] =
      await Promise.all([
        this.prisma.shuttleTrip.count({ where: scoped() }),
        this.prisma.shuttleTrip.count({
          where: scoped({ status: TripStatus.SCHEDULED }),
        }),
        this.prisma.shuttleTrip.count({
          where: scoped({ status: TripStatus.IN_PROGRESS }),
        }),
        this.prisma.shuttleTrip.count({
          where: scoped({ status: TripStatus.COMPLETED }),
        }),
        this.prisma.shuttleTrip.count({
          where: scoped({ status: TripStatus.CANCELLED }),
        }),
        this.prisma.shuttleTrip.count({ where: scoped(delayedWhere()) }),
      ]);
    return {
      date: serviceDate,
      total,
      scheduled,
      inProgress,
      completed,
      cancelled,
      delayed,
    };
  }

  async getTrip(id: string) {
    const trip = await this.prisma.shuttleTrip.findFirst({
      where: { AND: [BEROYA_TRIP, { id }] },
      include: {
        ...tripInclude,
        stops: { orderBy: { sequence: 'asc' } },
        events: {
          include: { actorUser: true },
          orderBy: { occurredAt: 'asc' },
        },
        incidents: {
          include: {
            reportedByUser: { select: { id: true, fullName: true } },
            resolvedByUser: { select: { id: true, fullName: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!trip) {
      throw new AppException(
        'TRIP_NOT_FOUND',
        'Trip not found',
        HttpStatus.NOT_FOUND,
      );
    }
    const live = await this.decorateLive(trip);
    return {
      trip: {
        ...mapTrip(trip),
        institution: mapInstitutionRef(trip.institution),
      },
      live,
      stops: trip.stops.map(mapTripStop),
      events: trip.events.map(mapTripEvent),
      incidents: trip.incidents.map(mapIncident),
    };
  }

  async liveMap() {
    const trips = await this.prisma.shuttleTrip.findMany({
      where: {
        AND: [
          BEROYA_TRIP,
          {
            status: TripStatus.IN_PROGRESS,
            serviceDate: this.serviceDate(),
          },
        ],
      },
      include: {
        institution: institutionSelect,
        route: { select: { id: true, name: true } },
        stops: { orderBy: { sequence: 'asc' } },
        driver: { include: { user: true } },
        vehicle: true,
        incidents: {
          where: { status: IncidentStatus.OPEN },
          select: { id: true, type: true },
        },
      },
      orderBy: { scheduledDepartureTime: 'asc' },
    });
    const rows = [];
    for (const trip of trips) {
      rows.push({
        ...(await this.decorateLive(trip)),
        institution: mapInstitutionRef(trip.institution),
        driver: trip.driver
          ? {
              id: trip.driver.id,
              fullName: trip.driver.user.fullName,
              phone: trip.driver.user.phone,
            }
          : null,
        vehicle: trip.vehicle
          ? { id: trip.vehicle.id, plateNumber: trip.vehicle.plateNumber }
          : null,
        openIncidents: trip.incidents.map((incident) => incident.type),
      });
    }
    return rows;
  }

  async listIncidents(query: AdminIncidentsQueryDto) {
    const where: Prisma.TripIncidentWhereInput = {
      trip: {
        AND: [
          BEROYA_TRIP,
          query.institutionId ? { institutionId: query.institutionId } : {},
        ],
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
    const [total, rows] = await Promise.all([
      this.prisma.tripIncident.count({ where }),
      this.prisma.tripIncident.findMany({
        where,
        include: incidentInclude,
        orderBy: { createdAt: 'desc' },
        skip: paginationOffset(query.page, query.limit),
        take: query.limit,
      }),
    ]);
    return {
      data: rows.map((row) => ({
        ...mapIncident(row),
        institution: mapInstitutionRef(row.trip.institution),
      })),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async incidentStats() {
    const base = { trip: BEROYA_TRIP };
    const [openBreakdowns, openEmergencies, resolved, total] =
      await Promise.all([
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

  private serviceDate(date?: string) {
    return date ? parseServiceDate(date) : todayInTimezone(PLATFORM_TIMEZONE);
  }

  private async decorateLive(trip: Parameters<typeof mapLiveTrip>[0]['trip']) {
    const location = await this.live.readLocation(trip.id);
    const staleAfter = await this.platform.gpsStaleAfterSeconds(
      trip.institutionId,
    );
    const lastAt = location
      ? new Date(location.recordedAt)
      : trip.lastLocationAt;
    const gpsStale = isGpsStale(lastAt, staleAfter);
    return mapLiveTrip({ trip, location, gpsStale });
  }
}
