import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { validateEnv } from './config/env.schema';
import { FcmModule } from './infra/fcm/fcm.module';
import { PrismaModule } from './infra/prisma/prisma.module';
import { QueueModule } from './infra/queue/queue.module';
import { RedisModule } from './infra/redis/redis.module';
import { NotificationModule } from './modules/shared/notifications/notification.module';
import { RealtimeCoreModule } from './modules/realtime/realtime.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { TripEventModule } from './modules/trips/trip-event.module';
import { TripsModule } from './modules/trips/trips.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      envFilePath: ['.env'],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  singleLine: true,
                  translateTime: 'SYS:standard',
                },
              }
            : undefined,
      },
    }),
    PrismaModule,
    RedisModule,
    FcmModule,
    NotificationModule,
    QueueModule.forRoot({ registerProcessors: true }),
    TripEventModule,
    RealtimeCoreModule,
    TrackingModule,
    TripsModule,
  ],
})
export class WorkerModule {}
