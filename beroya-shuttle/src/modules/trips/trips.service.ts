import { HttpStatus, Injectable } from '@nestjs/common';
import {
  buildPaginationMeta,
  paginationOffset,
} from '../../common/dto/pagination.dto';
import { AppException } from '../../common/errors/app.exception';
import { todayInTimezone } from '../../common/utils/timezone';
import { Prisma, TripStatus } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { GenerateTripsDto } from './dto/generate-trips.dto';
import { ListTripsQueryDto } from './dto/list-trips.query';
import { TripGenerationService } from './trip-generation.service';
import {
  mapTrip,
  mapTripEvent,
  mapTripStop,
  mapTripStudent,
} from './trip.mapper';
import { parseServiceDate } from './trip.rules';

const tripInclude = {
  route: { select: { id: true, name: true, status: true } },
  branch: { select: { id: true, name: true } },
  driver: { include: { user: true } },
  vehicle: true,
  attendant: { include: { user: true } },
  _count: { select: { stops: true, students: true, events: true } },
} as const;

@Injectable()
export class TripsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly generation: TripGenerationService,
  ) {}

  async list(institutionId: string, query: ListTripsQueryDto) {
    const timeZone = await this.timezone(institutionId);
    const serviceDate = query.date
      ? parseServiceDate(query.date)
      : todayInTimezone(timeZone);
    const where: Prisma.ShuttleTripWhereInput = {
      institutionId,
      serviceDate,
    };
    if (query.branchId) {
      where.branchId = query.branchId;
    }
    if (query.routeId) {
      where.routeId = query.routeId;
    }
    if (query.direction) {
      where.direction = query.direction;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.driverId) {
      where.driverId = query.driverId;
    }
    if (query.delayed) {
      where.OR = [
        { delayMinutes: { gt: 0 } },
        { delayDetectedAt: { not: null } },
      ];
    }
    const total = await this.prisma.shuttleTrip.count({ where });
    const rows = await this.prisma.shuttleTrip.findMany({
      where,
      include: tripInclude,
      orderBy: [{ scheduledDepartureTime: 'asc' }, { createdAt: 'asc' }],
      skip: paginationOffset(query.page, query.limit),
      take: query.limit,
    });
    return {
      data: rows.map(mapTrip),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async stats(institutionId: string, date?: string) {
    const timeZone = await this.timezone(institutionId);
    const serviceDate = date ? parseServiceDate(date) : todayInTimezone(timeZone);
    const base = { institutionId, serviceDate };
    const [total, scheduled, inProgress, completed, cancelled, delayed] =
      await Promise.all([
        this.prisma.shuttleTrip.count({ where: base }),
        this.prisma.shuttleTrip.count({
          where: { ...base, status: TripStatus.SCHEDULED },
        }),
        this.prisma.shuttleTrip.count({
          where: { ...base, status: TripStatus.IN_PROGRESS },
        }),
        this.prisma.shuttleTrip.count({
          where: { ...base, status: TripStatus.COMPLETED },
        }),
        this.prisma.shuttleTrip.count({
          where: { ...base, status: TripStatus.CANCELLED },
        }),
        this.prisma.shuttleTrip.count({
          where: {
            ...base,
            OR: [
              { delayMinutes: { gt: 0 } },
              { delayDetectedAt: { not: null } },
            ],
          },
        }),
      ]);
    return { date: serviceDate, total, scheduled, inProgress, completed, cancelled, delayed };
  }

  async generate(institutionId: string, dto: GenerateTripsDto) {
    return this.generation.generateForInstitution(
      institutionId,
      parseServiceDate(dto.date),
      dto.routeId,
    );
  }

  async getById(institutionId: string, id: string) {
    return mapTrip(await this.findOwned(institutionId, id));
  }

  async summary(institutionId: string, id: string) {
    const trip = await this.findOwned(institutionId, id);
    const [studentGroups, stopGroups] = await Promise.all([
      this.prisma.tripStudent.groupBy({
        by: ['status'],
        where: { tripId: id },
        _count: { _all: true },
      }),
      this.prisma.tripStop.groupBy({
        by: ['status'],
        where: { tripId: id },
        _count: { _all: true },
      }),
    ]);
    return {
      trip: mapTrip(trip),
      students: Object.fromEntries(
        studentGroups.map((row) => [row.status, row._count._all]),
      ),
      stops: Object.fromEntries(
        stopGroups.map((row) => [row.status, row._count._all]),
      ),
    };
  }

  async listStops(institutionId: string, id: string) {
    await this.findOwned(institutionId, id);
    const rows = await this.prisma.tripStop.findMany({
      where: { tripId: id },
      orderBy: { sequence: 'asc' },
    });
    return rows.map(mapTripStop);
  }

  async listStudents(institutionId: string, id: string) {
    await this.findOwned(institutionId, id);
    const rows = await this.prisma.tripStudent.findMany({
      where: { tripId: id },
      include: { student: true, tripStop: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(mapTripStudent);
  }

  async listEvents(institutionId: string, id: string) {
    await this.findOwned(institutionId, id);
    const rows = await this.prisma.tripEvent.findMany({
      where: { tripId: id },
      include: { actorUser: true },
      orderBy: { occurredAt: 'asc' },
    });
    return rows.map(mapTripEvent);
  }

  async findOwned(institutionId: string, id: string) {
    const trip = await this.prisma.shuttleTrip.findFirst({
      where: { id, institutionId },
      include: tripInclude,
    });
    if (!trip) {
      throw new AppException(
        'TRIP_NOT_FOUND',
        'Trip not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return trip;
  }

  private async timezone(institutionId: string): Promise<string> {
    const settings = await this.prisma.institutionSettings.findUnique({
      where: { institutionId },
    });
    return settings?.timezone ?? 'Asia/Damascus';
  }
}
