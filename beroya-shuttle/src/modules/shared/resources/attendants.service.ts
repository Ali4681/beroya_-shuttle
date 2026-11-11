import { HttpStatus, Injectable } from '@nestjs/common';
import {
  buildPaginationMeta,
  paginationOffset,
} from '../../../common/dto/pagination.dto';
import { AppException } from '../../../common/errors/app.exception';
import { assertEmailAvailable } from '../../../common/utils/email-availability';
import { assertEmailAndPassword, hashPassword, normalizeEmail } from '../../../common/utils/password';
import { normalizePhone } from '../../../common/utils/phone';
import {
  Prisma,
  ResourceStatus,
  ShuttleRole,
  UserStatus,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { AUDIT, ENTITY } from '../../admin/admin.constants';
import { AuditService } from '../audit/audit.service';
import { CreateAttendantDto } from './dto/create-attendant.dto';
import { ListAttendantsQueryDto } from './dto/list-attendants.query';
import { UpdateAttendantDto } from './dto/update-attendant.dto';
import { mapAttendant } from './resource.mapper';
import { buildResourceStats } from './resource.rules';

const attendantInclude = {
  user: true,
  defaultForRoute: {
    select: { id: true, name: true, status: true },
  },
} as const;

@Injectable()
export class AttendantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(institutionId: string, query: ListAttendantsQueryDto) {
    await this.requireInstitution(institutionId);
    const where: Prisma.AttendantProfileWhereInput = {
      institutionId,
      archivedAt: null,
    };
    if (query.status) {
      where.status = query.status;
    }
    if (query.assigned === true) {
      where.defaultForRoute = { isNot: null };
    } else if (query.assigned === false) {
      where.defaultForRoute = { is: null };
    }
    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { nationalId: { contains: search, mode: 'insensitive' } },
        { user: { fullName: { contains: search, mode: 'insensitive' } } },
        { user: { phone: { contains: search } } },
      ];
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.attendantProfile.count({ where }),
      this.prisma.attendantProfile.findMany({
        where,
        include: attendantInclude,
        orderBy: { createdAt: 'desc' },
        skip: paginationOffset(query.page, query.limit),
        take: query.limit,
      }),
    ]);
    return {
      data: rows.map(mapAttendant),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async stats(institutionId: string) {
    const rows = await this.prisma.attendantProfile.findMany({
      where: { institutionId, archivedAt: null },
      include: { defaultForRoute: { select: { id: true } } },
    });
    return buildResourceStats(
      rows.map((row) => ({
        status: row.status,
        assigned: Boolean(row.defaultForRoute),
      })),
    );
  }

  async create(
    actorUserId: string,
    institutionId: string,
    dto: CreateAttendantDto,
  ) {
    await this.requireInstitution(institutionId);
    const phone = normalizePhone(dto.phone);
    assertEmailAndPassword(dto.email, dto.password);
    const email = normalizeEmail(dto.email);
    const passwordHash = await hashPassword(dto.password);
    await this.assertPhoneAvailable(phone);
    await assertEmailAvailable(this.prisma, email);
    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.shuttleUser.create({
        data: {
          fullName: dto.fullName,
          phone,
          email,
          passwordHash,
          role: ShuttleRole.ATTENDANT,
          status: UserStatus.ACTIVE,
          institutionId,
        },
      });
      const attendant = await tx.attendantProfile.create({
        data: {
          userId: user.id,
          institutionId,
          nationalId: dto.nationalId,
        },
        include: attendantInclude,
      });
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.ATTENDANT_CREATED,
          entityType: ENTITY.ATTENDANT_PROFILE,
          entityId: attendant.id,
          after: mapAttendant(attendant),
        },
        tx,
      );
      return attendant;
    });
    return mapAttendant(created);
  }

  async getById(institutionId: string, id: string) {
    return mapAttendant(await this.findOwned(institutionId, id));
  }

  async update(
    actorUserId: string,
    institutionId: string,
    id: string,
    dto: UpdateAttendantDto,
  ) {
    const current = await this.findOwned(institutionId, id);
    if (dto.phone) {
      await this.assertPhoneAvailable(normalizePhone(dto.phone), current.userId);
    }
    if (dto.email) await assertEmailAvailable(this.prisma, dto.email, current.userId);
    const passwordHash = dto.password ? await hashPassword(dto.password) : undefined;
    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.fullName || dto.phone || dto.email || passwordHash) {
        await tx.shuttleUser.update({
          where: { id: current.userId },
          data: {
            fullName: dto.fullName,
            phone: dto.phone ? normalizePhone(dto.phone) : undefined,
            email: dto.email ? normalizeEmail(dto.email) : undefined,
            passwordHash,
          },
        });
      }
      const next = await tx.attendantProfile.update({
        where: { id },
        data: { nationalId: dto.nationalId },
        include: attendantInclude,
      });
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.ATTENDANT_UPDATED,
          entityType: ENTITY.ATTENDANT_PROFILE,
          entityId: id,
          before: mapAttendant(current),
          after: mapAttendant(next),
        },
        tx,
      );
      return next;
    });
    return mapAttendant(updated);
  }

  async updateStatus(
    actorUserId: string,
    institutionId: string,
    id: string,
    status: ResourceStatus,
  ) {
    const current = await this.findOwned(institutionId, id);
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.attendantProfile.update({
        where: { id },
        data: { status },
        include: attendantInclude,
      });
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.ATTENDANT_STATUS_CHANGED,
          entityType: ENTITY.ATTENDANT_PROFILE,
          entityId: id,
          before: { status: current.status },
          after: { status: next.status },
        },
        tx,
      );
      return next;
    });
    return mapAttendant(updated);
  }

  async available(institutionId: string) {
    await this.requireInstitution(institutionId);
    const rows = await this.prisma.attendantProfile.findMany({
      where: {
        institutionId,
        archivedAt: null,
        status: ResourceStatus.ACTIVE,
        defaultForRoute: { is: null },
      },
      include: attendantInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(mapAttendant);
  }

  private async findOwned(institutionId: string, id: string) {
    const attendant = await this.prisma.attendantProfile.findFirst({
      where: { id, institutionId, archivedAt: null },
      include: attendantInclude,
    });
    if (!attendant) {
      throw new AppException(
        'ATTENDANT_NOT_FOUND',
        'Attendant not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return attendant;
  }

  private async requireInstitution(institutionId: string) {
    const institution = await this.prisma.institution.findFirst({
      where: { id: institutionId, archivedAt: null },
      select: { id: true },
    });
    if (!institution) {
      throw new AppException(
        'INSTITUTION_NOT_FOUND',
        'Institution not found',
        HttpStatus.NOT_FOUND,
      );
    }
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
}
