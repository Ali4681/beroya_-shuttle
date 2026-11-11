import { Injectable } from '@nestjs/common';
import { TripStopStatus } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RoutingService } from '../../infra/routing/routing.service';
import { ArrivalAlertService } from '../notifications/arrival-alert.service';
import { accumulateStopEtas, parseCachedEta } from './eta.rules';
import { LiveLocationStore } from './live-location.store';
import { ETA_CACHE_TTL_SECONDS } from './tracking.constants';

export type TripEta = {
  etaToNextStopAt: Date | null;
  etaToFinishAt: Date | null;
  stops: Array<{ id: string; etaAt: Date }>;
};

@Injectable()
export class EtaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly routing: RoutingService,
    private readonly live: LiveLocationStore,
    private readonly arrival: ArrivalAlertService,
  ) {}

  async refresh(
    tripId: string,
    from: { lat: number; lng: number },
    now = new Date(),
  ): Promise<TripEta> {
    const cached = await this.live.readEtaCache(tripId);
    if (cached) {
      return parseCachedEta(cached);
    }

    const remaining = await this.prisma.tripStop.findMany({
      where: { tripId, status: TripStopStatus.PENDING },
      orderBy: { sequence: 'asc' },
    });
    if (remaining.length === 0) {
      const empty: TripEta = {
        etaToNextStopAt: null,
        etaToFinishAt: null,
        stops: [],
      };
      await this.cache(tripId, empty);
      return empty;
    }

    const legs = await this.routing.getEta(
      from,
      remaining.map((stop) => ({ lat: stop.latitude, lng: stop.longitude })),
    );

    const stops = accumulateStopEtas(remaining, legs, now);
    const result: TripEta = {
      etaToNextStopAt: stops[0]?.etaAt ?? null,
      etaToFinishAt: stops[stops.length - 1]?.etaAt ?? null,
      stops,
    };

    await this.prisma.$transaction(async (tx) => {
      for (const stop of stops) {
        await tx.tripStop.update({
          where: { id: stop.id },
          data: { etaAt: stop.etaAt },
        });
      }
      await tx.shuttleTrip.update({
        where: { id: tripId },
        data: {
          etaToNextStopAt: result.etaToNextStopAt,
          etaToFinishAt: result.etaToFinishAt,
        },
      });
    });

    await this.cache(tripId, result);
    try {
      await this.arrival.evaluate(tripId, now);
    } catch {
      // Arrival fan-out must not fail the location/ETA write.
    }
    return result;
  }

  private async cache(tripId: string, eta: TripEta): Promise<void> {
    await this.live.writeEtaCache(
      tripId,
      JSON.stringify({
        etaToNextStopAt: eta.etaToNextStopAt?.toISOString() ?? null,
        etaToFinishAt: eta.etaToFinishAt?.toISOString() ?? null,
        stops: eta.stops.map((stop) => ({
          id: stop.id,
          etaAt: stop.etaAt.toISOString(),
        })),
      }),
      ETA_CACHE_TTL_SECONDS,
    );
  }
}
