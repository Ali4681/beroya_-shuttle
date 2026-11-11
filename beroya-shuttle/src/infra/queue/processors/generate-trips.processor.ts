import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { TripGenerationService } from '../../../modules/trips/trip-generation.service';
import { MaintenanceService } from '../maintenance.service';
import type { QueueConnection } from '../queue.constants';
import {
  isMockQueueConnection,
  QUEUE_CONNECTION,
  QUEUE_NAMES,
} from '../queue.constants';
import { QueueService } from '../queue.service';
import {
  GENERATE_TRIPS_SAFETY_NET_JOB,
  RESET_STOPPED_TODAY_JOB,
} from './maintenance.processor';

export const GENERATE_TRIPS_JOB = 'generate-trips';

@Injectable()
export class GenerateTripsProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GenerateTripsProcessor.name);
  private worker?: Worker;

  constructor(
    @Inject(QUEUE_CONNECTION) private readonly connection: QueueConnection,
    private readonly queueService: QueueService,
    private readonly generation: TripGenerationService,
    private readonly maintenance: MaintenanceService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (isMockQueueConnection(this.connection)) {
      return;
    }

    await this.queueService.scheduleRepeatable(
      QUEUE_NAMES.TRIPS,
      'generate-trips-minutely',
      GENERATE_TRIPS_JOB,
      '* * * * *',
    );
    await this.queueService.scheduleRepeatable(
      QUEUE_NAMES.TRIPS,
      'reset-stopped-today-minutely',
      RESET_STOPPED_TODAY_JOB,
      '* * * * *',
    );

    this.worker = new Worker(
      QUEUE_NAMES.TRIPS,
      async (job: Job) => {
        if (job.name === RESET_STOPPED_TODAY_JOB) {
          const reset = await this.maintenance.resetStoppedTodayDue();
          if (reset > 0) {
            this.logger.log(`Reset ${reset} STOPPED_TODAY route(s)`);
          }
          return { reset };
        }
        if (
          job.name !== GENERATE_TRIPS_JOB &&
          job.name !== GENERATE_TRIPS_SAFETY_NET_JOB
        ) {
          return;
        }
        const results = await this.generation.generateDue();
        if (results.length > 0) {
          this.logger.log(
            `Generated trips for ${results.length} institution(s)`,
          );
        }
        return { institutions: results.length };
      },
      { connection: this.connection },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
