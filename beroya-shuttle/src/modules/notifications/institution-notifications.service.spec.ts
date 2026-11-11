jest.mock('../../infra/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('./notification-dispatch.service', () => ({
  NotificationDispatchService: class NotificationDispatchService {},
}));
jest.mock('./notification-audience.service', () => ({
  NotificationAudienceService: class NotificationAudienceService {},
}));

import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { InstitutionNotificationsService } from './institution-notifications.service';

describe('InstitutionNotificationsService inbox', () => {
  const prisma = {
    notificationRecipient: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const audience = { resolve: jest.fn() };
  const dispatch = { enqueue: jest.fn() };
  const service = new InstitutionNotificationsService(
    prisma as never,
    audience as never,
    dispatch as never,
  );

  const notification = {
    id: 'n1',
    title: 'Hello',
    body: 'World',
    origin: 'SYSTEM',
    audience: 'ROUTE_DRIVERS',
    data: { type: 'TRIP_ASSIGNED' },
    createdAt: new Date('2026-10-05T08:00:00.000Z'),
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('lists inbox items for the current user only', async () => {
    prisma.notificationRecipient.count.mockResolvedValue(1);
    prisma.notificationRecipient.findMany.mockResolvedValue([
      {
        id: 'r1',
        status: 'SENT',
        sentAt: new Date('2026-10-05T08:00:00.000Z'),
        readAt: null,
        createdAt: new Date('2026-10-05T08:00:00.000Z'),
        notification,
      },
    ]);

    const result = await service.inbox('driver-1', { page: 1, limit: 20 });
    expect(prisma.notificationRecipient.count).toHaveBeenCalledWith({
      where: { userId: 'driver-1' },
    });
    expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    expect(result.data[0]).toMatchObject({
      id: 'r1',
      readAt: null,
      notification: { id: 'n1', title: 'Hello' },
    });
  });

  it('returns one inbox item by recipient or notification id', async () => {
    prisma.notificationRecipient.findFirst.mockResolvedValue({
      id: 'r1',
      userId: 'driver-1',
      status: 'SENT',
      sentAt: null,
      readAt: null,
      createdAt: new Date('2026-10-05T08:00:00.000Z'),
      notification,
    });

    const result = await service.inboxById('driver-1', 'n1');
    expect(prisma.notificationRecipient.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'driver-1',
        OR: [{ id: 'n1' }, { notificationId: 'n1' }],
      },
      include: { notification: true },
    });
    expect(result).toMatchObject({
      id: 'r1',
      notification: { id: 'n1', title: 'Hello' },
    });
  });

  it('rejects inbox get for another user notification', async () => {
    prisma.notificationRecipient.findFirst.mockResolvedValue(null);
    try {
      await service.inboxById('driver-1', 'missing');
      fail('expected NOTIFICATION_NOT_FOUND');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(HttpStatus.NOT_FOUND);
    }
  });

  it('marks one recipient as read for the owner', async () => {
    prisma.notificationRecipient.findFirst.mockResolvedValue({
      id: 'r1',
      userId: 'driver-1',
      status: 'SENT',
      sentAt: null,
      readAt: null,
      createdAt: new Date('2026-10-05T08:00:00.000Z'),
      notification,
    });
    prisma.notificationRecipient.update.mockResolvedValue({
      id: 'r1',
      status: 'SENT',
      sentAt: null,
      readAt: new Date('2026-10-05T09:00:00.000Z'),
      createdAt: new Date('2026-10-05T08:00:00.000Z'),
      notification,
    });

    const result = await service.markRead('driver-1', 'r1');
    expect(prisma.notificationRecipient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'r1' },
        data: { readAt: expect.any(Date) },
      }),
    );
    expect(result.readAt).toBeTruthy();
  });

  it('is idempotent when already read', async () => {
    const readAt = new Date('2026-10-05T09:00:00.000Z');
    prisma.notificationRecipient.findFirst.mockResolvedValue({
      id: 'r1',
      userId: 'driver-1',
      status: 'SENT',
      sentAt: null,
      readAt,
      createdAt: new Date('2026-10-05T08:00:00.000Z'),
      notification,
    });

    const result = await service.markRead('driver-1', 'r1');
    expect(prisma.notificationRecipient.update).not.toHaveBeenCalled();
    expect(result.readAt).toEqual(readAt);
  });

  it('rejects marking another user recipient', async () => {
    prisma.notificationRecipient.findFirst.mockResolvedValue(null);
    try {
      await service.markRead('driver-1', 'missing');
      fail('expected NOTIFICATION_NOT_FOUND');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(HttpStatus.NOT_FOUND);
    }
  });

  it('marks all unread recipients for the user', async () => {
    prisma.notificationRecipient.updateMany.mockResolvedValue({ count: 3 });
    await expect(service.markAllRead('driver-1')).resolves.toEqual({
      updatedCount: 3,
    });
    expect(prisma.notificationRecipient.updateMany).toHaveBeenCalledWith({
      where: { userId: 'driver-1', readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });
});
