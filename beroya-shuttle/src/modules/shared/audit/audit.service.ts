import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { getRequestContext } from '../../../common/request-context/request-context';

export type AuditRecordInput = {
  actorUserId: string;
  institutionId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
};

type AuditDb = {
  shuttleAuditLog: PrismaService['shuttleAuditLog'];
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    input: AuditRecordInput,
    db: AuditDb = this.prisma,
  ): Promise<void> {
    const store = getRequestContext();
    await db.shuttleAuditLog.create({
      data: {
        actorUserId: input.actorUserId,
        institutionId: input.institutionId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        before:
          input.before === undefined
            ? undefined
            : (input.before as Prisma.InputJsonValue),
        after:
          input.after === undefined
            ? undefined
            : (input.after as Prisma.InputJsonValue),
        ipAddress: store?.ipAddress,
        userAgent: store?.userAgent,
      },
    });
  }
}
