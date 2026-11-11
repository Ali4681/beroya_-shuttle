import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import {
  buildPaginationMeta,
  paginationOffset,
} from '../../common/dto/pagination.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import {
  DeliveryStatus,
  NotificationOrigin,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AudiencePreviewDto } from './dto/audience-preview.dto';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationAudienceService } from './notification-audience.service';
import { NotificationDispatchService } from './notification-dispatch.service';
import { mapInboxItem, mapNotification } from './notification.mapper';

@Injectable()
export class InstitutionNotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audience: NotificationAudienceService,
    private readonly dispatch: NotificationDispatchService,
  ) {}

  async preview(institutionId: string, dto: AudiencePreviewDto) {
    const userIds = await this.audience.resolve({
      institutionId,
      audience: dto.audience,
      routeId: dto.routeId,
    });
    return { recipientsCount: userIds.length };
  }

  async create(
    actorUserId: string,
    institutionId: string,
    dto: CreateNotificationDto,
  ) {
    const userIds = await this.audience.resolve({
      institutionId,
      audience: dto.audience,
      routeId: dto.routeId,
    });
    const created = await this.prisma.shuttleNotification.create({
      data: {
        institutionId,
        routeId: dto.routeId,
        audience: dto.audience,
        origin: NotificationOrigin.MANUAL,
        title: dto.title,
        body: dto.body,
        data: {
          type: 'INSTITUTION_BROADCAST',
          ...(dto.routeId ? { routeId: dto.routeId } : {}),
        },
        recipientsCount: userIds.length,
        sentByUserId: actorUserId,
      },
    });
    if (userIds.length > 0) {
      await this.prisma.notificationRecipient.createMany({
        data: userIds.map((userId) => ({
          notificationId: created.id,
          userId,
          status: DeliveryStatus.PENDING,
        })),
        skipDuplicates: true,
      });
    }
    await this.dispatch.enqueue(created.id);
    return mapNotification(created);
  }

  async list(institutionId: string, query: PaginationDto) {
    const where = { institutionId };
    const total = await this.prisma.shuttleNotification.count({ where });
    const rows = await this.prisma.shuttleNotification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: paginationOffset(query.page, query.limit),
      take: query.limit,
    });
    return {
      data: rows.map(mapNotification),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async getById(institutionId: string, id: string) {
    const row = await this.prisma.shuttleNotification.findFirst({
      where: { id, institutionId },
      include: {
        recipients: {
          include: {
            user: {
              select: { id: true, fullName: true, phone: true, role: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!row) {
      throw new AppException(
        'NOTIFICATION_NOT_FOUND',
        'Notification not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return mapNotification(row);
  }

  async inbox(userId: string, query: PaginationDto) {
    const where = { userId };
    const total = await this.prisma.notificationRecipient.count({ where });
    const rows = await this.prisma.notificationRecipient.findMany({
      where,
      include: { notification: true },
      orderBy: { createdAt: 'desc' },
      skip: paginationOffset(query.page, query.limit),
      take: query.limit,
    });
    return {
      data: rows.map((row) => mapInboxItem(row)),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  /** Inbox item by recipient id or notification id (FCM `notificationId`). */
  async inboxById(userId: string, id: string) {
    const row = await this.prisma.notificationRecipient.findFirst({
      where: {
        userId,
        OR: [{ id }, { notificationId: id }],
      },
      include: { notification: true },
    });
    if (!row) {
      throw new AppException(
        'NOTIFICATION_NOT_FOUND',
        'Notification not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return mapInboxItem(row);
  }

  async markRead(userId: string, recipientId: string) {
    const row = await this.prisma.notificationRecipient.findFirst({
      where: { id: recipientId, userId },
      include: { notification: true },
    });
    if (!row) {
      throw new AppException(
        'NOTIFICATION_NOT_FOUND',
        'Notification not found',
        HttpStatus.NOT_FOUND,
      );
    }
    if (row.readAt) {
      return mapInboxItem(row);
    }
    const updated = await this.prisma.notificationRecipient.update({
      where: { id: recipientId },
      data: { readAt: new Date() },
      include: { notification: true },
    });
    return mapInboxItem(updated);
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notificationRecipient.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updatedCount: result.count };
  }
}
