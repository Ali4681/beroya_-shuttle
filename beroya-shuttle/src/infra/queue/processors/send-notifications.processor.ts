import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import {
  NotificationDispatchService,
  SEND_NOTIFICATION_JOB,
} from '../../../modules/notifications/notification-dispatch.service';
import type { QueueConnection } from '../queue.constants';
import {
  isMockQueueConnection,
  QUEUE_CONNECTION,
  QUEUE_NAMES,
} from '../queue.constants';

@Injectable()
export class SendNotificationsProcessor
  implements OnModuleInit, OnModuleDestroy
{
  private worker?: Worker;

  constructor(
    @Inject(QUEUE_CONNECTION) private readonly connection: QueueConnection,
    private readonly dispatch: NotificationDispatchService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (isMockQueueConnection(this.connection)) {
      return;
    }
    this.worker = new Worker(
      QUEUE_NAMES.NOTIFICATIONS,
      async (job: Job<{ notificationId: string; highPriority?: boolean }>) => {
        if (job.name !== SEND_NOTIFICATION_JOB) {
          return;
        }
        await this.dispatch.deliver(
          job.data.notificationId,
          job.data.highPriority === true,
        );
      },
      { connection: this.connection },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
