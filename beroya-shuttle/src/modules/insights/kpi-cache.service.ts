import { Injectable } from '@nestjs/common';
import { RedisService } from '../../infra/redis/redis.service';
import { KPI_CACHE_TTL_SECONDS } from './insights.constants';

@Injectable()
export class KpiCacheService {
  constructor(private readonly redis: RedisService) {}

  async remember<T>(key: string, compute: () => Promise<T>): Promise<T> {
    const hit = await this.redis.get(key);
    if (hit) {
      return JSON.parse(hit) as T;
    }
    const value = await compute();
    await this.redis.set(key, JSON.stringify(value), KPI_CACHE_TTL_SECONDS);
    return value;
  }
}
