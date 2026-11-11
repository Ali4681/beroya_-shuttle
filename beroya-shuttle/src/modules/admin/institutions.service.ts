import { HttpStatus, Injectable } from '@nestjs/common';
import {
  buildPaginationMeta,
  paginationOffset,
} from '../../common/dto/pagination.dto';
import { AppException } from '../../common/errors/app.exception';
import { assertEmailAndPassword, hashPassword, normalizeEmail } from '../../common/utils/password';
import { normalizePhone } from '../../common/utils/phone';
import {
  InstitutionStatus,
  Prisma,
  ShuttleRole,
  SubscriptionStatus,
  UserStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { mapBranch, mapBranding, mapSettings } from '../auth/auth.mapper';
import { AuditService } from '../shared/audit/audit.service';
import { AUDIT, DEFAULT_BRANCH_NAME, ENTITY } from './admin.constants';
import {
  mapInstitutionDetail,
  mapInstitutionSummary,
  mapSubscription,
} from './admin.mapper';
import { ChangeAdminDto } from './dto/change-admin.dto';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { ListInstitutionsQueryDto } from './dto/list-institutions.query';
import { UpdateBrandingDto } from './dto/update-branding.dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import { UpdateInstitutionStatusDto } from './dto/update-institution-status.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { UploadsService } from '../institution/uploads.service';

const institutionInclude = {
  primaryAdmin: true,
  settings: true,
  branding: true,
  branches: {
    where: { archivedAt: null },
    orderBy: { name: 'asc' as const },
  },
  subscriptions: {
    orderBy: { createdAt: 'desc' as const },
  },
};

@Injectable()
export class InstitutionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly uploads: UploadsService,
  ) {}

  async list(query: ListInstitutionsQueryDto) {
    const where = this.buildListWhere(query);
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.institution.count({ where }),
      this.prisma.institution.findMany({
        where,
        include: {
          primaryAdmin: true,
          subscriptions: {
            where: { status: SubscriptionStatus.ACTIVE },
            orderBy: { endsAt: 'desc' },
            take: 3,
          },
          _count: { select: { branches: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: paginationOffset(query.page, query.limit),
        take: query.limit,
      }),
    ]);

    return {
      data: rows.map(mapInstitutionSummary),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async create(actorUserId: string, dto: CreateInstitutionDto) {
    const phone = normalizePhone(dto.admin.phone);
    assertEmailAndPassword(dto.admin.email, dto.admin.password);
    const email = normalizeEmail(dto.admin.email);
    const passwordHash = await hashPassword(dto.admin.password);
    await this.assertPhoneAvailable(phone);
    await this.assertEmailAvailable(email);

    const created = await this.prisma.$transaction(async (tx) => {
      const institution = await tx.institution.create({
        data: {
          name: dto.name,
          displayName: dto.displayName,
          type: dto.type,
          operationModel: dto.operationModel,
          contactPhone: dto.contactPhone,
          contactEmail: dto.contactEmail,
          city: dto.city,
          address: dto.address,
        },
      });

      await tx.institutionSettings.create({
        data: { institutionId: institution.id },
      });
      await tx.institutionBranding.create({
        data: { institutionId: institution.id },
      });
      const branch = await tx.institutionBranch.create({
        data: {
          institutionId: institution.id,
          name: dto.defaultBranch?.name ?? DEFAULT_BRANCH_NAME,
          address: dto.defaultBranch?.address ?? dto.address,
        },
      });
      const admin = await tx.shuttleUser.create({
        data: {
          fullName: dto.admin.fullName,
          phone,
          email,
          passwordHash,
          role: ShuttleRole.INSTITUTION_ADMIN,
          status: UserStatus.ACTIVE,
          institutionId: institution.id,
          branchId: branch.id,
        },
      });
      const full = await tx.institution.update({
        where: { id: institution.id },
        data: { primaryAdminUserId: admin.id },
        include: institutionInclude,
      });

      await this.audit.record(
        {
          actorUserId,
          institutionId: full.id,
          action: AUDIT.INSTITUTION_CREATED,
          entityType: ENTITY.INSTITUTION,
          entityId: full.id,
          after: mapInstitutionDetail(full),
        },
        tx,
      );

      return full;
    });

    return mapInstitutionDetail(created);
  }

  async getById(id: string) {
    const institution = await this.findInstitution(id);
    return mapInstitutionDetail(institution);
  }

  async update(actorUserId: string, id: string, dto: UpdateInstitutionDto) {
    const current = await this.findInstitution(id);
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.institution.update({
        where: { id },
        data: {
          name: dto.name,
          displayName: dto.displayName,
          type: dto.type,
          operationModel: dto.operationModel,
          contactPhone: dto.contactPhone,
          contactEmail: dto.contactEmail,
          city: dto.city,
          address: dto.address,
        },
        include: institutionInclude,
      });
      await this.audit.record(
        {
          actorUserId,
          institutionId: id,
          action: AUDIT.INSTITUTION_UPDATED,
          entityType: ENTITY.INSTITUTION,
          entityId: id,
          before: mapInstitutionSummary(current),
          after: mapInstitutionSummary(next),
        },
        tx,
      );
      return next;
    });
    return mapInstitutionDetail(updated);
  }

  async updateStatus(
    actorUserId: string,
    id: string,
    dto: UpdateInstitutionStatusDto,
  ) {
    const current = await this.findInstitution(id);
    if (
      dto.status === InstitutionStatus.SUSPENDED &&
      (!dto.reason || dto.reason.trim().length === 0)
    ) {
      throw new AppException(
        'STATUS_REASON_REQUIRED',
        'A reason is required when suspending an institution',
        HttpStatus.BAD_REQUEST,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.institution.update({
        where: { id },
        data: {
          status: dto.status,
          statusReason:
            dto.status === InstitutionStatus.SUSPENDED
              ? dto.reason?.trim()
              : null,
        },
        include: institutionInclude,
      });

      if (dto.status === InstitutionStatus.SUSPENDED) {
        const users = await tx.shuttleUser.findMany({
          where: { institutionId: id },
          select: { id: true },
        });
        if (users.length > 0) {
          await tx.userSession.updateMany({
            where: {
              userId: { in: users.map((user) => user.id) },
              revokedAt: null,
            },
            data: { revokedAt: new Date() },
          });
        }
      }

      await this.audit.record(
        {
          actorUserId,
          institutionId: id,
          action: AUDIT.INSTITUTION_STATUS_CHANGED,
          entityType: ENTITY.INSTITUTION,
          entityId: id,
          before: {
            status: current.status,
            statusReason: current.statusReason,
          },
          after: {
            status: next.status,
            statusReason: next.statusReason,
          },
        },
        tx,
      );
      return next;
    });

    return mapInstitutionDetail(updated);
  }

  async changeAdmin(actorUserId: string, id: string, dto: ChangeAdminDto) {
    const institution = await this.findInstitution(id);
    const phone = normalizePhone(dto.phone);
    assertEmailAndPassword(dto.email, dto.password);
    const email = normalizeEmail(dto.email);
    const passwordHash = await hashPassword(dto.password);
    const keepOld = dto.keepOldAsOperator === true;

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.shuttleUser.findFirst({
        where: { phone, institutionId: id, archivedAt: null },
      });

      if (!existing) {
        await this.assertPhoneAvailable(phone, id, tx);
      }
      await this.assertEmailAvailable(email, existing?.id, tx);

      const nextAdmin =
        existing ??
        (await tx.shuttleUser.create({
          data: {
            fullName: dto.fullName,
            phone,
            email,
            passwordHash,
            role: ShuttleRole.INSTITUTION_ADMIN,
            status: UserStatus.ACTIVE,
            institutionId: id,
            branchId: institution.branches[0]?.id,
          },
        }));

      if (existing) {
        await tx.shuttleUser.update({
          where: { id: existing.id },
          data: {
            fullName: dto.fullName,
            phone,
            email,
            passwordHash,
            role: ShuttleRole.INSTITUTION_ADMIN,
            status: UserStatus.ACTIVE,
            archivedAt: null,
          },
        });
      }

      const oldAdminId = institution.primaryAdminUserId;
      if (oldAdminId && oldAdminId !== nextAdmin.id && !keepOld) {
        await tx.shuttleUser.update({
          where: { id: oldAdminId },
          data: { status: UserStatus.SUSPENDED },
        });
        await tx.userSession.updateMany({
          where: { userId: oldAdminId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      const next = await tx.institution.update({
        where: { id },
        data: { primaryAdminUserId: nextAdmin.id },
        include: institutionInclude,
      });

      await this.audit.record(
        {
          actorUserId,
          institutionId: id,
          action: AUDIT.INSTITUTION_ADMIN_CHANGED,
          entityType: ENTITY.INSTITUTION,
          entityId: id,
          before: {
            primaryAdminUserId: oldAdminId,
            keepOldAsOperator: keepOld,
          },
          after: {
            primaryAdminUserId: nextAdmin.id,
            phone,
            email,
            fullName: dto.fullName,
            keepOldAsOperator: keepOld,
          },
        },
        tx,
      );

      return next;
    });

    return mapInstitutionDetail(result);
  }

  async stats(id: string) {
    const institution = await this.findInstitution(id);
    const timezone = institution.settings?.timezone ?? 'Asia/Damascus';
    const today = todayInTimezone(timezone);

    const [
      branches,
      users,
      students,
      universityStudents,
      drivers,
      vehicles,
      attendants,
      routes,
      tripsToday,
    ] = await Promise.all([
      this.prisma.institutionBranch.count({
        where: { institutionId: id, archivedAt: null },
      }),
      this.prisma.shuttleUser.count({
        where: { institutionId: id, archivedAt: null },
      }),
      this.prisma.schoolStudent.count({
        where: { institutionId: id, archivedAt: null },
      }),
      this.prisma.universityStudentProfile.count({
        where: { institutionId: id, archivedAt: null },
      }),
      this.prisma.driverProfile.count({
        where: { institutionId: id, archivedAt: null },
      }),
      this.prisma.shuttleVehicle.count({
        where: { institutionId: id, archivedAt: null },
      }),
      this.prisma.attendantProfile.count({
        where: { institutionId: id, archivedAt: null },
      }),
      this.prisma.shuttleRoute.count({
        where: { institutionId: id, archivedAt: null },
      }),
      this.prisma.shuttleTrip.count({
        where: { institutionId: id, serviceDate: today },
      }),
    ]);

    return {
      institutionId: id,
      timezone,
      serviceDate: today.toISOString().slice(0, 10),
      currentSubscription: pickMappedSubscription(institution.subscriptions),
      counts: {
        branches,
        users,
        students,
        universityStudents,
        drivers,
        vehicles,
        attendants,
        routes,
        tripsToday,
      },
    };
  }

  async listBranches(id: string) {
    await this.findInstitution(id);
    const branches = await this.prisma.institutionBranch.findMany({
      where: { institutionId: id, archivedAt: null },
      orderBy: { name: 'asc' },
    });
    return branches.map(mapBranch);
  }

  async getBranding(id: string) {
    const institution = await this.findInstitution(id);
    return mapBranding(institution.branding);
  }

  async updateBranding(actorUserId: string, id: string, dto: UpdateBrandingDto) {
    await this.findInstitution(id);
    if (dto.logoUrl) {
      await this.uploads.assertLogoUrl(id, dto.logoUrl);
    }
    const current = await this.prisma.institutionBranding.findUnique({
      where: { institutionId: id },
    });
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.institutionBranding.upsert({
        where: { institutionId: id },
        create: {
          institutionId: id,
          useInstitutionIdentity: dto.useInstitutionIdentity ?? false,
          logoUrl: dto.logoUrl,
          primaryColor: dto.primaryColor,
          secondaryColor: dto.secondaryColor,
          welcomeMessage: dto.welcomeMessage,
          supportPhone: dto.supportPhone,
        },
        update: {
          useInstitutionIdentity: dto.useInstitutionIdentity,
          logoUrl: dto.logoUrl,
          primaryColor: dto.primaryColor,
          secondaryColor: dto.secondaryColor,
          welcomeMessage: dto.welcomeMessage,
          supportPhone: dto.supportPhone,
        },
      });
      await this.audit.record(
        {
          actorUserId,
          institutionId: id,
          action: AUDIT.INSTITUTION_BRANDING_UPDATED,
          entityType: ENTITY.INSTITUTION_BRANDING,
          entityId: next.id,
          before: mapBranding(current),
          after: mapBranding(next),
        },
        tx,
      );
      return next;
    });
    return mapBranding(updated);
  }

  async getSettings(id: string) {
    const institution = await this.findInstitution(id);
    return mapSettings(institution.settings);
  }

  async updateSettings(actorUserId: string, id: string, dto: UpdateSettingsDto) {
    if (dto.timezone) {
      assertTimeZone(dto.timezone);
    }
    await this.findInstitution(id);
    const current = await this.prisma.institutionSettings.findUnique({
      where: { institutionId: id },
    });
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.institutionSettings.upsert({
        where: { institutionId: id },
        create: {
          institutionId: id,
          timezone: dto.timezone ?? 'Asia/Damascus',
          defaultDelayThresholdMinutes: dto.defaultDelayThresholdMinutes,
          defaultParentArrivalAlertMinutes:
            dto.defaultParentArrivalAlertMinutes,
          gpsStaleAfterSeconds: dto.gpsStaleAfterSeconds,
          locationPingIntervalSeconds: dto.locationPingIntervalSeconds,
        },
        update: {
          timezone: dto.timezone,
          defaultDelayThresholdMinutes: dto.defaultDelayThresholdMinutes,
          defaultParentArrivalAlertMinutes:
            dto.defaultParentArrivalAlertMinutes,
          gpsStaleAfterSeconds: dto.gpsStaleAfterSeconds,
          locationPingIntervalSeconds: dto.locationPingIntervalSeconds,
        },
      });
      await this.audit.record(
        {
          actorUserId,
          institutionId: id,
          action: AUDIT.INSTITUTION_SETTINGS_UPDATED,
          entityType: ENTITY.INSTITUTION_SETTINGS,
          entityId: next.id,
          before: mapSettings(current),
          after: mapSettings(next),
        },
        tx,
      );
      return next;
    });
    return mapSettings(updated);
  }

  private async findInstitution(id: string) {
    const institution = await this.prisma.institution.findFirst({
      where: { id, archivedAt: null },
      include: institutionInclude,
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

  private buildListWhere(
    query: ListInstitutionsQueryDto,
  ): Prisma.InstitutionWhereInput {
    const where: Prisma.InstitutionWhereInput = { archivedAt: null };
    if (query.type) {
      where.type = query.type;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.operationModel) {
      where.operationModel = query.operationModel;
    }
    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
        { contactPhone: { contains: search } },
      ];
    }
    if (query.subscriptionStatus) {
      const now = new Date();
      where.subscriptions =
        query.subscriptionStatus === SubscriptionStatus.ACTIVE
          ? {
              some: {
                status: SubscriptionStatus.ACTIVE,
                startsAt: { lte: now },
                endsAt: { gte: now },
              },
            }
          : { some: { status: query.subscriptionStatus } };
    }
    return where;
  }

  private async assertPhoneAvailable(
    phone: string,
    institutionId?: string,
    db: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const clash = await db.shuttleUser.findFirst({
      where: {
        phone,
        archivedAt: null,
        status: UserStatus.ACTIVE,
        ...(institutionId
          ? {
              OR: [
                { institutionId: null },
                { institutionId: { not: institutionId } },
              ],
            }
          : {}),
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

  private async assertEmailAvailable(
    email: string,
    exceptUserId?: string,
    db: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const clash = await db.shuttleUser.findFirst({
      where: {
        email,
        archivedAt: null,
        ...(exceptUserId ? { id: { not: exceptUserId } } : {}),
      },
    });
    if (clash) {
      throw new AppException(
        'EMAIL_IN_USE',
        'This email is already linked to an account',
        HttpStatus.CONFLICT,
      );
    }
  }
}

function assertTimeZone(timeZone: string): void {
  try {
    Intl.DateTimeFormat('en-US', { timeZone }).format();
  } catch {
    throw new AppException(
      'INVALID_TIMEZONE',
      'timezone is not a valid IANA time zone',
      HttpStatus.BAD_REQUEST,
    );
  }
}

function todayInTimezone(timeZone: string): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return new Date(`${parts}T00:00:00.000Z`);
}

function pickMappedSubscription(
  subscriptions: Parameters<typeof mapSubscription>[0][] | undefined,
) {
  if (!subscriptions?.length) {
    return null;
  }
  const now = Date.now();
  const current = subscriptions.find(
    (item) =>
      item.status === SubscriptionStatus.ACTIVE &&
      item.startsAt.getTime() <= now &&
      item.endsAt.getTime() >= now,
  );
  return current ? mapSubscription(current) : null;
}
