import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env.schema';
import { parseAppLocale } from '../../common/i18n';
import { DeliveryStatus } from '../../generated/prisma/client';
import type { FcmProvider } from '../../infra/fcm/fcm.types';
import { FCM_BATCH_SIZE, FCM_PROVIDER } from '../../infra/fcm/fcm.types';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { QUEUE_NAMES } from '../../infra/queue/queue.constants';
import { QueueService } from '../../infra/queue/queue.service';
import { PlatformSettingsService } from '../admin/platform-settings.service';
import { fcmEnabledFor, noticeForLocale } from '../admin/platform-settings';
import { buildFcmRoutingData } from './fcm-routing-data';

export const SEND_NOTIFICATION_JOB = 'send-notification';

@Injectable()
export class NotificationDispatchService {
  private readonly logger = new Logger(NotificationDispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly config: ConfigService<Env, true>,
    @Inject(FCM_PROVIDER) private readonly fcm: FcmProvider,
    private readonly platform: PlatformSettingsService,
  ) {}

  async enqueue(notificationId: string, highPriority = false): Promise<void> {
    if (this.config.get('MOCK_REDIS', { infer: true })) {
      void this.deliver(notificationId, highPriority).catch((error: unknown) => {
        this.logger.error(
          `mock FCM deliver failed for ${notificationId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
      return;
    }
    await this.queue.enqueue(
      QUEUE_NAMES.NOTIFICATIONS,
      SEND_NOTIFICATION_JOB,
      { notificationId, highPriority },
    );
  }

  async deliver(notificationId: string, highPriority = false): Promise<void> {
    const notification = await this.prisma.shuttleNotification.findUnique({
      where: { id: notificationId },
      include: {
        recipients: {
          where: { status: DeliveryStatus.PENDING },
          include: { user: { include: { devices: true } } },
        },
      },
    });
    if (!notification) {
      return;
    }

    const settings = await this.platform.read();
    const data =
      notification.data && typeof notification.data === 'object' && !Array.isArray(notification.data)
        ? (notification.data as Record<string, unknown>)
        : {};
    const pushEnabled = fcmEnabledFor(
      settings,
      notification.audience,
      typeof data.internalAudience === 'string' ? data.internalAudience : null,
    );

    type LocaleBatch = {
      tokens: string[];
      tokenToRecipient: Map<string, string[]>;
    };
    const byLocale = new Map<string, LocaleBatch>();
    const inboxOnly: string[] = [];

    for (const recipient of notification.recipients) {
      if (!pushEnabled || recipient.user.devices.length === 0) {
        inboxOnly.push(recipient.id);
        continue;
      }
      for (const device of recipient.user.devices) {
        const locale = parseAppLocale(device.locale);
        let batch = byLocale.get(locale);
        if (!batch) {
          batch = { tokens: [], tokenToRecipient: new Map() };
          byLocale.set(locale, batch);
        }
        const list = batch.tokenToRecipient.get(device.fcmToken) ?? [];
        if (list.length === 0) {
          batch.tokens.push(device.fcmToken);
        }
        list.push(recipient.id);
        batch.tokenToRecipient.set(device.fcmToken, list);
      }
    }

    const sentRecipients = new Set<string>(inboxOnly);
    const failedRecipients = new Set<string>();

    for (const [locale, batch] of byLocale) {
      const copy = noticeForLocale(
        notification.title,
        notification.body,
        notification.data,
        locale,
      );
      for (let i = 0; i < batch.tokens.length; i += FCM_BATCH_SIZE) {
        const tokens = batch.tokens.slice(i, i + FCM_BATCH_SIZE);
        const result = await this.fcm.send({
          title: copy.title,
          body: copy.body,
          tokens,
          highPriority,
          android: highPriority
            ? { priority: 'high', channelId: 'shuttle_arrival' }
            : undefined,
          apns: highPriority
            ? {
                interruptionLevel: 'time-sensitive',
                sound: 'arrival.caf',
                contentAvailable: true,
              }
            : undefined,
          data: buildFcmRoutingData(
            notificationId,
            notification.origin,
            notification.audience,
            locale,
            data,
            notification.routeId,
          ),
        });
        if (result.invalidTokens.length > 0) {
          await this.prisma.userDevice.deleteMany({
            where: { fcmToken: { in: result.invalidTokens } },
          });
        }
        const dead = new Set(result.invalidTokens);
        for (const token of tokens) {
          for (const recipientId of batch.tokenToRecipient.get(token) ?? []) {
            if (dead.has(token)) {
              failedRecipients.add(recipientId);
            } else {
              sentRecipients.add(recipientId);
              failedRecipients.delete(recipientId);
            }
          }
        }
      }
    }

    const now = new Date();
    if (sentRecipients.size > 0) {
      await this.prisma.notificationRecipient.updateMany({
        where: { id: { in: [...sentRecipients] } },
        data: { status: DeliveryStatus.SENT, sentAt: now, errorMessage: null },
      });
    }
    const onlyFailed = [...failedRecipients].filter(
      (id) => !sentRecipients.has(id),
    );
    if (onlyFailed.length > 0) {
      await this.prisma.notificationRecipient.updateMany({
        where: { id: { in: onlyFailed } },
        data: {
          status: DeliveryStatus.FAILED,
          errorMessage: 'FCM delivery failed',
        },
      });
    }

    const counts = await this.prisma.notificationRecipient.groupBy({
      by: ['status'],
      where: { notificationId },
      _count: { _all: true },
    });
    const sentCount =
      counts.find((row) => row.status === DeliveryStatus.SENT)?._count._all ?? 0;
    const failedCount =
      counts.find((row) => row.status === DeliveryStatus.FAILED)?._count._all ??
      0;
    await this.prisma.shuttleNotification.update({
      where: { id: notificationId },
      data: { sentCount, failedCount },
    });
    this.logger.debug(
      `notification ${notificationId} sent=${sentCount} failed=${failedCount}`,
    );
  }
}
