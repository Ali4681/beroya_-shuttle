import { HttpStatus, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  buildPaginationMeta,
  paginationOffset,
} from '../../common/dto/pagination.dto';
import { AppException } from '../../common/errors/app.exception';
import { Env } from '../../config/env.schema';
import {
  Prisma,
  SubscriptionStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../shared/audit/audit.service';
import { AUDIT, ENTITY } from './admin.constants';
import { mapSubscription } from './admin.mapper';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { ExtendSubscriptionDto } from './dto/extend-subscription.dto';
import { ListSubscriptionsQueryDto } from './dto/list-subscriptions.query';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import {
  assertCanCancel,
  assertCanExtend,
  assertExtendMovesForward,
  assertNoActiveOverlap,
  assertSubscriptionPending,
  assertValidSubscriptionWindow,
} from './subscription.rules';

@Injectable()
export class SubscriptionsService implements OnModuleDestroy {
  private readonly logger = new Logger(SubscriptionsService.name);
  private expireTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    config: ConfigService<Env, true>,
  ) {
    if (config.get('MOCK_REDIS', { infer: true })) {
      this.expireTimer = setInterval(() => {
        void this.expireOverdue().catch((error: unknown) => {
          this.logger.error(
            error instanceof Error ? error.message : 'expire overdue failed',
          );
        });
      }, 15 * 60 * 1000);
      this.expireTimer.unref();
    }
  }

  onModuleDestroy(): void {
    if (this.expireTimer) {
      clearInterval(this.expireTimer);
    }
  }

  async expireOverdue(): Promise<number> {
    const result = await this.prisma.institutionSubscription.updateMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        endsAt: { lt: new Date() },
      },
      data: { status: SubscriptionStatus.EXPIRED },
    });
    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} institution subscription(s)`);
    }
    return result.count;
  }

  async list(query: ListSubscriptionsQueryDto) {
    await this.expireOverdue();
    const where = this.buildListWhere(query);
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.institutionSubscription.count({ where }),
      this.prisma.institutionSubscription.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: paginationOffset(query.page, query.limit),
        take: query.limit,
      }),
    ]);
    return {
      data: rows.map(mapSubscription),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async listForInstitution(
    institutionId: string,
    query: ListSubscriptionsQueryDto,
  ) {
    await this.assertInstitution(institutionId);
    return this.list({ ...query, institutionId });
  }

  async create(
    actorUserId: string,
    institutionId: string,
    dto: CreateSubscriptionDto,
  ) {
    await this.assertInstitution(institutionId);
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    assertValidSubscriptionWindow(startsAt, endsAt);

    const created = await this.prisma.$transaction(async (tx) => {
      const subscription = await tx.institutionSubscription.create({
        data: {
          institutionId,
          billingPeriod: dto.billingPeriod,
          startsAt,
          endsAt,
          agreedAmount: dto.agreedAmount,
          currencyCode: dto.currencyCode ?? 'USD',
          notes: dto.notes,
        },
      });
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.SUBSCRIPTION_CREATED,
          entityType: ENTITY.INSTITUTION_SUBSCRIPTION,
          entityId: subscription.id,
          after: mapSubscription(subscription),
        },
        tx,
      );
      return subscription;
    });
    return mapSubscription(created);
  }

  async update(
    actorUserId: string,
    institutionId: string,
    subscriptionId: string,
    dto: UpdateSubscriptionDto,
  ) {
    const current = await this.findOwned(institutionId, subscriptionId);
    assertSubscriptionPending(current.status);
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : current.startsAt;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : current.endsAt;
    assertValidSubscriptionWindow(startsAt, endsAt);

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.institutionSubscription.update({
        where: { id: subscriptionId },
        data: {
          billingPeriod: dto.billingPeriod,
          startsAt: dto.startsAt ? startsAt : undefined,
          endsAt: dto.endsAt ? endsAt : undefined,
          agreedAmount: dto.agreedAmount,
          currencyCode: dto.currencyCode,
          notes: dto.notes,
        },
      });
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.SUBSCRIPTION_UPDATED,
          entityType: ENTITY.INSTITUTION_SUBSCRIPTION,
          entityId: subscriptionId,
          before: mapSubscription(current),
          after: mapSubscription(next),
        },
        tx,
      );
      return next;
    });
    return mapSubscription(updated);
  }

  async activate(
    actorUserId: string,
    institutionId: string,
    subscriptionId: string,
  ) {
    await this.expireOverdue();
    const current = await this.findOwned(institutionId, subscriptionId);
    assertSubscriptionPending(current.status);
    if (current.endsAt <= new Date()) {
      throw new AppException(
        'SUBSCRIPTION_WINDOW_PASSED',
        'Cannot activate a subscription whose end date has passed',
        HttpStatus.CONFLICT,
      );
    }

    const actives = await this.prisma.institutionSubscription.findMany({
      where: {
        institutionId,
        status: SubscriptionStatus.ACTIVE,
      },
    });
    assertNoActiveOverlap(current, actives);

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.institutionSubscription.update({
        where: { id: subscriptionId },
        data: {
          status: SubscriptionStatus.ACTIVE,
          activatedAt: new Date(),
        },
      });
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.SUBSCRIPTION_ACTIVATED,
          entityType: ENTITY.INSTITUTION_SUBSCRIPTION,
          entityId: subscriptionId,
          before: mapSubscription(current),
          after: mapSubscription(next),
        },
        tx,
      );
      return next;
    });
    return mapSubscription(updated);
  }

  async cancel(
    actorUserId: string,
    institutionId: string,
    subscriptionId: string,
    dto: CancelSubscriptionDto,
  ) {
    const current = await this.findOwned(institutionId, subscriptionId);
    assertCanCancel(current.status);
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.institutionSubscription.update({
        where: { id: subscriptionId },
        data: {
          status: SubscriptionStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: dto.reason,
        },
      });
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.SUBSCRIPTION_CANCELLED,
          entityType: ENTITY.INSTITUTION_SUBSCRIPTION,
          entityId: subscriptionId,
          before: mapSubscription(current),
          after: mapSubscription(next),
        },
        tx,
      );
      return next;
    });
    return mapSubscription(updated);
  }

  async extend(
    actorUserId: string,
    institutionId: string,
    subscriptionId: string,
    dto: ExtendSubscriptionDto,
  ) {
    const current = await this.findOwned(institutionId, subscriptionId);
    assertCanExtend(current.status);
    const newEndDate = new Date(dto.newEndDate);
    assertExtendMovesForward(current.endsAt, newEndDate);

    const actives = await this.prisma.institutionSubscription.findMany({
      where: {
        institutionId,
        status: SubscriptionStatus.ACTIVE,
        id: { not: subscriptionId },
      },
    });
    assertNoActiveOverlap(
      { startsAt: current.startsAt, endsAt: newEndDate },
      actives,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.institutionSubscription.update({
        where: { id: subscriptionId },
        data: { endsAt: newEndDate },
      });
      await this.audit.record(
        {
          actorUserId,
          institutionId,
          action: AUDIT.SUBSCRIPTION_EXTENDED,
          entityType: ENTITY.INSTITUTION_SUBSCRIPTION,
          entityId: subscriptionId,
          before: { endsAt: current.endsAt },
          after: { endsAt: next.endsAt },
        },
        tx,
      );
      return next;
    });
    return mapSubscription(updated);
  }

  private async findOwned(institutionId: string, subscriptionId: string) {
    await this.assertInstitution(institutionId);
    const subscription = await this.prisma.institutionSubscription.findFirst({
      where: { id: subscriptionId, institutionId },
    });
    if (!subscription) {
      throw new AppException(
        'SUBSCRIPTION_NOT_FOUND',
        'Subscription not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return subscription;
  }

  private async assertInstitution(institutionId: string): Promise<void> {
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

  private buildListWhere(
    query: ListSubscriptionsQueryDto,
  ): Prisma.InstitutionSubscriptionWhereInput {
    const where: Prisma.InstitutionSubscriptionWhereInput = {};
    if (query.institutionId) {
      where.institutionId = query.institutionId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.billingPeriod) {
      where.billingPeriod = query.billingPeriod;
    }
    if (query.startsFrom || query.endsTo) {
      where.AND = [
        query.startsFrom ? { startsAt: { gte: new Date(query.startsFrom) } } : {},
        query.endsTo ? { endsAt: { lte: new Date(query.endsTo) } } : {},
      ];
    }
    return where;
  }
}
