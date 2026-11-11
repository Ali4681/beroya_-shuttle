import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env.schema';
import { decodePolyline, encodePolyline } from './polyline';
import { EtaLeg, LatLng, RoutingProvider } from './routing.types';

@Injectable()
export class OsrmRoutingProvider implements RoutingProvider {
  private readonly logger = new Logger(OsrmRoutingProvider.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async getEta(from: LatLng, to: LatLng[]): Promise<EtaLeg[]> {
    const base = this.requireBase();
    if (to.length === 0) {
      throw new Error('OSRM is not configured');
    }

    const coords = [from, ...to]
      .map((point) => `${point.lng},${point.lat}`)
      .join(';');
    const destinations = to.map((_, index) => index + 1).join(';');
    const url = `${base}/table/v1/driving/${coords}?sources=0&destinations=${destinations}&annotations=duration,distance`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) {
      throw new Error(`OSRM HTTP ${response.status}`);
    }
    const payload = (await response.json()) as {
      durations?: Array<Array<number | null>>;
      distances?: Array<Array<number | null>>;
    };
    const durations = payload.durations?.[0];
    const distances = payload.distances?.[0];
    if (!durations || durations.length !== to.length) {
      throw new Error('OSRM returned an incomplete table');
    }
    return to.map((_, index) => ({
      durationSeconds: durations[index] ?? 0,
      distanceMeters: distances?.[index] ?? 0,
    }));
  }

  /**
   * Road-following geometry between waypoints (OSRM /route).
   * Uses overview=full + polyline6 (or geojson→encode) so zoom stays on streets.
   */
  async getEncodedRoutePolyline(
    points: LatLng[],
    precision = 6,
  ): Promise<string | null> {
    if (points.length < 2) {
      return null;
    }
    const base = this.requireBase();
    const coords = points
      .map((point) => `${point.lng},${point.lat}`)
      .join(';');
    // Snap waypoints to nearby roads (avoids cutting blocks when stops are off-kerb)
    const radiuses = points.map(() => '65').join(';');
    const geometryParam = precision >= 6 ? 'polyline6' : 'geojson';
    const url =
      `${base}/route/v1/driving/${coords}` +
      `?overview=full&geometries=${geometryParam}&steps=false&radiuses=${radiuses}`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      throw new Error(`OSRM route HTTP ${response.status}`);
    }
    const payload = (await response.json()) as {
      code?: string;
      routes?: Array<{
        geometry?:
          | string
          | { coordinates?: Array<[number, number]> };
      }>;
    };
    const geometry = payload.routes?.[0]?.geometry;
    if (!geometry) {
      throw new Error('OSRM route returned no geometry');
    }
    if (typeof geometry === 'string') {
      // Native OSRM polyline6 — densest, no re-quantization loss
      if (precision >= 6) {
        return geometry;
      }
      return encodePolyline(decodePolyline(geometry, 6), precision);
    }
    const coordinates = geometry.coordinates;
    if (!coordinates?.length) {
      throw new Error('OSRM route returned empty geojson');
    }
    const latLngs = coordinates.map(([lng, lat]) => ({ lat, lng }));
    return encodePolyline(latLngs, precision);
  }

  logFallback(error: unknown): void {
    this.logger.warn(
      `OSRM failed, using haversine fallback: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
    );
  }

  private requireBase(): string {
    const base = this.config.get('OSRM_BASE_URL', { infer: true });
    if (!base) {
      throw new Error('OSRM is not configured');
    }
    return base.replace(/\/$/, '');
  }
}
