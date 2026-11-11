import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import type { QueueConnection } from '../queue.constants';
import {
  isMockQueueConnection,
  QUEUE_CONNECTION,
  QUEUE_NAMES,
} from '../queue.constants';

@Injectable()
export class DefaultProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DefaultProcessor.name);
  private worker?: Worker;

  constructor(
    @Inject(QUEUE_CONNECTION) private readonly connection: QueueConnection,
  ) {}

  onModuleInit(): void {
    if (isMockQueueConnection(this.connection)) {
      this.logger.warn('MOCK_REDIS=true — skipping BullMQ worker');
      return;
    }

    this.worker = new Worker(
      QUEUE_NAMES.DEFAULT,
      (job: Job) => {
        this.logger.debug(`processed ${job.name} (${job.id})`);
        return Promise.resolve({
          ok: true,
          name: job.name,
          at: new Date().toISOString(),
        });
      },
      { connection: this.connection },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
