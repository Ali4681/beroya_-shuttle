import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  buildPaginationMeta,
  paginationOffset,
} from '../../common/dto/pagination.dto';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AdminAuditLogsQueryDto, AuditLogsQueryDto } from './dto/audit-logs.query';
import { mapAuditLog } from './insights.mapper';

const actorInclude = {
  actorUser: {
    select: { id: true, fullName: true, role: true },
  },
} as const;

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async listInstitution(institutionId: string, query: AuditLogsQueryDto) {
    return this.list({ ...this.buildWhere(query), institutionId }, query);
  }

  async getInstitution(institutionId: string, id: string) {
    const row = await this.prisma.shuttleAuditLog.findFirst({
      where: { id, institutionId },
      include: actorInclude,
    });
    if (!row) {
      throw new AppException(
        'AUDIT_LOG_NOT_FOUND',
        'Audit log not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return mapAuditLog(row);
  }

  async listAdmin(query: AdminAuditLogsQueryDto) {
    return this.list(this.buildWhere(query), query);
  }

  async getAdmin(id: string) {
    const row = await this.prisma.shuttleAuditLog.findUnique({
      where: { id },
      include: actorInclude,
    });
    if (!row) {
      throw new AppException(
        'AUDIT_LOG_NOT_FOUND',
        'Audit log not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return mapAuditLog(row);
  }

  private async list(where: Prisma.ShuttleAuditLogWhereInput, query: AuditLogsQueryDto) {
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.shuttleAuditLog.count({ where }),
      this.prisma.shuttleAuditLog.findMany({
        where,
        include: actorInclude,
        orderBy: { createdAt: 'desc' },
        skip: paginationOffset(query.page, query.limit),
        take: query.limit,
      }),
    ]);

    return {
      data: rows.map(mapAuditLog),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  private buildWhere(
    query: AdminAuditLogsQueryDto,
  ): Prisma.ShuttleAuditLogWhereInput {
    const createdAt = this.parseCreatedAt(query.dateFrom, query.dateTo);
    return {
      ...(query.institutionId ? { institutionId: query.institutionId } : {}),
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(createdAt ? { createdAt } : {}),
    };
  }

  private parseCreatedAt(
    dateFrom?: string,
    dateTo?: string,
  ): Prisma.DateTimeFilter | undefined {
    if (!dateFrom && !dateTo) {
      return undefined;
    }
    const filter: Prisma.DateTimeFilter = {};
    if (dateFrom) {
      filter.gte = this.parseBound(dateFrom, false);
    }
    if (dateTo) {
      filter.lte = this.parseBound(dateTo, true);
    }
    return filter;
  }

  private parseBound(value: string, endOfDay: boolean): Date {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date(`${value}T${endOfDay ? '23:59:59.999Z' : '00:00:00.000Z'}`);
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new AppException(
        'INVALID_DATE',
        'date_from / date_to must be a valid ISO date',
        HttpStatus.BAD_REQUEST,
      );
    }
    return parsed;
  }
}
