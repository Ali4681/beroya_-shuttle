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
  VehicleStatus,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { AUDIT, ENTITY } from '../../admin/admin.constants';
import { AuditService } from '../audit/audit.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import type { NestedDriverDto } from './dto/nested-resource.dto';
import { ListVehiclesQueryDto } from './dto/list-vehicles.query';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { mapResourceTrip, mapVehicle } from './resource.mapper';
import {
  assertInstitutionCanMutate,
  buildResourceStats,
  canSeeBeroyaResources,
  isBeroyaFleetOwner,
} from './resource.rules';

const vehicleInclude = {
  ownerDriver: { include: { user: true } },
  defaultForRoutes: {
    select: { id: true, name: true, status: true },
  },
  _count: { select: { defaultForRoutes: true } },
} as const;

@Injectable()
export class VehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listAdmin(query: ListVehiclesQueryDto) {
    return this.list({
      query,
      where: {
        archivedAt: null,
        ownerType: { in: [OwnerType.BEROYA, OwnerType.DRIVER] },
        // Linked to this institution, or still in the unassigned Beroya pool.
        ...(query.institutionId
          ? { OR: [{ institutionId: query.institutionId }, { institutionId: null }] }
          : {}),
      },
    });
  }

  async listForInstitution(institutionId: string, query: ListVehiclesQueryDto) {
    const institution = await this.requireInstitution(institutionId);
    const seeBeroya = canSeeBeroyaResources(institution.operationModel);
    return this.list({
      query,
      where: {
        archivedAt: null,
        OR: [
          { institutionId, ownerType: OwnerType.INSTITUTION },
          ...(seeBeroya
            ? [
                {
                  ownerType: { in: [OwnerType.BEROYA, OwnerType.DRIVER] },
                  OR: [{ institutionId: null }, { institutionId }],
                  status: VehicleStatus.ACTIVE,
                },
              ]
            : []),
        ],
      },
    });
  }

  async statsForInstitution(institutionId: string) {
    const rows = await this.prisma.shuttleVehicle.findMany({
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

  async createBeroya(actorUserId: string, dto: CreateVehicleDto) {
    const ownerType =
      dto.ownerType === OwnerType.DRIVER ? OwnerType.DRIVER : OwnerType.BEROYA;
    const institutionId = dto.institutionId
      ? await this.requireBeroyaOperatedInstitution(dto.institutionId)
      : null;
    if (ownerType === OwnerType.DRIVER && !dto.driverId && !dto.newDriver) {
      throw new AppException(
        'VALIDATION_ERROR',
        'Driver-owned vehicles require a driver',
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.create(actorUserId, dto, { ownerType, institutionId });
  }

  async createForInstitution(
    actorUserId: string,
    institutionId: string,
    dto: CreateVehicleDto,
  ) {
    const institution = await this.requireInstitution(institutionId);
    if (institution.operationModel === 'BEROYA_OPERATED') {
      throw new AppException(
        'FORBIDDEN',
        'Beroya-operated institutions cannot create vehicles; Beroya admin assigns them',
        HttpStatus.FORBIDDEN,
      );
    }
    return this.create(actorUserId, dto, {
      ownerType: OwnerType.INSTITUTION,
      institutionId,
    });
  }

  async getAdmin(id: string) {
    return mapVehicle(await this.findVehicle(id));
  }

  async getForInstitution(institutionId: string, id: string) {
    return mapVehicle(await this.findVisibleVehicle(institutionId, id));
  }

  async updateAdmin(actorUserId: string, id: string, dto: UpdateVehicleDto) {
    return this.update(actorUserId, await this.findVehicle(id), dto);
  }

  async updateForInstitution(
    actorUserId: string,
    institutionId: string,
    id: string,
    dto: UpdateVehicleDto,
  ) {
    const current = await this.findVisibleVehicle(institutionId, id);
    assertInstitutionCanMutate(current.ownerType);
    return this.update(actorUserId, current, dto);
  }

  async updateStatusAdmin(
    actorUserId: string,
    id: string,
    status: VehicleStatus,
  ) {
    return this.updateStatus(actorUserId, await this.findVehicle(id), status);
  }

  async updateStatusForInstitution(
    actorUserId: string,
    institutionId: string,
    id: string,
    status: VehicleStatus,
  ) {
    const current = await this.findVisibleVehicle(institutionId, id);
    assertInstitutionCanMutate(current.ownerType);
    return this.updateStatus(actorUserId, current, status);
  }

  async listTrips(id: string, query: PaginationDto, institutionId?: string) {
    await (institutionId
      ? this.findVisibleVehicle(institutionId, id)
      : this.findVehicle(id));
    const where: Prisma.ShuttleTripWhereInput = {
      vehicleId: id,
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
      status: VehicleStatus.ACTIVE,
    });
    const busy = await this.busyVehicleIds(institutionId, filters);
    return listed.data.filter((vehicle) => !busy.has(vehicle.id));
  }

  private async list(args: {
    query: ListVehiclesQueryDto;
    where: Prisma.ShuttleVehicleWhereInput;
  }) {
    const where: Prisma.ShuttleVehicleWhereInput = { ...args.where };
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
            { plateNumber: { contains: search, mode: 'insensitive' } },
            { vehicleType: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.shuttleVehicle.count({ where }),
      this.prisma.shuttleVehicle.findMany({
        where,
        include: vehicleInclude,
        orderBy: { createdAt: 'desc' },
        skip: paginationOffset(args.query.page, args.query.limit),
        take: args.query.limit,
      }),
    ]);
    return {
      data: rows.map(mapVehicle),
      meta: buildPaginationMeta(args.query.page, args.query.limit, total),
    };
  }

  private async create(
    actorUserId: string,
    dto: CreateVehicleDto,
    owner: { ownerType: OwnerType; institutionId: string | null },
  ) {
    await this.assertPlateAvailable(dto.plateNumber);
    if (dto.driverId && dto.newDriver) {
      throw new AppException(
        'VALIDATION_ERROR',
        'Provide either driverId or newDriver, not both',
        HttpStatus.BAD_REQUEST,
      );
    }
    const created = await this.prisma.$transaction(async (tx) => {
      const ownerDriverId = await this.resolveDriverLink(tx, {
        institutionId: owner.institutionId,
        ownerType: owner.ownerType,
        driverId: dto.driverId,
        newDriver: dto.newDriver,
      });

      const vehicle = await tx.shuttleVehicle.create({
        data: {
          institutionId: owner.institutionId,
          ownerType: owner.ownerType,
          ownerDriverId:
            owner.ownerType === OwnerType.DRIVER ? ownerDriverId : null,
          plateNumber: dto.plateNumber.trim().toUpperCase(),
          vehicleType: dto.vehicleType,
          capacity: dto.capacity,
          licenseExpiry: dto.licenseExpiry
            ? new Date(dto.licenseExpiry)
            : undefined,
          insuranceExpiry: dto.insuranceExpiry
            ? new Date(dto.insuranceExpiry)
            : undefined,
        },
        include: vehicleInclude,
      });

      if (ownerDriverId) {
        await tx.driverProfile.update({
          where: { id: ownerDriverId },
          data: { primaryVehicleId: vehicle.id },
        });
      }

      await this.audit.record(
        {
          actorUserId,
          institutionId: owner.institutionId,
          action: AUDIT.VEHICLE_CREATED,
          entityType: ENTITY.SHUTTLE_VEHICLE,
          entityId: vehicle.id,
          after: mapVehicle(vehicle),
        },
        tx,
      );
      return vehicle;
    });
    return mapVehicle(created);
  }

  private async update(
    actorUserId: string,
    current: Prisma.ShuttleVehicleGetPayload<{ include: typeof vehicleInclude }>,
    dto: UpdateVehicleDto,
  ) {
    if (dto.plateNumber) {
      await this.assertPlateAvailable(dto.plateNumber, current.id);
    }
    if (dto.driverId && dto.newDriver) {
      throw new AppException(
        'VALIDATION_ERROR',
        'Provide either driverId or newDriver, not both',
        HttpStatus.BAD_REQUEST,
      );
    }
    const ownerType =
      dto.ownerType === OwnerType.DRIVER
        ? OwnerType.DRIVER
        : dto.ownerType === OwnerType.BEROYA
          ? OwnerType.BEROYA
          : current.ownerType;
    if (
      isBeroyaFleetOwner(current.ownerType) &&
      ownerType === OwnerType.DRIVER &&
      !dto.driverId &&
      !dto.newDriver &&
      !current.ownerDriverId
    ) {
      throw new AppException(
        'VALIDATION_ERROR',
        'Driver-owned vehicles require a driver',
        HttpStatus.BAD_REQUEST,
      );
    }
    const institutionId =
      dto.institutionId === undefined
        ? current.institutionId
        : dto.institutionId
          ? await this.requireBeroyaOperatedInstitution(dto.institutionId)
          : null;

    const updated = await this.prisma.$transaction(async (tx) => {
      let ownerDriverId = current.ownerDriverId;
      if (dto.driverId !== undefined || dto.newDriver || ownerType !== current.ownerType) {
        if (ownerType === OwnerType.BEROYA && dto.driverId === null && !dto.newDriver) {
          ownerDriverId = null;
        } else if (dto.driverId || dto.newDriver || ownerType === OwnerType.DRIVER) {
          ownerDriverId = await this.resolveDriverLink(tx, {
            institutionId,
            ownerType,
            driverId: dto.driverId ?? current.ownerDriverId ?? undefined,
            newDriver: dto.newDriver,
          });
        }
      }

      const next = await tx.shuttleVehicle.update({
        where: { id: current.id },
        data: {
          plateNumber: dto.plateNumber
            ? dto.plateNumber.trim().toUpperCase()
            : undefined,
          vehicleType: dto.vehicleType,
          capacity: dto.capacity,
          licenseExpiry: dto.licenseExpiry
            ? new Date(dto.licenseExpiry)
            : undefined,
          insuranceExpiry: dto.insuranceExpiry
            ? new Date(dto.insuranceExpiry)
            : undefined,
          ownerType,
          institutionId,
          ownerDriverId: ownerType === OwnerType.DRIVER ? ownerDriverId : null,
        },
        include: vehicleInclude,
      });

      if (ownerDriverId) {
        await tx.driverProfile.update({
          where: { id: ownerDriverId },
          data: { primaryVehicleId: next.id },
        });
      }

      await this.audit.record(
        {
          actorUserId,
          institutionId: next.institutionId,
          action: AUDIT.VEHICLE_UPDATED,
          entityType: ENTITY.SHUTTLE_VEHICLE,
          entityId: current.id,
          before: mapVehicle(current),
          after: mapVehicle(next),
        },
        tx,
      );
      return next;
    });
    return mapVehicle(updated);
  }

  private async resolveDriverLink(
    tx: Prisma.TransactionClient,
    args: {
      institutionId: string | null;
      ownerType: OwnerType;
      driverId?: string;
      newDriver?: NestedDriverDto;
    },
  ): Promise<string | null> {
    if (args.newDriver) {
      const phone = normalizePhone(args.newDriver.phone);
      assertEmailAndPassword(args.newDriver.email, args.newDriver.password);
      const email = normalizeEmail(args.newDriver.email);
      const passwordHash = await hashPassword(args.newDriver.password);
      const phoneTaken = await tx.shuttleUser.findFirst({
        where: { phone, archivedAt: null },
      });
      if (phoneTaken) {
        throw new AppException(
          'PHONE_TAKEN',
          'Phone number is already in use',
          HttpStatus.CONFLICT,
        );
      }
      await assertEmailAvailable(this.prisma, email);
      const user = await tx.shuttleUser.create({
        data: {
          fullName: args.newDriver.fullName,
          phone,
          email,
          passwordHash,
          role: ShuttleRole.DRIVER,
          status: UserStatus.ACTIVE,
          institutionId: args.institutionId,
        },
      });
      const driver = await tx.driverProfile.create({
        data: {
          userId: user.id,
          institutionId: args.institutionId,
          ownerType:
            args.ownerType === OwnerType.INSTITUTION
              ? OwnerType.INSTITUTION
              : OwnerType.BEROYA,
          nationalId: args.newDriver.nationalId,
          licenseNumber: args.newDriver.licenseNumber,
          licenseExpiry: args.newDriver.licenseExpiry
            ? new Date(args.newDriver.licenseExpiry)
            : undefined,
          status: ResourceStatus.ACTIVE,
        },
      });
      return driver.id;
    }
    if (!args.driverId) return null;
    const driver = await tx.driverProfile.findFirst({
      where: { id: args.driverId, archivedAt: null },
    });
    if (!driver) {
      throw new AppException(
        'DRIVER_NOT_FOUND',
        'Driver not found',
        HttpStatus.NOT_FOUND,
      );
    }
    if (
      args.ownerType !== OwnerType.INSTITUTION &&
      driver.ownerType !== OwnerType.BEROYA
    ) {
      throw new AppException(
        'DRIVER_NOT_AVAILABLE',
        'This driver cannot be linked to the vehicle',
        HttpStatus.FORBIDDEN,
      );
    }
    if (
      args.ownerType === OwnerType.INSTITUTION &&
      (driver.ownerType !== OwnerType.INSTITUTION ||
        driver.institutionId !== args.institutionId)
    ) {
      throw new AppException(
        'DRIVER_NOT_AVAILABLE',
        'This driver cannot be linked to the vehicle',
        HttpStatus.FORBIDDEN,
      );
    }
    return driver.id;
  }

  private async requireBeroyaOperatedInstitution(institutionId: string) {
    const institution = await this.requireInstitution(institutionId);
    if (institution.operationModel !== 'BEROYA_OPERATED') {
      throw new AppException(
        'VALIDATION_ERROR',
        'Vehicles can only be linked to Beroya-operated institutions',
        HttpStatus.BAD_REQUEST,
      );
    }
    return institution.id;
  }

  private async updateStatus(
    actorUserId: string,
    current: Prisma.ShuttleVehicleGetPayload<{ include: typeof vehicleInclude }>,
    status: VehicleStatus,
  ) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.shuttleVehicle.update({
        where: { id: current.id },
        data: { status },
        include: vehicleInclude,
      });
      await this.audit.record(
        {
          actorUserId,
          institutionId: current.institutionId,
          action: AUDIT.VEHICLE_STATUS_CHANGED,
          entityType: ENTITY.SHUTTLE_VEHICLE,
          entityId: current.id,
          before: { status: current.status },
          after: { status: next.status },
        },
        tx,
      );
      return next;
    });
    return mapVehicle(updated);
  }

  private async findVehicle(id: string) {
    const vehicle = await this.prisma.shuttleVehicle.findFirst({
      where: { id, archivedAt: null },
      include: vehicleInclude,
    });
    if (!vehicle) {
      throw new AppException(
        'VEHICLE_NOT_FOUND',
        'Vehicle not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return vehicle;
  }

  private async findVisibleVehicle(institutionId: string, id: string) {
    const institution = await this.requireInstitution(institutionId);
    const vehicle = await this.findVehicle(id);
    const own =
      vehicle.institutionId === institutionId &&
      vehicle.ownerType === OwnerType.INSTITUTION;
    const beroya =
      canSeeBeroyaResources(institution.operationModel) &&
      isBeroyaFleetOwner(vehicle.ownerType) &&
      (vehicle.institutionId === null || vehicle.institutionId === institutionId);
    if (!own && !beroya) {
      throw new AppException(
        'VEHICLE_NOT_FOUND',
        'Vehicle not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return vehicle;
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

  private async assertPlateAvailable(plateNumber: string, exceptId?: string) {
    const clash = await this.prisma.shuttleVehicle.findFirst({
      where: {
        plateNumber: plateNumber.trim().toUpperCase(),
        archivedAt: null,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
    });
    if (clash) {
      throw new AppException(
        'PLATE_IN_USE',
        'This plate number is already registered',
        HttpStatus.CONFLICT,
      );
    }
  }

  private async busyVehicleIds(
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
        vehicleId: true,
        route: { select: { defaultVehicleId: true } },
      },
    });
    const ids = new Set<string>();
    for (const trip of trips) {
      if (trip.vehicleId) {
        ids.add(trip.vehicleId);
      }
      if (trip.route.defaultVehicleId) {
        ids.add(trip.route.defaultVehicleId);
      }
    }
    return ids;
  }
}
