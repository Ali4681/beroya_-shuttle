import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../../common/errors/app.exception';
import { todayInTimezone } from '../../common/utils/timezone';
import { Env } from '../../config/env.schema';
import {
  TripEventType,
  TripStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { QueueService } from '../../infra/queue/queue.service';
import { QUEUE_NAMES } from '../../infra/queue/queue.constants';
import { REALTIME_EVENTS } from '../realtime/realtime.constants';
import { RealtimeService } from '../realtime/realtime.service';
import { TripEventService } from '../trips/trip-event.service';
import { PlatformSettingsService } from '../admin/platform-settings.service';
import { LocationPingDto } from './dto/location-ping.dto';
import { LiveMapQueryDto } from './dto/live-map.query';
import { DelayDetectionService } from './delay-detection.service';
import { EtaService } from './eta.service';
import { LiveLocation, LiveLocationStore } from './live-location.store';
import {
  LOCATION_EMIT_TTL_SECONDS,
  MIRROR_INTERVAL_MS,
  PING_RETENTION_DAYS,
  SAMPLE_INTERVAL_MS,
} from './tracking.constants';
import { mapLiveTrip } from './tracking.mapper';
import { assertLocationAllowed, isGpsStale } from './tracking.rules';

export const PERSIST_LOCATION_JOB = 'persist-location';

@Injectable()
export class TrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly live: LiveLocationStore,
    private readonly eta: EtaService,
    private readonly delay: DelayDetectionService,
    private readonly events: TripEventService,
    private readonly realtime: RealtimeService,
    private readonly queue: QueueService,
    private readonly config: ConfigService<Env, true>,
    private readonly platform: PlatformSettingsService,
  ) {}

  async ingestDriverLocation(
    userId: string,
    tripId: string,
    dto: LocationPingDto,
  ) {
    const trip = await this.requireDriverTrip(userId, tripId);
    assertLocationAllowed(trip.status);
    const recordedAt = dto.recordedAt ? new Date(dto.recordedAt) : new Date();
    const location: LiveLocation = {
      tripId,
      latitude: dto.latitude,
      longitude: dto.longitude,
      speedKph: dto.speedKph,
      heading: dto.heading,
      accuracy: dto.accuracy,
      recordedAt: recordedAt.toISOString(),
    };

    await this.live.writeLocation(location);
    await this.live.addLiveTrip(trip.institutionId, tripId);

    if (await this.live.isTrackingLost(tripId)) {
      await this.live.clearTrackingLost(tripId);
      await this.events.record({
        tripId,
        type: TripEventType.TRACKING_RESUMED,
        actorUserId: userId,
        title: 'Tracking resumed',
      });
    }

    await this.enqueueOrPersist(location);
    const eta = await this.eta.refresh(tripId, {
      lat: dto.latitude,
      lng: dto.longitude,
    });
    await this.delay.evaluate(tripId);

    if (await this.live.claimEmit(tripId, LOCATION_EMIT_TTL_SECONDS)) {
      this.realtime.emitTrip(
        REALTIME_EVENTS.TRIP_LOCATION_UPDATED,
        {
          institutionId: trip.institutionId,
          tripId,
          routeId: trip.routeId,
          operationModel: trip.institution.operationModel,
        },
        {
          latitude: dto.latitude,
          longitude: dto.longitude,
          heading: dto.heading ?? null,
          speed_kph: dto.speedKph ?? null,
          recorded_at: location.recordedAt,
        },
      );
    }

    return {
      accepted: true,
      sampled: (await this.live.lastSampleAt(tripId)) != null,
      location: {
        latitude: dto.latitude,
        longitude: dto.longitude,
        recordedAt: location.recordedAt,
      },
      etaToNextStopAt: eta.etaToNextStopAt,
      etaToFinishAt: eta.etaToFinishAt,
    };
  }

  async ingestDriverBatch(
    userId: string,
    tripId: string,
    pings: LocationPingDto[],
  ) {
    let last: Awaited<ReturnType<TrackingService['ingestDriverLocation']>> | null =
      null;
    const ordered = [...pings].sort((a, b) => {
      const left = a.recordedAt ? new Date(a.recordedAt).getTime() : 0;
      const right = b.recordedAt ? new Date(b.recordedAt).getTime() : 0;
      return left - right;
    });
    for (const ping of ordered) {
      last = await this.ingestDriverLocation(userId, tripId, ping);
    }
    return { accepted: ordered.length, last };
  }

  async persistSample(location: LiveLocation): Promise<{ sampled: boolean }> {
    const recordedAt = new Date(location.recordedAt);
    const lastSample = await this.live.lastSampleAt(location.tripId);
    const shouldSample =
      !lastSample ||
      recordedAt.getTime() - lastSample.getTime() >= SAMPLE_INTERVAL_MS;
    if (shouldSample) {
      await this.prisma.tripLocationPing.create({
        data: {
          tripId: location.tripId,
          latitude: location.latitude,
          longitude: location.longitude,
          speedKph: location.speedKph,
          heading: location.heading,
          accuracy: location.accuracy,
          recordedAt,
        },
      });
      await this.live.markSampled(location.tripId, recordedAt);
    }

    const lastMirror = await this.live.lastMirroredAt(location.tripId);
    const shouldMirror =
      !lastMirror ||
      recordedAt.getTime() - lastMirror.getTime() >= MIRROR_INTERVAL_MS;
    if (shouldMirror) {
      await this.prisma.shuttleTrip.update({
        where: { id: location.tripId },
        data: {
          lastLocationLat: location.latitude,
          lastLocationLng: location.longitude,
          lastLocationAt: recordedAt,
        },
      });
      await this.live.markMirrored(location.tripId, recordedAt);
    }

    return { sampled: shouldSample };
  }

  async getLiveTrip(institutionId: string, tripId: string) {
    const trip = await this.prisma.shuttleTrip.findFirst({
      where: { id: tripId, institutionId },
      include: {
        route: { select: { id: true, name: true } },
        stops: { orderBy: { sequence: 'asc' } },
      },
    });
    if (!trip) {
      throw new AppException(
        'TRIP_NOT_FOUND',
        'Trip not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return this.decorateLive(trip);
  }

  async liveMap(institutionId: string, query: LiveMapQueryDto) {
    const liveIds = await this.live.listLiveTripIds(institutionId);
    if (liveIds.length === 0) {
      return [];
    }
    const trips = await this.prisma.shuttleTrip.findMany({
      where: {
        institutionId,
        id: { in: liveIds },
        ...(query.branchId ? { branchId: query.branchId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: {
        route: { select: { id: true, name: true } },
        stops: { orderBy: { sequence: 'asc' } },
      },
    });
    const rows = [];
    for (const trip of trips) {
      rows.push(await this.decorateLive(trip));
    }
    return rows;
  }

  async dashboardLiveTrips(institutionId: string) {
    const timeZone = await this.timezone(institutionId);
    const trips = await this.prisma.shuttleTrip.findMany({
      where: {
        institutionId,
        serviceDate: todayInTimezone(timeZone),
        status: { in: [TripStatus.IN_PROGRESS, TripStatus.SCHEDULED] },
      },
      include: {
        route: { select: { id: true, name: true } },
        stops: { orderBy: { sequence: 'asc' } },
      },
      orderBy: { scheduledDepartureTime: 'asc' },
    });
    const rows = [];
    for (const trip of trips) {
      rows.push(await this.decorateLive(trip));
    }
    return rows;
  }

  async markStaleTrips(): Promise<number> {
    const trips = await this.prisma.shuttleTrip.findMany({
      where: { status: TripStatus.IN_PROGRESS },
      include: {
        institution: {
          select: { operationModel: true, settings: true },
        },
      },
    });
    let marked = 0;
    for (const trip of trips) {
      const location = await this.live.readLocation(trip.id);
      const lastAt = location
        ? new Date(location.recordedAt)
        : trip.lastLocationAt;
      const staleAfter = await this.platform.gpsStaleAfterSeconds(
        trip.institutionId,
      );
      if (!isGpsStale(lastAt, staleAfter) || (await this.live.isTrackingLost(trip.id))) {
        continue;
      }
      await this.live.markTrackingLost(trip.id);
      await this.events.record({
        tripId: trip.id,
        type: TripEventType.TRACKING_LOST,
        title: 'Tracking stale',
      });
      this.realtime.emitTrip(REALTIME_EVENTS.TRIP_TRACKING_STALE, {
        institutionId: trip.institutionId,
        tripId: trip.id,
        routeId: trip.routeId,
        operationModel: trip.institution.operationModel,
      });
      marked += 1;
    }
    return marked;
  }

  async flushLiveLocation(tripId: string): Promise<number> {
    const location = await this.live.readLocation(tripId);
    if (!location) {
      return 0;
    }
    await this.persistSample(location);
    return 1;
  }

  async cleanupOldPings(): Promise<number> {
    const cutoff = new Date(
      Date.now() - PING_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
    const result = await this.prisma.tripLocationPing.deleteMany({
      where: { recordedAt: { lt: cutoff } },
    });
    return result.count;
  }

  async dropLiveTrip(institutionId: string, tripId: string): Promise<void> {
    await this.live.removeLiveTrip(institutionId, tripId);
  }

  private async decorateLive(
    trip: Parameters<typeof mapLiveTrip>[0]['trip'],
  ) {
    const location = await this.live.readLocation(trip.id);
    const staleAfter = await this.platform.gpsStaleAfterSeconds(
      trip.institutionId,
    );
    const lastAt = location
      ? new Date(location.recordedAt)
      : trip.lastLocationAt;
    const gpsStale = isGpsStale(lastAt, staleAfter);
    if (gpsStale && trip.status === TripStatus.IN_PROGRESS) {
      const already = await this.live.isTrackingLost(trip.id);
      if (!already && lastAt) {
        await this.live.markTrackingLost(trip.id);
        await this.events.record({
          tripId: trip.id,
          type: TripEventType.TRACKING_LOST,
          title: 'Tracking stale',
        });
        const institution = await this.prisma.institution.findUnique({
          where: { id: trip.institutionId },
          select: { operationModel: true },
        });
        this.realtime.emitTrip(REALTIME_EVENTS.TRIP_TRACKING_STALE, {
          institutionId: trip.institutionId,
          tripId: trip.id,
          routeId: trip.routeId,
          operationModel: institution?.operationModel,
        });
      }
    }
    return mapLiveTrip({ trip, location, gpsStale });
  }

  private async enqueueOrPersist(location: LiveLocation): Promise<void> {
    if (this.config.get('MOCK_REDIS', { infer: true })) {
      await this.persistSample(location);
      return;
    }
    await this.queue.enqueue(
      QUEUE_NAMES.LOCATION_PINGS,
      PERSIST_LOCATION_JOB,
      location,
    );
  }

  private async requireDriverTrip(userId: string, tripId: string) {
    const driver = await this.prisma.driverProfile.findFirst({
      where: { userId, archivedAt: null },
    });
    if (!driver) {
      throw new AppException(
        'DRIVER_NOT_FOUND',
        'Driver profile not found',
        HttpStatus.FORBIDDEN,
      );
    }
    const trip = await this.prisma.shuttleTrip.findUnique({
      where: { id: tripId },
      include: { institution: { select: { operationModel: true } } },
    });
    if (!trip) {
      throw new AppException(
        'TRIP_NOT_FOUND',
        'Trip not found',
        HttpStatus.NOT_FOUND,
      );
    }
    if (trip.driverId !== driver.id) {
      throw new AppException(
        'DRIVER_NOT_ASSIGNED',
        'You are not assigned to this trip',
        HttpStatus.FORBIDDEN,
      );
    }
    return trip;
  }

  private async timezone(institutionId: string): Promise<string> {
    const settings = await this.prisma.institutionSettings.findUnique({
      where: { institutionId },
    });
    return settings?.timezone ?? 'Asia/Damascus';
  }
}
