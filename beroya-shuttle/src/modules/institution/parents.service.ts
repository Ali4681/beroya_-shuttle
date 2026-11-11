import { HttpStatus, Injectable } from '@nestjs/common';
import {
  buildPaginationMeta,
  paginationOffset,
} from '../../common/dto/pagination.dto';
import { AppException } from '../../common/errors/app.exception';
import { assertEmailAvailable } from '../../common/utils/email-availability';
import { hashPassword, normalizeEmail } from '../../common/utils/password';
import { normalizePhone } from '../../common/utils/phone';
import {
  Prisma,
  ShuttleRole,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AUDIT, ENTITY } from '../admin/admin.constants';
import { AuditService } from '../shared/audit/audit.service';
import { ListParentsQueryDto } from './dto/list-parents.query';
import { UpdateParentDto } from './dto/update-parent.dto';
import { PeopleUsersService } from './people-users.service';
import { mapParentDetail } from './people.mapper';

const parentInclude = {
  guardedStudents: {
    where: { archivedAt: null },
    orderBy: { fullName: 'asc' as const },
  },
};

@Injectable()
export class ParentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly people: PeopleUsersService,
  ) {}

  async list(institutionId: string, query: ListParentsQueryDto) {
    const where: Prisma.ShuttleUserWhereInput = {
      institutionId,
      role: ShuttleRole.PARENT,
      archivedAt: null,
    };
    if (query.status) {
      where.status = query.status;
    }
    if (query.branchId || query.routeId) {
      where.guardedStudents = {
        some: {
          institutionId,
          archivedAt: null,
          ...(query.branchId ? { branchId: query.branchId } : {}),
          ...(query.routeId
            ? {
                routeAssignments: {
                  some: { isActive: true, routeId: query.routeId },
                },
              }
            : {}),
        },
      };
    }
    if (query.search) {
      const search = query.search.trim();
      where.AND = [
        {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
          ],
        },
      ];
    }

    const total = await this.prisma.shuttleUser.count({ where });
    const rows = await this.prisma.shuttleUser.findMany({
      where,
      include: parentInclude,
      orderBy: { fullName: 'asc' },
      skip: paginationOffset(query.page, query.limit),
      take: query.limit,
    });
    return {
      data: rows.map(mapParentDetail),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async getById(institutionId: string, id: string) {
    return mapParentDetail(await this.findOwned(institutionId, id));
  }

  async update(
    actorUserId: string,
    institutionId: string,
    id: string,
    dto: UpdateParentDto,
  ) {
    const current = await this.findOwned(institutionId, id);
    const nextPhone = dto.phone ? normalizePhone(dto.phone) : undefined;
    if (nextPhone && nextPhone !== current.phone) {
      await this.people.assertPhoneAvailable(nextPhone, current.id);
    }
    if (dto.email) await assertEmailAvailable(this.prisma, dto.email, current.id);
    const passwordHash = dto.password ? await hashPassword(dto.password) : undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.shuttleUser.update({
        where: { id },
        data: {
          fullName: dto.fullName,
          phone: nextPhone,
          email: dto.email ? normalizeEmail(dto.email) : undefined,
          passwordHash,
        },
        include: parentInclude,
      });
      if (nextPhone && nextPhone !== current.phone) {
        await this.people.revokeAccess(id, tx);
      }
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.PARENT_UPDATED,
          entityType: ENTITY.SHUTTLE_USER,
          entityId: id,
          before: { fullName: current.fullName, phone: current.phone },
          after: { fullName: next.fullName, phone: next.phone },
        },
        tx,
      );
      return next;
    });
    return mapParentDetail(updated);
  }

  private async findOwned(institutionId: string, id: string) {
    const parent = await this.prisma.shuttleUser.findFirst({
      where: {
        id,
        institutionId,
        role: ShuttleRole.PARENT,
        archivedAt: null,
      },
      include: parentInclude,
    });
    if (!parent) {
      throw new AppException(
        'PARENT_NOT_FOUND',
        'Parent not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return parent;
  }
}
