import { HttpStatus, Injectable } from '@nestjs/common';
import {
  buildPaginationMeta,
  PaginationDto,
  paginationOffset,
} from '../../../common/dto/pagination.dto';
import { AppException } from '../../../common/errors/app.exception';
import { assertEmailAvailable } from '../../../common/utils/email-availability';
import { assertEmailAndPassword, hashPassword, normalizeEmail } from '../../../common/utils/password';
import { normalizePhone } from '../../../common/utils/phone';
import {
  OwnerType,
  Prisma,
  ResourceStatus,
  ShuttleRole,
  TripStatus,
  UserStatus,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { AUDIT, ENTITY } from '../../admin/admin.constants';
import { AuditService } from '../audit/audit.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { ListDriversQueryDto } from './dto/list-drivers.query';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { mapDriver, mapResourceTrip } from './resource.mapper';
import {
  assertInstitutionCanMutate,
  buildResourceStats,
  canSeeBeroyaResources,
  isBeroyaFleetOwner,
} from './resource.rules';
import type { NestedVehicleDto } from './dto/nested-resource.dto';

const driverInclude = {
  user: true,
  primaryVehicle: {
    select: {
      id: true,
      plateNumber: true,
      vehicleType: true,
      capacity: true,
      licenseExpiry: true,
      insuranceExpiry: true,
      ownerType: true,
      status: true,
    },
  },
  defaultForRoutes: {
    select: { id: true, name: true, status: true },
  },
  _count: { select: { defaultForRoutes: true } },
} as const;

@Injectable()
export class DriversService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listAdmin(query: ListDriversQueryDto) {
    return this.list({
      query,
      where: {
        archivedAt: null,
        ownerType: OwnerType.BEROYA,
        ...(query.institutionId ? { institutionId: query.institutionId } : {}),
      },
    });
  }

  async listForInstitution(institutionId: string, query: ListDriversQueryDto) {
    const institution = await this.requireInstitution(institutionId);
    const seeBeroya = canSeeBeroyaResources(institution.operationModel);
    const where: Prisma.DriverProfileWhereInput = {
      archivedAt: null,
      OR: [
        { institutionId, ownerType: OwnerType.INSTITUTION },
        ...(seeBeroya
          ? [
              {
                ownerType: OwnerType.BEROYA,
                OR: [{ institutionId: null }, { institutionId }],
                status: ResourceStatus.ACTIVE,
              },
            ]
          : []),
      ],
    };
    return this.list({ query, where });
  }

  async statsForInstitution(institutionId: string) {
    const rows = await this.prisma.driverProfile.findMany({
      where: {
        institutionId,
        ownerType: OwnerType.INSTITUTION,
        archivedAt: null,
      },
      include: { _count: { select: { defaultForRoutes: true } } },
    });
    return buildResourceStats(
      rows.map((row) => ({
        status: row.status,
        assigned: row._count.defaultForRoutes > 0,
      })),
    );
  }

  async createBeroya(actorUserId: string, dto: CreateDriverDto) {
    const institutionId = dto.institutionId
      ? await this.requireBeroyaOperatedInstitution(dto.institutionId)
      : null;
    return this.create(actorUserId, dto, {
      ownerType: OwnerType.BEROYA,
      institutionId,
    });
  }

  async createForInstitution(
    actorUserId: string,
    institutionId: string,
    dto: CreateDriverDto,
  ) {
    const institution = await this.requireInstitution(institutionId);
    if (institution.operationModel === 'BEROYA_OPERATED') {
      throw new AppException(
        'FORBIDDEN',
        'Beroya-operated institutions cannot create drivers; Beroya admin assigns them',
        HttpStatus.FORBIDDEN,
      );
    }
    return this.create(actorUserId, dto, {
      ownerType: OwnerType.INSTITUTION,
      institutionId,
    });
  }

  async getAdmin(id: string) {
    return mapDriver(await this.findDriver(id));
  }

  async getForInstitution(institutionId: string, id: string) {
    const driver = await this.findVisibleDriver(institutionId, id);
    return mapDriver(driver);
  }

  async updateAdmin(actorUserId: string, id: string, dto: UpdateDriverDto) {
    const current = await this.findDriver(id);
    return this.update(actorUserId, current, dto);
  }

  async updateForInstitution(
    actorUserId: string,
    institutionId: string,
    id: string,
    dto: UpdateDriverDto,
  ) {
    const current = await this.findVisibleDriver(institutionId, id);
    assertInstitutionCanMutate(current.ownerType);
    return this.update(actorUserId, current, dto);
  }

  async updateStatusAdmin(
    actorUserId: string,
    id: string,
    status: ResourceStatus,
  ) {
    const current = await this.findDriver(id);
    return this.updateStatus(actorUserId, current, status);
  }

  async updateStatusForInstitution(
    actorUserId: string,
    institutionId: string,
    id: string,
    status: ResourceStatus,
  ) {
    const current = await this.findVisibleDriver(institutionId, id);
    assertInstitutionCanMutate(current.ownerType);
    return this.updateStatus(actorUserId, current, status);
  }

  async listTrips(
    id: string,
    query: PaginationDto,
    institutionId?: string,
  ) {
    await (institutionId
      ? this.findVisibleDriver(institutionId, id)
      : this.findDriver(id));
    const where: Prisma.ShuttleTripWhereInput = {
      driverId: id,
      ...(institutionId ? { institutionId } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.shuttleTrip.count({ where }),
      this.prisma.shuttleTrip.findMany({
        where,
        orderBy: [{ serviceDate: 'desc' }, { scheduledDepartureTime: 'desc' }],
        skip: paginationOffset(query.page, query.limit),
        take: query.limit,
      }),
    ]);
    return {
      data: rows.map(mapResourceTrip),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async availableForInstitution(
    institutionId: string,
    filters: { date?: string; time?: string; routeId?: string },
  ) {
    const listed = await this.listForInstitution(institutionId, {
      page: 1,
      limit: 100,
      status: ResourceStatus.ACTIVE,
    });
    const busy = await this.busyDriverIds(institutionId, filters);
    return listed.data.filter((driver) => !busy.has(driver.id));
  }

  private async list(args: {
    query: ListDriversQueryDto;
    where: Prisma.DriverProfileWhereInput;
  }) {
    const where: Prisma.DriverProfileWhereInput = { ...args.where };
    if (args.query.status) {
      where.status = args.query.status;
    }
    if (args.query.ownerType) {
      where.ownerType = args.query.ownerType;
    }
    if (args.query.assigned === true) {
      where.defaultForRoutes = { some: {} };
    } else if (args.query.assigned === false) {
      where.defaultForRoutes = { none: {} };
    }
    if (args.query.search) {
      const search = args.query.search.trim();
      where.AND = [
        ...(where.AND
          ? Array.isArray(where.AND)
            ? where.AND
            : [where.AND]
          : []),
        {
          OR: [
            { nationalId: { contains: search, mode: 'insensitive' } },
            { licenseNumber: { contains: search, mode: 'insensitive' } },
            { user: { fullName: { contains: search, mode: 'insensitive' } } },
            { user: { phone: { contains: search } } },
          ],
        },
      ];
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.driverProfile.count({ where }),
      this.prisma.driverProfile.findMany({
        where,
        include: driverInclude,
        orderBy: { createdAt: 'desc' },
        skip: paginationOffset(args.query.page, args.query.limit),
        take: args.query.limit,
      }),
    ]);
    return {
      data: rows.map(mapDriver),
      meta: buildPaginationMeta(args.query.page, args.query.limit, total),
    };
  }

  private async create(
    actorUserId: string,
    dto: CreateDriverDto,
    owner: { ownerType: OwnerType; institutionId: string | null },
  ) {
    const phone = normalizePhone(dto.phone);
    assertEmailAndPassword(dto.email, dto.password);
    const email = normalizeEmail(dto.email);
    const passwordHash = await hashPassword(dto.password);
    await this.assertPhoneAvailable(phone);
    await assertEmailAvailable(this.prisma, email);
    if (dto.vehicleId && dto.newVehicle) {
      throw new AppException(
        'VALIDATION_ERROR',
        'Provide either vehicleId or newVehicle, not both',
        HttpStatus.BAD_REQUEST,
      );
    }
    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.shuttleUser.create({
        data: {
          fullName: dto.fullName,
          phone,
          email,
          passwordHash,
          role: ShuttleRole.DRIVER,
          status: UserStatus.ACTIVE,
          institutionId: owner.institutionId,
        },
      });
      let driver = await tx.driverProfile.create({
        data: {
          userId: user.id,
          institutionId: owner.institutionId,
          ownerType: owner.ownerType,
          nationalId: dto.nationalId,
          licenseNumber: dto.licenseNumber,
          licenseExpiry: dto.licenseExpiry
            ? new Date(dto.licenseExpiry)
            : undefined,
          dailyTripsLimit: dto.dailyTripsLimit,
        },
        include: driverInclude,
      });

      const vehicleId = await this.resolveVehicleLink(tx, {
        driverId: driver.id,
        institutionId: owner.institutionId,
        ownerType: owner.ownerType,
        vehicleId: dto.vehicleId,
        newVehicle: dto.newVehicle,
      });
      if (vehicleId) {
        driver = await tx.driverProfile.update({
          where: { id: driver.id },
          data: { primaryVehicleId: vehicleId },
          include: driverInclude,
        });
      }

      await this.audit.record(
        {
          actorUserId,
          institutionId: owner.institutionId,
          action: AUDIT.DRIVER_CREATED,
          entityType: ENTITY.DRIVER_PROFILE,
          entityId: driver.id,
          after: mapDriver(driver),
        },
        tx,
      );
      return driver;
    });
    return mapDriver(created);
  }

  private async update(
    actorUserId: string,
    current: Prisma.DriverProfileGetPayload<{ include: typeof driverInclude }>,
    dto: UpdateDriverDto,
  ) {
    if (dto.phone) {
      await this.assertPhoneAvailable(normalizePhone(dto.phone), current.userId);
    }
    if (dto.email) await assertEmailAvailable(this.prisma, dto.email, current.userId);
    if (dto.vehicleId && dto.newVehicle) {
      throw new AppException(
        'VALIDATION_ERROR',
        'Provide either vehicleId or newVehicle, not both',
        HttpStatus.BAD_REQUEST,
      );
    }
    const passwordHash = dto.password ? await hashPassword(dto.password) : undefined;
    const institutionId =
      dto.institutionId === undefined
        ? current.institutionId
        : dto.institutionId
          ? await this.requireBeroyaOperatedInstitution(dto.institutionId)
          : null;
    const updated = await this.prisma.$transaction(async (tx) => {
      if (
        dto.fullName ||
        dto.phone ||
        dto.email ||
        passwordHash ||
        dto.institutionId !== undefined
      ) {
        await tx.shuttleUser.update({
          where: { id: current.userId },
          data: {
            fullName: dto.fullName,
            phone: dto.phone ? normalizePhone(dto.phone) : undefined,
            email: dto.email ? normalizeEmail(dto.email) : undefined,
            passwordHash,
            ...(dto.institutionId !== undefined ? { institutionId } : {}),
          },
        });
      }
      let next = await tx.driverProfile.update({
        where: { id: current.id },
        data: {
          nationalId: dto.nationalId,
          licenseNumber: dto.licenseNumber,
          licenseExpiry: dto.licenseExpiry
            ? new Date(dto.licenseExpiry)
            : undefined,
          ...(dto.institutionId !== undefined ? { institutionId } : {}),
          ...(dto.dailyTripsLimit !== undefined
            ? { dailyTripsLimit: dto.dailyTripsLimit }
            : {}),
        },
        include: driverInclude,
      });

      if (dto.vehicleId !== undefined || dto.newVehicle) {
        if (dto.vehicleId === null && !dto.newVehicle) {
          next = await tx.driverProfile.update({
            where: { id: current.id },
            data: { primaryVehicleId: null },
            include: driverInclude,
          });
        } else {
          const vehicleId = await this.resolveVehicleLink(tx, {
            driverId: current.id,
            institutionId: next.institutionId,
            ownerType: next.ownerType,
            vehicleId: dto.vehicleId ?? undefined,
            newVehicle: dto.newVehicle,
          });
          next = await tx.driverProfile.update({
            where: { id: current.id },
            data: { primaryVehicleId: vehicleId },
            include: driverInclude,
          });
        }
      }

      await this.audit.record(
        {
          actorUserId,
          institutionId: next.institutionId,
          action: AUDIT.DRIVER_UPDATED,
          entityType: ENTITY.DRIVER_PROFILE,
          entityId: current.id,
          before: mapDriver(current),
          after: mapDriver(next),
        },
        tx,
      );
      return next;
    });
    return mapDriver(updated);
  }

  private async resolveVehicleLink(
    tx: Prisma.TransactionClient,
    args: {
      driverId: string;
      institutionId: string | null;
      ownerType: OwnerType;
      vehicleId?: string;
      newVehicle?: NestedVehicleDto;
    },
  ): Promise<string | null> {
    if (args.newVehicle) {
      const plate = args.newVehicle.plateNumber.trim().toUpperCase();
      const existing = await tx.shuttleVehicle.findFirst({
        where: { plateNumber: plate, archivedAt: null },
      });
      if (existing) {
        throw new AppException(
          'VEHICLE_PLATE_TAKEN',
          'A vehicle with this plate number already exists',
          HttpStatus.CONFLICT,
        );
      }
      const ownerType =
        args.ownerType === OwnerType.INSTITUTION
          ? OwnerType.INSTITUTION
          : OwnerType.DRIVER;
      const vehicle = await tx.shuttleVehicle.create({
        data: {
          institutionId: args.institutionId,
          ownerType,
          ownerDriverId: ownerType === OwnerType.DRIVER ? args.driverId : null,
          plateNumber: plate,
          vehicleType: args.newVehicle.vehicleType,
          capacity: args.newVehicle.capacity,
          licenseExpiry: args.newVehicle.licenseExpiry
            ? new Date(args.newVehicle.licenseExpiry)
            : undefined,
          insuranceExpiry: args.newVehicle.insuranceExpiry
            ? new Date(args.newVehicle.insuranceExpiry)
            : undefined,
        },
      });
      return vehicle.id;
    }
    if (!args.vehicleId) return null;
    const vehicle = await tx.shuttleVehicle.findFirst({
      where: { id: args.vehicleId, archivedAt: null },
    });
    if (!vehicle) {
      throw new AppException(
        'VEHICLE_NOT_FOUND',
        'Vehicle not found',
        HttpStatus.NOT_FOUND,
      );
    }
    if (
      args.ownerType === OwnerType.BEROYA &&
      !isBeroyaFleetOwner(vehicle.ownerType)
    ) {
      throw new AppException(
        'VEHICLE_NOT_AVAILABLE',
        'This vehicle cannot be linked to the driver',
        HttpStatus.FORBIDDEN,
      );
    }
    if (
      args.ownerType === OwnerType.INSTITUTION &&
      (vehicle.ownerType !== OwnerType.INSTITUTION ||
        vehicle.institutionId !== args.institutionId)
    ) {
      throw new AppException(
        'VEHICLE_NOT_AVAILABLE',
        'This vehicle cannot be linked to the driver',
        HttpStatus.FORBIDDEN,
      );
    }
    if (vehicle.ownerType === OwnerType.DRIVER && !vehicle.ownerDriverId) {
      await tx.shuttleVehicle.update({
        where: { id: vehicle.id },
        data: { ownerDriverId: args.driverId },
      });
    }
    return vehicle.id;
  }

  private async requireBeroyaOperatedInstitution(institutionId: string) {
    const institution = await this.requireInstitution(institutionId);
    if (institution.operationModel !== 'BEROYA_OPERATED') {
      throw new AppException(
        'VALIDATION_ERROR',
        'Drivers can only be linked to Beroya-operated institutions',
        HttpStatus.BAD_REQUEST,
      );
    }
    return institution.id;
  }

  private async updateStatus(
    actorUserId: string,
    current: Prisma.DriverProfileGetPayload<{ include: typeof driverInclude }>,
    status: ResourceStatus,
  ) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.driverProfile.update({
        where: { id: current.id },
        data: { status },
        include: driverInclude,
      });
      await this.audit.record(
        {
          actorUserId,
          institutionId: current.institutionId,
          action: AUDIT.DRIVER_STATUS_CHANGED,
          entityType: ENTITY.DRIVER_PROFILE,
          entityId: current.id,
          before: { status: current.status },
          after: { status: next.status },
        },
        tx,
      );
      return next;
    });
    return mapDriver(updated);
  }

  private async findDriver(id: string) {
    const driver = await this.prisma.driverProfile.findFirst({
      where: { id, archivedAt: null },
      include: driverInclude,
    });
    if (!driver) {
      throw new AppException(
        'DRIVER_NOT_FOUND',
        'Driver not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return driver;
  }

  private async findVisibleDriver(institutionId: string, id: string) {
    const institution = await this.requireInstitution(institutionId);
    const driver = await this.findDriver(id);
    const own =
      driver.institutionId === institutionId &&
      driver.ownerType === OwnerType.INSTITUTION;
    const beroya =
      canSeeBeroyaResources(institution.operationModel) &&
      driver.ownerType === OwnerType.BEROYA &&
      (driver.institutionId === null || driver.institutionId === institutionId);
    if (!own && !beroya) {
      throw new AppException(
        'DRIVER_NOT_FOUND',
        'Driver not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return driver;
  }

  private async requireInstitution(institutionId: string) {
    const institution = await this.prisma.institution.findFirst({
      where: { id: institutionId, archivedAt: null },
    });
    if (!institution) {
      throw new AppException(
        'INSTITUTION_NOT_FOUND',
        'Institution not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return institution;
  }

  private async assertPhoneAvailable(phone: string, exceptUserId?: string) {
    const clash = await this.prisma.shuttleUser.findFirst({
      where: {
        phone,
        archivedAt: null,
        status: UserStatus.ACTIVE,
        ...(exceptUserId ? { id: { not: exceptUserId } } : {}),
      },
    });
    if (clash) {
      throw new AppException(
        'PHONE_IN_USE',
        'This phone is already linked to an active account',
        HttpStatus.CONFLICT,
      );
    }
  }

  private async busyDriverIds(
    institutionId: string,
    filters: { date?: string; time?: string; routeId?: string },
  ): Promise<Set<string>> {
    if (!filters.date) {
      return new Set();
    }
    const trips = await this.prisma.shuttleTrip.findMany({
      where: {
        institutionId,
        serviceDate: new Date(filters.date),
        status: { in: [TripStatus.SCHEDULED, TripStatus.IN_PROGRESS] },
        ...(filters.time ? { scheduledDepartureTime: filters.time } : {}),
        ...(filters.routeId ? { routeId: { not: filters.routeId } } : {}),
      },
      select: {
        driverId: true,
        route: { select: { defaultDriverId: true } },
      },
    });
    const ids = new Set<string>();
    for (const trip of trips) {
      if (trip.driverId) {
        ids.add(trip.driverId);
      }
      if (trip.route.defaultDriverId) {
        ids.add(trip.route.defaultDriverId);
      }
    }
    return ids;
  }
}
