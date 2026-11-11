import { DynamicModule, Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env.schema';
import { NotificationModule } from '../../modules/shared/notifications/notification.module';
import { TrackingModule } from '../../modules/tracking/tracking.module';
import { TripsModule } from '../../modules/trips/trips.module';
import { DefaultProcessor } from './processors/default.processor';
import { ExpireSubscriptionsProcessor } from './processors/expire-subscriptions.processor';
import { GenerateTripsProcessor } from './processors/generate-trips.processor';
import { PersistLocationProcessor } from './processors/persist-location.processor';
import { SendNotificationsProcessor } from './processors/send-notifications.processor';
import { TrackingJobsProcessor } from './processors/tracking-jobs.processor';
import { MaintenanceService } from './maintenance.service';
import { QUEUE_CONNECTION } from './queue.constants';
import { QueueService } from './queue.service';

export type QueueModuleOptions = {
  registerProcessors?: boolean;
};

@Module({})
export class QueueModule {
  static forRoot(options: QueueModuleOptions = {}): DynamicModule {
    const providers: Provider[] = [
      {
        provide: QUEUE_CONNECTION,
        inject: [ConfigService],
        useFactory: (config: ConfigService<Env, true>) => {
          if (config.get('MOCK_REDIS', { infer: true })) {
            return { mock: true as const };
          }
          const password = config.get('REDIS_PASSWORD', { infer: true });
          return {
            host: config.get('REDIS_HOST', { infer: true }),
            port: config.get('REDIS_PORT', { infer: true }),
            password: password || undefined,
            maxRetriesPerRequest: null,
          };
        },
      },
      QueueService,
    ];

    if (options.registerProcessors) {
      providers.push(
        MaintenanceService,
        DefaultProcessor,
        ExpireSubscriptionsProcessor,
        GenerateTripsProcessor,
        PersistLocationProcessor,
        TrackingJobsProcessor,
        SendNotificationsProcessor,
      );
    }

    return {
      module: QueueModule,
      global: true,
      imports: options.registerProcessors
        ? [TripsModule, TrackingModule, NotificationModule]
        : [],
      providers,
      exports: [QUEUE_CONNECTION, QueueService],
    };
  }
}
