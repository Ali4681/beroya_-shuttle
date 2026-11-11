import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { TrackingService } from '../../../modules/tracking/tracking.service';
import type { LiveLocation } from '../../../modules/tracking/live-location.store';
import { PERSIST_LOCATION_JOB } from '../../../modules/tracking/tracking.service';
import { MaintenanceService } from '../maintenance.service';
import type { QueueConnection } from '../queue.constants';
import {
  isMockQueueConnection,
  QUEUE_CONNECTION,
  QUEUE_NAMES,
} from '../queue.constants';
import { QueueService } from '../queue.service';
import { FLUSH_LOCATION_PINGS_JOB } from './maintenance.processor';

@Injectable()
export class PersistLocationProcessor implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker;

  constructor(
    @Inject(QUEUE_CONNECTION) private readonly connection: QueueConnection,
    private readonly tracking: TrackingService,
    private readonly queueService: QueueService,
    private readonly maintenance: MaintenanceService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (isMockQueueConnection(this.connection)) {
      return;
    }
    await this.queueService.scheduleEvery(
      QUEUE_NAMES.LOCATION_PINGS,
      'flush-location-pings-30s',
      FLUSH_LOCATION_PINGS_JOB,
      30_000,
    );
    this.worker = new Worker(
      QUEUE_NAMES.LOCATION_PINGS,
      async (job: Job<LiveLocation>) => {
        if (job.name === FLUSH_LOCATION_PINGS_JOB) {
          const flushed = await this.maintenance.flushLocationPings();
          return { flushed };
        }
        if (job.name !== PERSIST_LOCATION_JOB) {
          return;
        }
        return this.tracking.persistSample(job.data);
      },
      { connection: this.connection },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
