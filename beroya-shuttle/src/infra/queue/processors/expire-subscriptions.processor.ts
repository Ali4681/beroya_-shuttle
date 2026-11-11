import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionStatus } from '../../../generated/prisma/client';
import type { QueueConnection } from '../queue.constants';
import {
  isMockQueueConnection,
  QUEUE_CONNECTION,
  QUEUE_NAMES,
} from '../queue.constants';
import { QueueService } from '../queue.service';
import { CLEANUP_SESSIONS_JOB } from './maintenance.processor';
import { MaintenanceService } from '../maintenance.service';

export const EXPIRE_SUBSCRIPTIONS_JOB = 'expire-subscriptions';

@Injectable()
export class ExpireSubscriptionsProcessor
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ExpireSubscriptionsProcessor.name);
  private worker?: Worker;

  constructor(
    @Inject(QUEUE_CONNECTION) private readonly connection: QueueConnection,
    private readonly queueService: QueueService,
    private readonly prisma: PrismaService,
    private readonly maintenance: MaintenanceService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (isMockQueueConnection(this.connection)) {
      return;
    }

    await this.queueService.scheduleRepeatable(
      QUEUE_NAMES.BILLING,
      'expire-subscriptions-daily',
      EXPIRE_SUBSCRIPTIONS_JOB,
      '30 0 * * *',
    );
    await this.queueService.scheduleRepeatable(
      QUEUE_NAMES.BILLING,
      'cleanup-sessions-daily',
      CLEANUP_SESSIONS_JOB,
      '15 0 * * *',
    );

    this.worker = new Worker(
      QUEUE_NAMES.BILLING,
      async (job: Job) => {
        if (job.name === CLEANUP_SESSIONS_JOB) {
          const removed = await this.maintenance.cleanupExpiredSessions();
          if (removed > 0) {
            this.logger.log(`Removed ${removed} expired session(s)`);
          }
          return { removed };
        }
        if (job.name !== EXPIRE_SUBSCRIPTIONS_JOB) {
          return;
        }
        const result = await this.prisma.institutionSubscription.updateMany({
          where: {
            status: SubscriptionStatus.ACTIVE,
            endsAt: { lt: new Date() },
          },
          data: { status: SubscriptionStatus.EXPIRED },
        });
        this.logger.log(`Expired ${result.count} institution subscription(s)`);
        return { expired: result.count };
      },
      { connection: this.connection },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
