import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';

export type DependencyStatus = {
  status: 'up' | 'down';
  latencyMs: number;
  message?: string;
};

export type HealthResult = {
  status: 'ok' | 'degraded';
  uptimeSeconds: number;
  checks: {
    postgres: DependencyStatus;
    redis: DependencyStatus;
  };
};

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async check(): Promise<HealthResult> {
    const [postgres, redis] = await Promise.all([
      this.checkPostgres(),
      this.checkRedis(),
    ]);

    return {
      status:
        postgres.status === 'up' && redis.status === 'up' ? 'ok' : 'degraded',
      uptimeSeconds: Math.floor(process.uptime()),
      checks: { postgres, redis },
    };
  }

  private async checkPostgres(): Promise<DependencyStatus> {
    const started = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up', latencyMs: Date.now() - started };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - started,
        message:
          error instanceof Error ? error.message : 'Postgres unreachable',
      };
    }
  }

  private async checkRedis(): Promise<DependencyStatus> {
    const started = Date.now();
    try {
      const pong = await this.redis.ping();
      if (pong !== 'PONG') {
        throw new Error(`Unexpected redis response: ${pong}`);
      }
      return { status: 'up', latencyMs: Date.now() - started };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - started,
        message: error instanceof Error ? error.message : 'Redis unreachable',
      };
    }
  }
}
