import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { DelayDetectionService } from '../../../modules/tracking/delay-detection.service';
import { TrackingService } from '../../../modules/tracking/tracking.service';
import { MaintenanceService } from '../maintenance.service';
import type { QueueConnection } from '../queue.constants';
import {
  isMockQueueConnection,
  QUEUE_CONNECTION,
  QUEUE_NAMES,
} from '../queue.constants';
import { QueueService } from '../queue.service';
import { ARRIVAL_ALERTS_JOB } from './maintenance.processor';

export const DETECT_DELAYS_JOB = 'detect-delays';
export const MARK_STALE_JOB = 'mark-gps-stale';
export const CLEANUP_PINGS_JOB = 'cleanup-location-pings';

@Injectable()
export class TrackingJobsProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrackingJobsProcessor.name);
  private worker?: Worker;

  constructor(
    @Inject(QUEUE_CONNECTION) private readonly connection: QueueConnection,
    private readonly queueService: QueueService,
    private readonly delay: DelayDetectionService,
    private readonly tracking: TrackingService,
    private readonly maintenance: MaintenanceService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (isMockQueueConnection(this.connection)) {
      return;
    }

    await this.queueService.scheduleEvery(
      QUEUE_NAMES.TRACKING,
      'detect-delays-minutely',
      DETECT_DELAYS_JOB,
      60_000,
    );
    await this.queueService.scheduleEvery(
      QUEUE_NAMES.TRACKING,
      'arrival-alerts-minutely',
      ARRIVAL_ALERTS_JOB,
      60_000,
    );
    await this.queueService.scheduleRepeatable(
      QUEUE_NAMES.TRACKING,
      'gps-stale-minutely',
      MARK_STALE_JOB,
      '* * * * *',
    );
    await this.queueService.scheduleRepeatable(
      QUEUE_NAMES.TRACKING,
      'cleanup-pings-weekly',
      CLEANUP_PINGS_JOB,
      '0 3 * * 0',
    );

    this.worker = new Worker(
      QUEUE_NAMES.TRACKING,
      async (job: Job) => {
        if (job.name === DETECT_DELAYS_JOB) {
          const result = await this.delay.scan();
          if (result.alerts > 0) {
            this.logger.log(`Delay alerts: ${result.alerts}/${result.checked}`);
          }
          return result;
        }
        if (job.name === ARRIVAL_ALERTS_JOB) {
          const result = await this.maintenance.scanArrivalAlerts();
          if (result.sent > 0) {
            this.logger.log(`Arrival alerts: ${result.sent}/${result.checked}`);
          }
          return result;
        }
        if (job.name === MARK_STALE_JOB) {
          const marked = await this.tracking.markStaleTrips();
          if (marked > 0) {
            this.logger.log(`Marked ${marked} trip(s) GPS stale`);
          }
          return { marked };
        }
        if (job.name === CLEANUP_PINGS_JOB) {
          const removed = await this.tracking.cleanupOldPings();
          if (removed > 0) {
            this.logger.log(`Removed ${removed} old location pings`);
          }
          return { removed };
        }
        return null;
      },
      { connection: this.connection },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
