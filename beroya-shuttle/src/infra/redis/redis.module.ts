import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Env } from '../../config/env.schema';
import { InMemoryRedis } from './in-memory-redis';
import { REDIS_CLIENT } from './redis.constants';
import { RedisService } from './redis.service';
import type { RedisClient } from './redis.types';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): RedisClient => {
        if (config.get('MOCK_REDIS', { infer: true })) {
          new Logger('RedisModule').warn(
            'MOCK_REDIS=true — using in-memory Redis',
          );
          return new InMemoryRedis();
        }

        const password = config.get('REDIS_PASSWORD', { infer: true });
        const client = new Redis({
          host: config.get('REDIS_HOST', { infer: true }),
          port: config.get('REDIS_PORT', { infer: true }),
          password: password || undefined,
          lazyConnect: false,
          connectTimeout: 5000,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
        });
        client.on('error', () => {
          // Connection failures surface through ping/health checks.
        });
        return client;
      },
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}
