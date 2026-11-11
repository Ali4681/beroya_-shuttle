import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { getRequestContext } from './common/request-context/request-context';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';
import { Env } from './config/env.schema';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { CaseTransformMiddleware } from './common/request-context/case-transform.middleware';
import { RequestContextMiddleware } from './common/request-context/request-context.middleware';
import { validateEnv } from './config/env.schema';
import { PrismaModule } from './infra/prisma/prisma.module';
import { QueueModule } from './infra/queue/queue.module';
import { RedisModule } from './infra/redis/redis.module';
// OTP parked — restore SmsModule with /auth/otp routes.
// import { SmsModule } from './infra/sms/sms.module';
import { AdminModule } from './modules/admin/admin.module';
import { PlatformSettingsModule } from './modules/admin/platform-settings.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { InstitutionModule } from './modules/institution/institution.module';
import { AuditModule } from './modules/shared/audit/audit.module';
import { FcmModule } from './infra/fcm/fcm.module';
import { NotificationModule } from './modules/shared/notifications/notification.module';
import { RoutingModule } from './infra/routing/routing.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { CrewModule } from './modules/crew/crew.module';
import { InsightsModule } from './modules/insights/insights.module';
import { LegalModule } from './modules/legal/legal.module';
import { OpsModule } from './modules/ops/ops.module';
import { PassengerModule } from './modules/passenger/passenger.module';
import { MetricsModule } from './infra/metrics/metrics.module';
import { StorageModule } from './infra/storage/storage.module';
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
        customProps: () => {
          const ctx = getRequestContext();
          return {
            requestId: ctx?.requestId,
            institutionId: ctx?.institutionId,
          };
        },
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
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        throttlers: [
          {
            ttl: config.get('RATE_LIMIT_TTL_MS', { infer: true }),
            limit: config.get('RATE_LIMIT_MAX', { infer: true }),
          },
        ],
      }),
    }),
    MetricsModule,
    StorageModule,
    PrismaModule,
    RedisModule,
    // SmsModule,
    AuditModule,
    FcmModule,
    NotificationModule,
    RoutingModule,
    TripEventModule,
    RealtimeModule,
    TrackingModule,
    CrewModule,
    PassengerModule,
    InsightsModule,
    LegalModule,
    OpsModule,
    IncidentsModule,
    TripsModule,
    QueueModule.forRoot({ registerProcessors: false }),
    HealthModule,
    AuthModule,
    PlatformSettingsModule,
    AdminModule,
    InstitutionModule,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(CaseTransformMiddleware, RequestContextMiddleware)
      .forRoutes('*');
  }
}
