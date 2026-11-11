import { Injectable } from '@nestjs/common';
import { RedisService } from '../../infra/redis/redis.service';
import {
  institutionLiveKey,
  LIVE_LOCATION_TTL_SECONDS,
  tripEmitKey,
  tripEtaKey,
  tripLocKey,
  tripMirroredKey,
  tripSampledKey,
  tripTrackingLostKey,
} from './tracking.constants';

export type LiveLocation = {
  tripId: string;
  latitude: number;
  longitude: number;
  speedKph?: number | null;
  heading?: number | null;
  accuracy?: number | null;
  recordedAt: string;
};

@Injectable()
export class LiveLocationStore {
  constructor(private readonly redis: RedisService) {}

  async writeLocation(location: LiveLocation): Promise<void> {
    await this.redis.set(
      tripLocKey(location.tripId),
      JSON.stringify(location),
      LIVE_LOCATION_TTL_SECONDS,
    );
  }

  async readLocation(tripId: string): Promise<LiveLocation | null> {
    const raw = await this.redis.get(tripLocKey(tripId));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as LiveLocation;
  }

  async addLiveTrip(institutionId: string, tripId: string): Promise<void> {
    await this.redis.sadd(institutionLiveKey(institutionId), tripId);
  }

  async removeLiveTrip(institutionId: string, tripId: string): Promise<void> {
    await this.redis.srem(institutionLiveKey(institutionId), tripId);
    await this.redis.del(tripLocKey(tripId));
    await this.redis.del(tripEtaKey(tripId));
    await this.redis.del(tripEmitKey(tripId));
    await this.redis.del(tripSampledKey(tripId));
    await this.redis.del(tripMirroredKey(tripId));
    await this.redis.del(tripTrackingLostKey(tripId));
  }

  async listLiveTripIds(institutionId: string): Promise<string[]> {
    return this.redis.smembers(institutionLiveKey(institutionId));
  }

  async readEtaCache(tripId: string): Promise<string | null> {
    return this.redis.get(tripEtaKey(tripId));
  }

  async writeEtaCache(tripId: string, value: string, ttlSeconds: number) {
    await this.redis.set(tripEtaKey(tripId), value, ttlSeconds);
  }

  async claimEmit(tripId: string, ttlSeconds: number): Promise<boolean> {
    return this.redis.setNx(tripEmitKey(tripId), '1', ttlSeconds);
  }

  async lastSampleAt(tripId: string): Promise<Date | null> {
    return this.readStamp(tripSampledKey(tripId));
  }

  async markSampled(tripId: string, at: Date): Promise<void> {
    await this.redis.set(tripSampledKey(tripId), at.toISOString());
  }

  async lastMirroredAt(tripId: string): Promise<Date | null> {
    return this.readStamp(tripMirroredKey(tripId));
  }

  async markMirrored(tripId: string, at: Date): Promise<void> {
    await this.redis.set(tripMirroredKey(tripId), at.toISOString());
  }

  async isTrackingLost(tripId: string): Promise<boolean> {
    return (await this.redis.get(tripTrackingLostKey(tripId))) === '1';
  }

  async markTrackingLost(tripId: string): Promise<void> {
    await this.redis.set(tripTrackingLostKey(tripId), '1');
  }

  async clearTrackingLost(tripId: string): Promise<void> {
    await this.redis.del(tripTrackingLostKey(tripId));
  }

  private async readStamp(key: string): Promise<Date | null> {
    const raw = await this.redis.get(key);
    return raw ? new Date(raw) : null;
  }
}
